const Submission = require("../models/Submission");
const Question = require("../models/Question");
const User = require("../models/User");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
/* ======================================================
   🔍 GET SINGLE USER FULL REPORT
   GET /api/admin/report/:userId
====================================================== */
exports.getUserReport = async (req, res) => {
  try {
    const { userId } = req.params;

    const submission = await Submission.findOne({ user: userId })
      .populate("user", "name email college year language")
      .populate("submissions.questionId");

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      });
    }

    const report = {
      user: {
        name: submission.user.name,
        email: submission.user.email,
        college: submission.user.college,
        year: submission.user.year,
        language: submission.user.language,
      },
      score: submission.score,
      timeTaken: submission.timeTaken,
      isDisqualified: submission.isDisqualified,
      reason: submission.disqualificationReason,
      questions: [],
    };

    for (const qSub of submission.submissions) {
      const q = qSub.questionId;
      if (!q) continue;

      report.questions.push({
        questionCode: q.questionCode,
        problemStatement: q.problemStatement,
        buggyCode: q.languages?.[submission.user.language]?.buggyCode || "",
        finalVerdict: qSub.finalVerdict,
        finalCode: qSub.finalCode,
        attempts: qSub.attempts.map((a, i) => ({
          attemptNo: i + 1,
          verdict: a.verdict,
          executedAt: a.executedAt,
          code: a.code,
        })),
      });
    }

    return res.json({
      success: true,
      report,
    });
  } catch (err) {
    console.error("Admin Report Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to generate report",
    });
  }
};


/* ======================================================
   📊 ALL SUBMISSIONS SUMMARY (ADMIN DASHBOARD)
   GET /api/admin/submissions
====================================================== */
exports.getAllSubmissionsSummary = async (req, res) => {
  try {
    const submissions = await Submission.find()
      .populate("user", "name college email")
      .sort({ score: -1, timeTaken: 1 });

    const summary = submissions
      .filter(s => s.user)
      .map((s) => ({
        userId: s.user._id,
        name: s.user.name,
        email: s.user.email,
        college: s.user.college,
        score: s.score,
        timeTaken: s.timeTaken,
        isDisqualified: s.isDisqualified,
        tabSwitchCount: s.tabSwitchCount,
      }));

    return res.json({
      success: true,
      submissions: summary,
    });
  } catch (err) {
    console.error("Admin Summary Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch submissions",
    });
  }
};



exports.downloadUserReport = async (req, res) => {
  try {
    const { userId } = req.params;

    const submission = await Submission.findOne({ user: userId })
      .populate("user", "name email college year language")
      .populate("submissions.questionId");

    if (!submission) {
      return res.status(404).json({ success: false });
    }

    const report = {
      user: {
        name: submission.user.name,
        email: submission.user.email,
        college: submission.user.college,
        language: submission.user.language,
      },
      score: submission.score,
      timeTaken: submission.timeTaken,
      isDisqualified: submission.isDisqualified,
      reason: submission.disqualificationReason,
      questions: submission.submissions.map(qs => {
        const q = qs.questionId;
        return {
          questionCode: q.questionCode,
          problemStatement: q.problemStatement,
          buggyCode: q.languages[submission.user.language]?.buggyCode || "",
          attempts: qs.attempts.map((a, i) => ({
            attemptNo: i + 1,
            verdict: a.verdict,
            code: a.code,
          })),
        };
      }),
    };

    const py = spawn("python", [
      path.join(__dirname, "../utils/generate_report.py"),
    ]);

    py.stdin.write(JSON.stringify(report));
    py.stdin.end();

    py.on("close", () => {
      const filePath = path.join(process.cwd(), "report.pdf");
      res.download(filePath, `BugHunt_${submission.user.name}.pdf`, () => {
        fs.unlinkSync(filePath);
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
};