const Submission = require("../models/Submission");
const Exam = require("../models/Exam");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

/* ================= USER FULL REPORT ================= */
exports.getUserReport = async (req, res) => {
  try {
    const { userId } = req.params;

    const exam = await Exam.findOne().sort({ createdAt: -1 });
    if (!exam) {
      return res.status(404).json({ success: false });
    }

    const submission = await Submission.findOne({
      user: userId,
      exam: exam._id,
    })
      .populate("user", "name email college year language")
      .populate("submissions.questionId");

    if (!submission) {
      return res.status(404).json({ success: false });
    }

    const report = {
      user: submission.user,
      score: submission.score,
      timeTaken: submission.timeTaken,
      isDisqualified: submission.isDisqualified,
      reason: submission.disqualificationReason,
      questions: submission.submissions.map((qSub, idx) => {
        const q = qSub.questionId;
        return {
          questionCode: q?.questionCode || `Q-${idx + 1}`,
          problemStatement: q?.problemStatement || "",
          buggyCode:
            q?.languages?.[submission.user.language]?.buggyCode || "",
          finalVerdict: qSub.finalVerdict,
          finalCode: qSub.finalCode,
          attempts: qSub.attempts.map((a, i) => ({
            attemptNo: i + 1,
            verdict: a.verdict,
            code: a.code,
          })),
        };
      }),
    };

    res.json({ success: true, report });
  } catch (err) {
    console.error("Report error:", err);
    res.status(500).json({ success: false });
  }
};

/* ================= ALL SUBMISSIONS ================= */
exports.getAllSubmissionsSummary = async (req, res) => {
  try {
    const exam = await Exam.findOne().sort({ createdAt: -1 });
    if (!exam) return res.json({ success: true, submissions: [] });

    const submissions = await Submission.find({ exam: exam._id })
      .populate("user", "name college email")
      .sort({ score: -1, timeTaken: 1 });

    const summary = submissions
      .filter((s) => s.user)
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

    res.json({ success: true, submissions: summary });
  } catch {
    res.status(500).json({ success: false });
  }
};

/* ================= PDF REPORT ================= */
exports.downloadUserReport = async (req, res) => {
  try {
    const { userId } = req.params;

    const exam = await Exam.findOne().sort({ createdAt: -1 });
    if (!exam) return res.status(404).json({ success: false });

    const submission = await Submission.findOne({
      user: userId,
      exam: exam._id,
    })
      .populate("user", "name email college year language")
      .populate("submissions.questionId");

    if (!submission) return res.status(404).json({ success: false });

    const report = {
      user: submission.user,
      score: submission.score,
      timeTaken: submission.timeTaken,
      isDisqualified: submission.isDisqualified,
      reason: submission.disqualificationReason,
      questions: submission.submissions,
    };

    const fileName = `BugHunt_${submission.user._id}_${Date.now()}.pdf`;
    const filePath = path.join(process.cwd(), fileName);

    const py = spawn("python", [
      path.join(__dirname, "../utils/generate_report.py"),
      filePath,
    ]);

    py.stdin.write(JSON.stringify(report));
    py.stdin.end();

    py.on("close", () => {
      res.download(filePath, fileName, () => {
        fs.unlink(filePath, () => {});
      });
    });
  } catch {
    res.status(500).json({ success: false });
  }
};
