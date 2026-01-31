const Question = require("../models/Question");

// GET ALL QUESTIONS (FOR EXAM)
exports.getQuestions = async (req, res) => {
  try {
    const questions = await Question.find({ isActive: true })
      .select("-correctIndex -explanation");

    res.json({
      success: true,
      questions,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
