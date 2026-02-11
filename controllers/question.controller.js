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

    /* ================= FINAL RULE ================= */
    const questionSet = user.questionSet;          // "A" | "B"
    const language = user.language?.toLowerCase(); // 🔥 FIX

    /* ================= FETCH QUESTIONS ================= */
    const rawQuestions = await Question.find({
      questionSet,
      isActive: true,
    }).lean();

    console.log("RAW QUESTIONS:", rawQuestions.length);

    // 🔀 SHUFFLE (ANTI-CHEAT)
    const shuffled = rawQuestions.sort(() => Math.random() - 0.5);

    /* ================= FORMAT RESPONSE ================= */
    const formattedQuestions = shuffled
      .map((q) => {
        const langBlock = q.languages?.[language];

        // ❌ Skip if language missing or buggyCode empty
        if (!langBlock || !langBlock.buggyCode) {
          console.log(
            `SKIPPED QUESTION ${q.questionCode} | language=${language}`
          );
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

    console.log("QUESTIONS SENT:", formattedQuestions.length);

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
