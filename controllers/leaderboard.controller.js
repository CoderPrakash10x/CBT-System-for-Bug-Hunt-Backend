const Submission = require("../models/Submission");

exports.getLeaderboard = async (req, res) => {
  try {
    const leaderboard = await Submission.find({ isSubmitted: true })
      .populate("user", "name email college")
      .sort({
        isDisqualified: 1, // Qualified first
        score: -1,         // Higher score
        timeTaken: 1,      // Less time
      });

    const result = leaderboard
      .filter(item => item.user) // Safety check
      .map((item, index) => ({
        rank: index + 1,
        name: item.user.name,
        college: item.user.college,
        score: item.score,
        timeTaken: item.timeTaken,
        isDisqualified: item.isDisqualified
      }));

    res.json({ success: true, leaderboard: result });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};