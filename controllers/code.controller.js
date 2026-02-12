const Submission = require("../models/Submission");
const Question = require("../models/Question");
const User = require("../models/User");
const Exam = require("../models/Exam");
const { submitToJudge0 } = require("../utils/judge0");

const MAX_ATTEMPTS_PER_QUESTION = 5;

// 🔥 ROBUST OUTPUT NORMALIZER (Fixes extra newlines/spaces)
const normalize = (str) =>
  (str || "").toString().replace(/[\r\n]+/g, " ").trim().replace(/\s+/g, " ");

exports.submitCode = async (req, res) => {
  try {
    const { userId, questionId, code } = req.body;

    // 🔒 GUARD: Check inputs
    if (!userId || !questionId || !code || code.trim().length < 5) {
      return res.status(400).json({ success: false, message: "Code too short or missing fields" });
    }

    const exam = await Exam.findOne().sort({ createdAt: -1 });
    if (!exam) return res.status(404).json({ success: false, message: "No active exam found" });

    const [submission, user] = await Promise.all([
      Submission.findOne({ user: userId, exam: exam._id, isSubmitted: false }),
      User.findById(userId).select("language questionSet"),
    ]);

    if (!submission || !user) {
      return res.status(403).json({ success: false, message: "Exam session not active or user not found" });
    }

    if (submission.isDisqualified) {
      return res.status(403).json({ success: false, message: "User is disqualified" });
    }

    const question = await Question.findById(questionId).lean();
    const langBlock = question?.languages?.[user.language];

    if (!question || !langBlock) {
      return res.status(404).json({ success: false, message: "Question/Language not supported" });
    }

    // 🔒 GUARD: Check for no changes
    if (code.trim() === langBlock.buggyCode.trim()) {
      return res.status(409).json({ success: false, message: "No changes made to code" });
    }

    const qSubIndex = submission.submissions.findIndex(s => s.questionId.toString() === questionId);

    // 🔒 GUARD: Already accepted?
    if (qSubIndex !== -1 && submission.submissions[qSubIndex].finalVerdict === "ACCEPTED") {
      return res.json({ success: true, verdict: "ACCEPTED", locked: true, score: submission.score });
    }

    // 🔒 GUARD: Max attempts
    if (qSubIndex !== -1 && submission.submissions[qSubIndex].attempts.length >= MAX_ATTEMPTS_PER_QUESTION) {
      return res.status(429).json({ success: false, message: "Max attempts reached" });
    }

    /* ===================== JUDGE0 EXECUTION ===================== */
    let finalSourceCode = langBlock.wrapperCode 
      ? langBlock.wrapperCode.replace("__USER_CODE__", code) 
      : code;

    let verdict = "ACCEPTED";

    for (const tc of langBlock.testCases) {
      const result = await submitToJudge0({
        sourceCode: finalSourceCode,
        language: user.language,
        stdin: tc.input,
        expectedOutput: tc.output,
      });

      const statusId = result?.status?.id;

      if (statusId !== 3) { // 3 = Accepted in Judge0
        if (statusId === 4) verdict = "WRONG_ANSWER";
        else if (statusId === 5) verdict = "TIME_LIMIT_EXCEEDED";
        else if (statusId === 6) verdict = "COMPILE_ERROR";
        else verdict = "RUNTIME_ERROR";
        break;
      }

      // 🔥 Final Output Comparison
      const actual = normalize(result.stdout);
      const expected = normalize(tc.output);

      if (actual !== expected) {
        verdict = "WRONG_ANSWER";
        break;
      }
    }

    /* ===================== UPDATE DATABASE ===================== */
    const attempt = { code, verdict, executedAt: new Date() };

    if (qSubIndex === -1) {
      submission.submissions.push({
        questionId,
        attempts: [attempt],
        finalCode: verdict === "ACCEPTED" ? code : "",
        finalVerdict: verdict,
        lastExecutedAt: new Date(),
      });
    } else {
      submission.submissions[qSubIndex].attempts.push(attempt);
      submission.submissions[qSubIndex].finalVerdict = verdict;
      submission.submissions[qSubIndex].lastExecutedAt = new Date();
      if (verdict === "ACCEPTED") {
        submission.submissions[qSubIndex].finalCode = code;
      }
    }

    // Recalculate Score
    submission.score = submission.submissions.filter(s => s.finalVerdict === "ACCEPTED").length;
    
    submission.markModified("submissions");
    await submission.save(); // Leaderboard logic relies on this being saved first!

    return res.json({ success: true, verdict, score: submission.score });

  } catch (err) {
    console.error("Code Execution Error:", err);
    return res.status(500).json({ success: false, message: "Execution failed" });
  }
};