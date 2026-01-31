const mongoose = require("mongoose");
const Exam = require("../models/Exam");
const Submission = require("../models/Submission");
const Question = require("../models/Question");
const User = require("../models/User");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const getOrCreateExam = async () => {
  let exam = await Exam.findOne();
  if (!exam) {
    exam = await Exam.create({
      status: "waiting",
      duration: 60,
    });
  }
  return exam;
};

exports.getExam = async (req, res) => {
  try {
    const exam = await getOrCreateExam();
    res.json({ success: true, exam });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

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
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

exports.endExam = async (req, res) => {
  try {
    const exam = await getOrCreateExam();
    exam.status = "ended";
    exam.endTime = new Date();
    await exam.save();
    await Submission.updateMany(
      { isSubmitted: false },
      { $set: { isSubmitted: true, submittedAt: new Date() } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};
exports.joinExam = async (req, res) => {
  try {
    const { userId } = req.body;
    
    // Safety check for ID
    if (!userId || !isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: "Invalid or missing User ID" });
    }

    const exam = await getOrCreateExam();
    if (exam.status !== "live") {
      return res.status(400).json({ success: false, status: exam.status, message: "Exam is not live" });
    }

    // Try to find existing or create new
    let submission = await Submission.findOne({ user: userId, exam: exam._id });
    
    if (!submission) {
      submission = await Submission.create({
        user: userId,
        exam: exam._id,
        startedAt: new Date(),
        answers: [],
      });
    }

    const remainingSeconds = Math.max(Math.floor((exam.endTime - new Date()) / 1000), 0);
    
    res.json({ 
      success: true, 
      remainingSeconds,
      submissionId: submission._id // For tracking if needed
    });
  } catch (err) {
    console.error("JOIN ERROR:", err);
    res.status(500).json({ success: false, message: "Database error during join" });
  }
};
exports.saveAnswer = async (req, res) => {
  try {
    const { userId, questionId, selectedOption } = req.body;
    if (!isValidObjectId(userId) || !isValidObjectId(questionId)) {
      return res.status(400).json({ message: "Invalid IDs" });
    }

    const exam = await getOrCreateExam();
    if (exam.status !== "live") {
      return res.status(403).json({ 
        success: false, 
        message: "Exam has ended. You cannot save answers anymore." 
      });
    }

    const submission = await Submission.findOne({ user: userId, isSubmitted: false });
    if (!submission) return res.status(404).json({ message: "No active session" });

    const existingIndex = submission.answers.findIndex(a => a.questionId.toString() === questionId.toString());

    if (existingIndex > -1) {
      submission.answers[existingIndex].selectedOption = selectedOption;
    } else {
      submission.answers.push({ questionId, selectedOption });
    }

    await submission.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

exports.submitExam = async (req, res) => {
  try {
    const { userId, disqualified } = req.body;
    const submission = await Submission.findOne({ user: userId, isSubmitted: false });
    if (!submission) return res.json({ success: true, message: "Already submitted" });

    let score = 0;
    if (!disqualified) {
      const questions = await Question.find({ isActive: true });
      submission.answers.forEach((ans) => {
        const q = questions.find(qq => qq._id.toString() === ans.questionId.toString());
        if (q && q.correctIndex === ans.selectedOption) score++;
      });
    }

    submission.score = disqualified ? 0 : score;
    submission.isDisqualified = !!disqualified;
    submission.isSubmitted = true;
    submission.submittedAt = new Date();
    submission.timeTaken = Math.floor((submission.submittedAt - submission.startedAt) / 1000);

    await submission.save();
    res.json({ success: true, score: submission.score });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

exports.resetEvent = async (req, res) => {
  try {
    const exam = await getOrCreateExam();
    exam.status = "waiting";
    exam.startTime = null;
    exam.endTime = null;
    await exam.save();
    await Submission.deleteMany({});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};