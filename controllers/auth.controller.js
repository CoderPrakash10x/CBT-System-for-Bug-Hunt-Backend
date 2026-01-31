const User = require("../models/User");

exports.registerUser = async (req, res) => {
  try {
    const { name, email, college } = req.body;

    if (!name || !email || !college) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ success: false, message: "Email already exists" });
    }

    const user = await User.create({ name, email: email.toLowerCase(), college });

    return res.status(201).json({
      success: true,
      message: "Registered!",
      userId: user._id.toString(),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};