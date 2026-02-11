const Submission = require("../models/Submission");
const Question = require("../models/Question");
const User = require("../models/User");
const Exam = require("../models/Exam");
const { submitToJudge0 } = require("../utils/judge0");

const MAX_ATTEMPTS_PER_QUESTION = 5;

exports.submitCode = async (req, res) => {
  try {
    const { userId, questionId, code } = req.body;

    if (!userId || !questionId || !code) {
      return res.status(400).json({ success: false, message: "Missing fields" });
    }

    const exam = await Exam.findOne().sort({ createdAt: -1 });

    const [submission, user] = await Promise.all([
      Submission.findOne({
        user: userId,
        exam: exam._id,
        isSubmitted: false,
      }),
      User.findById(userId).select("language questionSet"),
    ]);

    if (!submission || !user) {
      return res.status(403).json({
        success: false,
        message: "Exam session not active",
      });
    }

    if (submission.isDisqualified) {
      return res.status(403).json({
        success: false,
        message: "User is disqualified",
      });
    }

    const question = await Question.findById(questionId).lean();
    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    // 🔥 QuestionSet enforcement
    if (question.questionSet !== user.questionSet) {
      return res.status(403).json({
        success: false,
        message: "Question not allowed for this user",
      });
    }

    const langBlock = question.languages?.[user.language];
    if (!langBlock) {
      return res.status(400).json({
        success: false,
        message: "Language not supported",
      });
    }

    const qSubIndex = submission.submissions.findIndex(
      (s) => s.questionId.toString() === questionId
    );

    if (
      qSubIndex !== -1 &&
      submission.submissions[qSubIndex].finalVerdict === "ACCEPTED"
    ) {
      return res.json({
        success: true,
        verdict: "ACCEPTED",
        locked: true,
        score: submission.score,
      });
    }

    if (
      qSubIndex !== -1 &&
      submission.submissions[qSubIndex].attempts.length >= MAX_ATTEMPTS_PER_QUESTION
    ) {
      return res.status(429).json({
        success: false,
        message: "Max attempts reached",
      });
    }

    /* ===================== 🔥 MAIN FIX HERE 🔥 ===================== */

    // 👉 FINAL SOURCE CODE (wrapper + user code)
    let finalSourceCode = code;

    if (langBlock.wrapperCode) {
      finalSourceCode = langBlock.wrapperCode.replace(
        "__USER_CODE__",
        code
      );
    }

    /* =============================================================== */

    let verdict = "ACCEPTED";

    for (const tc of langBlock.testCases) {
      const result = await submitToJudge0({
        sourceCode: finalSourceCode,   // ✅ FIXED LINE
        language: user.language,
        stdin: tc.input,
        expectedOutput: tc.output,
      });

      const statusId = result?.status?.id;
      if (statusId === 3) continue;

      if (statusId === 6) verdict = "COMPILE_ERROR";
      else if (statusId === 5) verdict = "TIME_LIMIT_EXCEEDED";
      else if (statusId >= 7 && statusId <= 12) verdict = "RUNTIME_ERROR";
      else verdict = "WRONG_ANSWER";
      break;
    }

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

    submission.score = submission.submissions.filter(
      (s) => s.finalVerdict && s.finalVerdict.toUpperCase() === "ACCEPTED"
    ).length;

    submission.markModified("submissions");
    await submission.save();

    return res.json({ success: true, verdict, score: submission.score });
  } catch (err) {
    console.error("Code Execution Error:", err);
    return res.status(500).json({
      success: false,
      message: "Execution failed",
    });
  }
};
