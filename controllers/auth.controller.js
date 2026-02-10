const User = require("../models/User");

exports.registerUser = async (req, res) => {
  try {
    // 1. Trim input to avoid space-related errors
    const name = req.body.name?.trim();
    const email = req.body.email?.trim().toLowerCase();
    const college = req.body.college?.trim();
    const { year, language } = req.body;

    // 🔒 BASIC VALIDATION
    if (!name || !email || !college || !year || !language) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // 🔒 YEAR VALIDATION
    const yearNum = Number(year);
    if (![1, 2, 3, 4].includes(yearNum)) {
      return res.status(400).json({
        success: false,
        message: "Invalid academic year (1-4 only)",
      });
    }

    // 🔒 LANGUAGE VALIDATION
    if (!["python", "java", "c"].includes(language)) {
      return res.status(400).json({
        success: false,
        message: "Invalid programming language selection",
      });
    }

    // 🔒 EMAIL CHECK
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "This email is already registered",
      });
    }

    // 🔥 AUTO QUESTION SET ASSIGNMENT
    const questionSet = yearNum <= 2 ? "A" : "B";

    // ✅ CREATE USER
    const user = await User.create({
      name,
      email,
      college,
      year: yearNum,
      language,
      questionSet, 
    });

    return res.status(201).json({
      success: true,
      message: "Registered successfully",
      userId: user._id.toString(),
    });
  } catch (error) {
    console.error("Register Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during registration",
    });
  }
};