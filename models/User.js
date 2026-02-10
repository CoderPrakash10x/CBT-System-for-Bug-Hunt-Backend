const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, unique: true, trim: true },
    college: { type: String, required: true, trim: true },
    
    year: { type: Number, required: true }, 
    language: { type: String, required: true, enum: ["python", "java", "c"] },
    questionSet: { type: String, required: true, enum: ["A", "B"] },

    isSubmitted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);