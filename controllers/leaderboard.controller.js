const Submission = require("../models/Submission");

exports.getLeaderboard = async (req, res) => {
  try {
    const leaderboard = await Submission.find({ isSubmitted: true })
      .populate("user", "name email college")
      .sort({
        isDisqualified: 1, // false (0) pehle, true (1) baad mein
        score: -1,         // Fir high score
        timeTaken: 1,      // Fir kam time
      });

    const result = leaderboard
      .filter(item => item.user)
      .map((item, index) => {
        // Agar disqualified hai toh rank "DQ" hogi
        const displayRank = item.isDisqualified ? "DQ" : index + 1;
        
        return {
          rank: displayRank,
          name: item.user.name,
          college: item.user.college,
          score: item.score,
          timeTaken: item.timeTaken,
          isDisqualified: item.isDisqualified,
          reason: item.disqualificationReason
        };
      });

    res.json({ success: true, leaderboard: result });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};