const Question = require("../models/Question");
const User = require("../models/User");

exports.getQuestions = async (req, res) => {
  try {
    const { userId } = req.query;

    /* ================= BASIC CHECKS ================= */
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID required",
      });
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    /* ================= FINAL RULE =================
       - questionSet → ONLY year based
       - language → ONLY code selection
    ================================================ */

    const questionSet = user.questionSet; // "A" or "B"
    const language = user.language;       // "java" | "python" | "c"

    /* ================= FETCH QUESTIONS ================= */
    const questions = await Question.find({
      questionSet,
      isActive: true,
    }).lean();

    /* ================= FORMAT RESPONSE ================= */
    const formattedQuestions = questions
      .map((q) => {
        const langBlock = q.languages?.[language];

        // agar kisi question me us language ka code hi nahi hai
        if (!langBlock || !langBlock.buggyCode) {
          return null;
        }

        return {
          _id: q._id,
          questionCode: q.questionCode,
          problemStatement: q.problemStatement,
          constraints: q.constraints || [],
          examples: q.examples || [],
          buggyCode: langBlock.buggyCode,
          language,
        };
      })
      .filter(Boolean);

    /* ================= FINAL RESPONSE ================= */
    return res.json({
      success: true,
      count: formattedQuestions.length,
      questions: formattedQuestions,
    });

  } catch (err) {
    console.error("Get Questions Error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
