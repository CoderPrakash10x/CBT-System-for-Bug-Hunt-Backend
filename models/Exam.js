const mongoose = require("mongoose");

const examSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["waiting", "live", "ended"],
      default: "waiting",
    },
    duration: {
      type: Number, // Minutes mein
      required: true,
      default: 60,
    },
    startTime: {
      type: Date,
      default: null,
    },
    endTime: {
      type: Date,
      default: null,
    },
    totalQuestions: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Exam", examSchema);