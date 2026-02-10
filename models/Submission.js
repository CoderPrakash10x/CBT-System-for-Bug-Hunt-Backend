const mongoose = require("mongoose");

const attemptSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
    },

    verdict: {
      type: String,
      enum: [
        "PENDING",
        "ACCEPTED",
        "WRONG_ANSWER",
        "COMPILE_ERROR",
        "RUNTIME_ERROR",
        "TIME_LIMIT_EXCEEDED",
      ],
      default: "PENDING",
    },

    executedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const questionSubmissionSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: true,
    },

    // 🔁 ALL ATTEMPTS (history)
    attempts: {
      type: [attemptSchema],
      default: [],
    },

    // 🔒 FINAL STATE (for scoring & reports)
    finalCode: {
      type: String,
      default: "",
    },

    finalVerdict: {
      type: String,
      enum: [
        "PENDING",
        "ACCEPTED",
        "WRONG_ANSWER",
        "COMPILE_ERROR",
        "RUNTIME_ERROR",
        "TIME_LIMIT_EXCEEDED",
      ],
      default: "PENDING",
    },

    lastExecutedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const submissionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    exam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: true,
    },

    startedAt: {
      type: Date,
      default: Date.now,
    },

    submittedAt: {
      type: Date,
      default: null,
    },

    isSubmitted: {
      type: Boolean,
      default: false,
    },

    // 🔥 PER QUESTION SUBMISSIONS
    submissions: {
      type: [questionSubmissionSchema],
      default: [],
    },

    // 🔢 FINAL SCORE (sirf ACCEPTED count)
    score: {
      type: Number,
      default: 0,
    },

    // ⚠️ ANTI-CHEAT
    tabSwitchCount: {
      type: Number,
      default: 0,
    },

    isDisqualified: {
      type: Boolean,
      default: false,
    },

    disqualificationReason: {
      type: String,
      default: "",
    },

    timeTaken: {
      type: Number, // seconds
      default: 0,
    },
  },
  { timestamps: true }
);

// ✅ One submission per user per exam
submissionSchema.index({ user: 1, exam: 1 }, { unique: true });

module.exports = mongoose.model("Submission", submissionSchema);
