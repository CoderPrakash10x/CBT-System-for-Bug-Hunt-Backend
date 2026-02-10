const Exam = require("../models/Exam");
const Submission = require("../models/Submission");

// ================== GET OR CREATE EXAM ==================
const getOrCreateExam = async () => {
  let exam = await Exam.findOne();
  if (!exam) {
    exam = await Exam.create({
      status: "waiting",
      duration: 10, // minutes
    });
  }
  return exam;
};

exports.getExam = async (req, res) => {
  try {
    const exam = await getOrCreateExam();
    res.json({ success: true, exam });
  } catch {
    res.status(500).json({ success: false });
  }
};

// ================== START EXAM ==================
exports.startExam = async (req, res) => {
  try {
    const exam = await getOrCreateExam();
    if (exam.status === "live") return res.status(400).json({ message: "Exam already live" });

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

// ================== END EXAM (FIXED BULK UPDATE) ==================
exports.endExam = async (req, res) => {
  try {
    const exam = await getOrCreateExam();
    exam.status = "ended";
    exam.endTime = new Date();
    await exam.save();

    // 🔥 FASTER: Un-submitted exams ko batch mein band karo
    // Note: Score aur timeTaken calculations hum final leaderboard fetch pe bhi handle kar sakte hain 
    // agar yahan complex calculations se bachna hai.
    await Submission.updateMany(
      { isSubmitted: false },
      { 
        $set: { 
          isSubmitted: true, 
          submittedAt: new Date() 
        } 
      }
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

// ================== JOIN EXAM ==================
exports.joinExam = async (req, res) => {
  try {
    const { userId } = req.body;
    const exam = await getOrCreateExam();

    if (exam.status !== "live") {
      return res.status(400).json({ success: false, message: "Exam not live" });
    }

    const now = new Date();
    const remainingSeconds = Math.max(Math.floor((exam.endTime - now) / 1000), 0);

    // Lean for performance
    let submission = await Submission.findOne({ user: userId, exam: exam._id });

    if (!submission) {
      submission = await Submission.create({
        user: userId,
        exam: exam._id,
        startedAt: now,
        submissions: [],
      });
    }

    res.json({
      success: true,
      remainingSeconds,
      isDisqualified: submission.isDisqualified,
    });
  } catch {
    res.status(500).json({ success: false });
  }
};

// ================== TAB SWITCH (OPTIMIZED) ==================
exports.updateTabCount = async (req, res) => {
  try {
    const { userId } = req.body;
    
    // Direct update to DB to avoid race conditions
    const submission = await Submission.findOneAndUpdate(
      { user: userId, isSubmitted: false },
      { $inc: { tabSwitchCount: 1 } },
      { new: true }
    );

    if (!submission) return res.status(404).json({ message: "No active submission" });

    // DQ Logic: 3 switches allow karte hain, 4th pe DQ (Thoda linear rakhte hain)
    if (submission.tabSwitchCount >= 4 && !submission.isDisqualified) {
      submission.isDisqualified = true;
      submission.disqualificationReason = "Excessive Tab Switching";
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

// ================== SUBMIT EXAM (MANUAL) ==================
exports.submitExam = async (req, res) => {
  try {
    const { userId } = req.body;
    const submission = await Submission.findOne({ user: userId, isSubmitted: false });

    if (!submission) return res.json({ success: true });

    submission.isSubmitted = true;
    submission.submittedAt = new Date();
    
    // Seconds calculation
    submission.timeTaken = Math.floor((submission.submittedAt - submission.startedAt) / 1000);

    // Score calculation
    submission.score = submission.isDisqualified ? 0 : 
      submission.submissions.filter(s => s.verdict === "ACCEPTED").length;

    await submission.save();
    res.json({ success: true, score: submission.score });
  } catch {
    res.status(500).json({ success: false });
  }
};

// ================== RESET EVENT ==================
exports.resetEvent = async (req, res) => {
  try {
    const exam = await getOrCreateExam();
    exam.status = "waiting";
    exam.startTime = null;
    exam.endTime = null;
    await exam.save();
    await Submission.deleteMany({});
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false });
  }
};