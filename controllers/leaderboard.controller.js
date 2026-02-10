const Submission = require("../models/Submission");
const Exam = require("../models/Exam");

exports.getLeaderboard = async (req, res) => {
  try {
    const exam = await Exam.findOne();
    if (!exam) {
      return res.status(404).json({ success: false, message: "Exam not found" });
    }

    const adminKey = req.headers["x-admin-key"];
    const isAdmin = adminKey && adminKey === process.env.ADMIN_KEY;

    if (!isAdmin && exam.status !== "ended") {
      return res.status(403).json({
        success: false,
        message: "Leaderboard will be available after exam ends",
      });
    }

    // Fetch and Sort: Non-DQ first, then highest Score, then lowest Time
    const leaderboard = await Submission.find({ isSubmitted: true })
      .populate("user", "name college questionSet year")
      .sort({
        isDisqualified: 1, 
        score: -1,         
        timeTaken: 1,      
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
          year: item.user.year,
          division: item.user.questionSet, // "A" for Juniors, "B" for Seniors
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
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};