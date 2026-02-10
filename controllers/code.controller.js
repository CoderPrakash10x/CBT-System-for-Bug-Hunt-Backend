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
        message: "Submission not allowed",
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
    let qSub = submission.submissions.find(
      (s) => s.questionId.toString() === questionId
    );

    // 🔒 LOCK: already solved
    if (qSub && qSub.finalVerdict === "ACCEPTED") {
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

      if (statusId === 3) continue;

      if (statusId === 6) verdict = "COMPILE_ERROR";
      else if (statusId === 5) verdict = "TIME_LIMIT_EXCEEDED";
      else if (statusId >= 7 && statusId <= 12) verdict = "RUNTIME_ERROR";
      else verdict = "WRONG_ANSWER";

      break;
    }

    const attempt = {
      code,
      verdict,
      executedAt: new Date(),
    };

    // ================= UPDATE SUBMISSION =================
    if (!qSub) {
      qSub = {
        questionId,
        attempts: [],
        finalCode: "",
        finalVerdict: "PENDING",
        lastExecutedAt: null,
      };
      submission.submissions.push(qSub);
    }

    qSub.attempts.push(attempt);
    qSub.lastExecutedAt = new Date();

    // FINAL STATE UPDATE
    if (verdict === "ACCEPTED") {
      qSub.finalVerdict = "ACCEPTED";
      qSub.finalCode = code;
    } else {
      qSub.finalVerdict = verdict;
    }

    // ================= SCORE RECALC =================
    submission.score = submission.submissions.filter(
      (s) => s.finalVerdict === "ACCEPTED"
    ).length;

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
