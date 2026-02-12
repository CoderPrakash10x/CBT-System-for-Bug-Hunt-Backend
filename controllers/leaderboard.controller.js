const Exam = require("../models/Exam");
const Submission = require("../models/Submission");

exports.getLeaderboard = async (req, res) => {
  try {
    const exam = await Exam.findOne().sort({ createdAt: -1 });

    if (!exam) {
      return res.json({ success: true, leaderboard: [], examStatus: "waiting" });
    }

    const adminKey = req.headers["x-admin-key"];
    const isAdmin = adminKey && adminKey === process.env.ADMIN_KEY;

    // 🔒 Security: Agar exam live hai toh sirf admin dekh paye, users ko "ended" ke baad dikhe
    if (!isAdmin && exam.status !== "ended") {
      return res.status(403).json({
        success: false,
        message: "Leaderboard will be available after exam ends",
      });
    }

    // 🔥 FIX: Sirf unhe dikhao jinka user object valid ho
    // .lean() use karne se speed badhti hai
    const submissions = await Submission.find({ exam: exam._id })
      .populate("user", "name college questionSet year")
      .lean();

    // 🔒 Filter out submissions without a valid user (Safety check)
    const activeSubmissions = submissions.filter(s => s.user);

    // 1️⃣ Valid (Non-Disqualified) Students: Sorting Logic (Score high -> Time low)
    const valid = activeSubmissions
      .filter(s => !s.isDisqualified)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (a.timeTaken || 0) - (b.timeTaken || 0); // Less time is better
      });

    // 2️⃣ Disqualified Students
    const dq = activeSubmissions.filter(s => s.isDisqualified);

    let rank = 1;

    // 3️⃣ Final Map with Rank
    const rankedValid = valid.map(s => ({
      rank: rank++,
      name: s.user.name,
      college: s.user.college,
      year: s.user.year,
      division: s.user.questionSet,
      score: s.score || 0,
      timeTaken: s.timeTaken || 0,
      isDisqualified: false,
      isSubmitted: s.isSubmitted // Helpful to see live status for Admin
    }));

    const rankedDQ = dq.map(s => ({
      rank: "DQ",
      name: s.user.name,
      college: s.user.college,
      year: s.user.year,
      division: s.user.questionSet,
      score: s.score || 0,
      timeTaken: s.timeTaken || 0,
      isDisqualified: true,
      reason: s.disqualificationReason || "Security violation",
    }));

    return res.json({
      success: true,
      leaderboard: [...rankedValid, ...rankedDQ],
      examStatus: exam.status,
    });
  } catch (err) {
    console.error("Leaderboard Error:", err);
    return res.status(500).json({ success: false, message: "Leaderboard failed" });
  }
};