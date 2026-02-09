const mongoose = require("mongoose");
const Exam = require("../models/Exam");
const Submission = require("../models/Submission");
const Question = require("../models/Question");

const getOrCreateExam = async () => {
  let exam = await Exam.findOne();
  if (!exam) {
    exam = await Exam.create({ status: "waiting", duration:10 });
  }
  return exam;
};

// ================== GET EXAM ==================
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
    if (exam.status === "live") {
      return res.status(400).json({ message: "Already live" });
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

// ================== END EXAM (🔥 FIXED) ==================
exports.endExam = async (req, res) => {
  try {
    const exam = await getOrCreateExam();
    exam.status = "ended";
    exam.endTime = new Date();
    await exam.save();

    const questions = await Question.find({ isActive: true });
    const submissions = await Submission.find({ isSubmitted: false });

    for (const sub of submissions) {
      let score = 0;

      if (!sub.isDisqualified) {
        sub.answers.forEach((ans) => {
          const q = questions.find(
            (qq) => qq._id.toString() === ans.questionId.toString()
          );
          if (q && q.correctIndex === ans.selectedOption) score++;
        });
      }

      sub.score = sub.isDisqualified ? 0 : score;
      sub.isSubmitted = true;
      sub.submittedAt = new Date();
      sub.timeTaken = Math.floor(
        (sub.submittedAt - sub.startedAt) / 1000
      );

      await sub.save();
    }

    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false });
  }
};

// ================== JOIN EXAM ==================
exports.joinExam = async (req, res) => {
  try {
    const { userId } = req.body;
    const exam = await getOrCreateExam();

    if (exam.status !== "live") {
      return res.status(400).json({ success: false, message: "Not live" });
    }

    const now = new Date();
    const remainingSeconds = Math.max(
      Math.floor((exam.endTime - now) / 1000),
      0
    );

    let submission = await Submission.findOne({
      user: userId,
      exam: exam._id,
    });

    if (!submission) {
      submission = await Submission.create({
        user: userId,
        exam: exam._id,
        startedAt: now,
        answers: [],
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

// ================== TAB COUNT ==================
exports.updateTabCount = async (req, res) => {
  try {
    const { userId } = req.body;

    const submission = await Submission.findOne({
      user: userId,
      isSubmitted: false,
    });

    if (!submission) {
      return res.status(404).json({ message: "No active submission" });
    }

    submission.tabSwitchCount += 1;

    if (submission.tabSwitchCount >= 2) {
      submission.isDisqualified = true;
      submission.disqualificationReason = "Tab Switch Detected";
    }

    await submission.save();

    res.json({
      success: true,
      tabCount: submission.tabSwitchCount,   // ✅ THIS LINE FIXES IT
      isDisqualified: submission.isDisqualified,
    });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

// ================== SAVE ANSWER ==================
exports.saveAnswer = async (req, res) => {
  try {
    const { userId, questionId, selectedOption } = req.body;

    const submission = await Submission.findOne({
      user: userId,
      isSubmitted: false,
    });

    if (!submission || submission.isDisqualified) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const idx = submission.answers.findIndex(
      (a) => a.questionId.toString() === questionId.toString()
    );

    if (idx > -1) {
      submission.answers[idx].selectedOption = selectedOption;
    } else {
      submission.answers.push({ questionId, selectedOption });
    }

    await submission.save();
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false });
  }
};

// ================== SUBMIT EXAM ==================
exports.submitExam = async (req, res) => {
  try {
    const { userId, disqualified, reason } = req.body;

    const submission = await Submission.findOne({
      user: userId,
      isSubmitted: false,
    });

    if (!submission) return res.json({ success: true });

    const questions = await Question.find({ isActive: true });
    let score = 0;

    const isDQ = disqualified || submission.isDisqualified;

    if (!isDQ) {
      submission.answers.forEach((ans) => {
        const q = questions.find(
          (qq) => qq._id.toString() === ans.questionId.toString()
        );
        if (q && q.correctIndex === ans.selectedOption) score++;
      });
    }

    submission.score = isDQ ? 0 : score;
    submission.isDisqualified = isDQ;
    submission.disqualificationReason = isDQ
      ? reason || "Policy Violation"
      : "";
    submission.isSubmitted = true;
    submission.submittedAt = new Date();
    submission.timeTaken = Math.floor(
      (submission.submittedAt - submission.startedAt) / 1000
    );

    await submission.save();

    res.json({
      success: true,
      score: submission.score,
      isDisqualified: isDQ,
    });
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
