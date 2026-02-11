const Exam = require("../models/Exam");
const Submission = require("../models/Submission");

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

    const adminKey = req.headers["x-admin-key"];
    const isAdmin = adminKey && adminKey === process.env.ADMIN_KEY;

    if (!isAdmin && exam.status !== "ended") {
      return res.status(403).json({
        success: false,
        message: "Leaderboard will be available after exam ends",
      });
    }

    const submissions = await Submission.find({
      exam: exam._id,
      isSubmitted: true,
    })
      .populate("user", "name college questionSet year")
      .lean();

    // 🔒 safety
    const safe = submissions.filter(s => s.user);

    const valid = safe
      .filter(s => !s.isDisqualified)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.timeTaken - b.timeTaken;
      });

    const dq = safe.filter(s => s.isDisqualified);

    let rank = 1;

    const leaderboard = [
      ...valid.map(s => ({
        rank: rank++,
        name: s.user.name,
        college: s.user.college,
        year: s.user.year,
        division: s.user.questionSet,
        score: s.score,
        timeTaken: s.timeTaken,
        isDisqualified: false,
      })),
      ...dq.map(s => ({
        rank: "DQ",
        name: s.user.name,
        college: s.user.college,
        year: s.user.year,
        division: s.user.questionSet,
        score: s.score, // ✅ score preserved
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
    console.error("Leaderboard Error:", err);
    return res.status(500).json({
      success: false,
      message: "Leaderboard failed",
    });
  }
};
