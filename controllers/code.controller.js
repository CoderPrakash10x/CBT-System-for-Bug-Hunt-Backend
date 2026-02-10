const Submission = require("../models/Submission");
const Question = require("../models/Question");
const User = require("../models/User");
const { submitToJudge0 } = require("../utils/judge0");

exports.submitCode = async (req, res) => {
  try {
    const { userId, questionId, code } = req.body;

    if (!userId || !questionId || !code) {
      return res.status(400).json({
        success: false,
        message: "Missing fields",
      });
    }

    // ================= BASIC CHECKS =================
    const [submission, user] = await Promise.all([
      Submission.findOne({ user: userId, isSubmitted: false }),
      User.findById(userId).select("language"),
    ]);

    if (!submission || !user) {
      return res.status(403).json({
        success: false,
        message: "Exam session not active or user not found",
      });
    }

    if (submission.isDisqualified) {
      return res.status(403).json({
        success: false,
        message: "User is disqualified",
      });
    }

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    const langBlock = question.languages[user.language];
    if (!langBlock) {
      return res.status(400).json({
        success: false,
        message: "Language not supported for this question",
      });
    }

    // ================= FIND QUESTION ENTRY =================
    // We search within the existing submissions array
    let qSubIndex = submission.submissions.findIndex(
      (s) => s.questionId.toString() === questionId
    );

    // 🔒 LOCK: If already solved, don't re-run (save credits/time)
    if (qSubIndex !== -1 && submission.submissions[qSubIndex].finalVerdict === "ACCEPTED") {
      return res.json({
        success: true,
        verdict: "ACCEPTED",
        locked: true,
        score: submission.score,
      });
    }

    // ================= EXECUTE CODE =================
    let verdict = "ACCEPTED";

    for (const tc of langBlock.testCases) {
      const result = await submitToJudge0({
        sourceCode: code,
        language: user.language,
        stdin: tc.input,
        expectedOutput: tc.output,
      });

      const statusId = result.status?.id;

      if (statusId === 3) continue; // 3 is "Accepted" for this specific test case

      if (statusId === 6) verdict = "COMPILE_ERROR";
      else if (statusId === 5) verdict = "TIME_LIMIT_EXCEEDED";
      else if (statusId >= 7 && statusId <= 12) verdict = "RUNTIME_ERROR";
      else verdict = "WRONG_ANSWER";

      break; // Stop at first failing test case
    }

    const attempt = {
      code,
      verdict,
      executedAt: new Date(),
    };

    // ================= UPDATE SUBMISSION ARRAY =================
    if (qSubIndex === -1) {
      // Create new question entry if it doesn't exist
      submission.submissions.push({
        questionId,
        attempts: [attempt],
        finalCode: verdict === "ACCEPTED" ? code : "",
        finalVerdict: verdict,
        lastExecutedAt: new Date(),
      });
    } else {
      // Update existing entry
      submission.submissions[qSubIndex].attempts.push(attempt);
      submission.submissions[qSubIndex].lastExecutedAt = new Date();
      submission.submissions[qSubIndex].finalVerdict = verdict;
      
      if (verdict === "ACCEPTED") {
        submission.submissions[qSubIndex].finalCode = code;
      }
    }

    // ================= RECALCULATE SCORE & SAVE =================
    // Filter the updated array for accepted questions
    submission.score = submission.submissions.filter(
      (s) => s.finalVerdict === "ACCEPTED"
    ).length;

    // IMPORTANT: Tell Mongoose the nested array has changed
    submission.markModified('submissions');
    
    await submission.save();

    return res.json({
      success: true,
      verdict,
      score: submission.score,
    });
  } catch (err) {
    console.error("Code Execution Error:", err);
    return res.status(500).json({
      success: false,
      message: "Execution failed",
    });
  }
};