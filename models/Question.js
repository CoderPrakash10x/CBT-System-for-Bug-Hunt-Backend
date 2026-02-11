const mongoose = require("mongoose");

/* ================= LANGUAGE BLOCK ================= */
const languageBlockSchema = new mongoose.Schema(
  {
    buggyCode: {
      type: String,
      required: true,
    },

    wrapperCode: {
      type: String,
      default: "",   // ✅ SAFE fallback
    },

    // 🔒 Hidden test cases (Judge0 ke liye)
    testCases: [
      {
        input: {
          type: String,
          required: true,
        },
        output: {
          type: String,
          required: true,
        },
      },
    ],
  },
  { _id: false }
);

/* ================= QUESTION SCHEMA ================= */
const questionSchema = new mongoose.Schema(
  {
    // 🔖 Question Code (PDF style: J1 / P2 / C3)
    questionCode: {
      type: String,
      required: true,
      trim: true,
    },

    // 🧠 Problem Statement (common for all languages)
    problemStatement: {
      type: String,
      required: true,
      trim: true,
    },

    // 📏 Constraints (PDF format)
    constraints: {
      type: [String],
      default: [],
    },

    // 📘 Examples (Input / Output)
    examples: {
      type: [
        {
          input: { type: String },
          output: { type: String },
        },
      ],
      default: [],
    },

    // 🔥 Question Set (Year based)
    questionSet: {
      type: String,
      enum: ["A", "B"],
      required: true,
    },

    // 💻 Language-wise buggy code + testcases
    languages: {
      python: {
        type: languageBlockSchema,
        required: false,
      },
      java: {
        type: languageBlockSchema,
        required: false,
      },
      c: {
        type: languageBlockSchema,
        required: false,
      },
    },

    // 🔧 Admin control
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Question", questionSchema);
