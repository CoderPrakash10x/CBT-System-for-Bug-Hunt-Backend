const Exam = require("../models/Exam");
const Submission = require("../models/Submission");

/* ================== SINGLE SOURCE OF TRUTH ================== */
const getCurrentExam = async () => {
  let exam = await Exam.findOne().sort({ createdAt: -1 });
  if (!exam) {
    exam = await Exam.create({
      status: "waiting",
      duration: 10,
    });
  }
  return exam;
};

/* ================== GET EXAM ================== */
exports.getExam = async (req, res) => {
  try {
    const exam = await getCurrentExam();
    res.json({ success: true, exam });
  } catch {
    res.status(500).json({ success: false });
  }
};

/* ================== START EXAM ================== */
exports.startExam = async (req, res) => {
  try {
    const exam = await getCurrentExam();
    if (exam.status === "live") {
      return res.status(400).json({ message: "Exam already live" });
    }

    const now = new Date();
    exam.status = "live";
    exam.startTime = now;
    exam.endTime = new Date(now.getTime() + exam.duration * 60 * 1000);
    await exam.save();

    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false });
  }
};

/* ================== END EXAM ================== */
exports.endExam = async (req, res) => {
  try {
    const exam = await getCurrentExam();
    exam.status = "ended";
    exam.endTime = new Date();
    await exam.save();

    await Submission.updateMany(
      { exam: exam._id, isSubmitted: false },
      {
        $set: {
          isSubmitted: true,
          submittedAt: new Date(),
        },
      }
    );

    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false });
  }
};

/* ================== JOIN EXAM ================== */
exports.joinExam = async (req, res) => {
  try {
    const { userId } = req.body;
    const exam = await getCurrentExam();

    if (exam.status !== "live") {
      return res.status(400).json({
        success: false,
        message: "Exam not live",
      });
    }

    const now = new Date();
    const remainingSeconds = Math.max(
      Math.floor((exam.endTime - now) / 1000),
      0
    );

    const submission = await Submission.findOneAndUpdate(
      { user: userId, exam: exam._id },
      {
        $setOnInsert: {
          user: userId,
          exam: exam._id,
          startedAt: now,
          submissions: [],
        },
      },
      { new: true, upsert: true }
    );

    res.json({
      success: true,
      remainingSeconds,
      isDisqualified: submission.isDisqualified,
    });
  } catch {
    res.status(500).json({ success: false });
  }
};

/* ================== TAB SWITCH ================== */
exports.updateTabCount = async (req, res) => {
  try {
    const { userId } = req.body;
    const exam = await getCurrentExam();

    const submission = await Submission.findOneAndUpdate(
      { user: userId, exam: exam._id, isSubmitted: false },
      { $inc: { tabSwitchCount: 1 } },
      { new: true }
    );

    if (!submission) {
      return res.status(404).json({ message: "No active submission" });
    }

    if (submission.tabSwitchCount >= 3 && !submission.isDisqualified) {
      submission.isDisqualified = true;
      submission.disqualificationReason = "Multiple tab switches detected";
      await submission.save();
    }

    res.json({
      success: true,
      tabCount: submission.tabSwitchCount,
      isDisqualified: submission.isDisqualified,
    });
  } catch {
    res.status(500).json({ success: false });
  }
};

/* ================== SUBMIT EXAM ================== */
exports.submitExam = async (req, res) => {
  try {
    const { userId } = req.body;
    const exam = await getCurrentExam();

    const submission = await Submission.findOne({
      user: userId,
      exam: exam._id,
      isSubmitted: false,
    });

    if (!submission) {
      return res.json({ success: true });
    }

    submission.isSubmitted = true;
    submission.submittedAt = new Date();
    submission.timeTaken = Math.floor(
      (submission.submittedAt - submission.startedAt) / 1000
    );

    // ✅ FINAL SCORE (DQ DOES NOT ERASE PERFORMANCE)
    submission.score = submission.submissions.filter(
      (s) => s.finalVerdict && s.finalVerdict.toUpperCase() === "ACCEPTED"
    ).length;

    await submission.save();
    res.json({ success: true, score: submission.score });
  } catch (err) {
    console.error("submitExam error:", err);
    res.status(500).json({ success: false });
  }
};

/* ================== LEADERBOARD ================== */
exports.getLeaderboard = async (req, res) => {
  try {
    const exam = await Exam.findOne().sort({ createdAt: -1 });
    if (!exam) {
      return res.json({
        success: true,
        leaderboard: [],
        examStatus: "waiting",
      });
    }

    const submissions = await Submission.find({
      exam: exam._id,
      isSubmitted: true,
    })
      .populate("user", "name college questionSet year")
      .lean();

    const safe = submissions.filter((s) => s.user);

    const valid = safe
      .filter((s) => !s.isDisqualified)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.timeTaken - b.timeTaken;
      });

    const dq = safe.filter((s) => s.isDisqualified);

    let rank = 1;

    const leaderboard = [
      ...valid.map((s) => ({
        rank: rank++,
        name: s.user.name,
        college: s.user.college,
        year: s.user.year,
        division: s.user.questionSet,
        score: s.score,
        timeTaken: s.timeTaken,
        isDisqualified: false,
      })),
      ...dq.map((s) => ({
        rank: "DQ",
        name: s.user.name,
        college: s.user.college,
        year: s.user.year,
        division: s.user.questionSet,
        score: s.score,
        timeTaken: s.timeTaken,
        isDisqualified: true,
        reason: s.disqualificationReason || "Security violation",
      })),
    ];

    return res.json({
      success: true,
      leaderboard,
      examStatus: exam.status,
    });
  } catch (err) {
    console.error("Leaderboard crash:", err);
    return res.status(500).json({ success: false });
  }
};

/* ================== RESET ================== */
exports.resetEvent = async (req, res) => {
  try {
    await Exam.deleteMany({});
    await Submission.deleteMany({});
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false });
  }
};
