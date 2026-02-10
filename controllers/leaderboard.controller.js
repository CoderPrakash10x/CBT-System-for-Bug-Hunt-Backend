const Submission = require("../models/Submission");
const Exam = require("../models/Exam");

exports.getLeaderboard = async (req, res) => {
  try {
    // ================== EXAM STATUS CHECK ==================
    const exam = await Exam.findOne();
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found",
      });
    }

    // Check admin
    const adminKey = req.headers["x-admin-key"];
    const isAdmin = adminKey && adminKey === process.env.ADMIN_KEY;

    // 🔒 BLOCK students until exam ends
    if (!isAdmin && exam.status !== "ended") {
      return res.status(403).json({
        success: false,
        message: "Leaderboard will be available after exam ends",
      });
    }

    // ================== FETCH LEADERBOARD ==================
    const leaderboard = await Submission.find({ isSubmitted: true })
      .populate("user", "name college")
      .sort({
        isDisqualified: 1, // non-DQ first
        score: -1,         // highest score
        timeTaken: 1,      // fastest
      });

    let currentRank = 1;

    const result = leaderboard
      .filter(item => item.user)
      .map(item => {
        let rank;

        if (item.isDisqualified) {
          rank = "DQ";
        } else {
          rank = currentRank;
          currentRank++;
        }

        return {
          rank,
          name: item.user.name,
          college: item.user.college,
          score: item.score,
          timeTaken: item.timeTaken,
          isDisqualified: item.isDisqualified,
          reason: item.disqualificationReason,
        };
      });

    return res.json({
      success: true,
      leaderboard: result,
      examStatus: exam.status,
    });

  } catch (err) {
    console.error("Leaderboard Error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
