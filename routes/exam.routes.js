const express = require("express");
const router = express.Router();

const examCtrl = require("../controllers/exam.controller");
const { submitCode } = require("../controllers/code.controller");
const adminAuth = require("../middlewares/adminAuth");

// ================== USER ROUTES ==================

// Get exam status
router.get("/", examCtrl.getExam);

// Join exam (creates submission)
router.post("/join", examCtrl.joinExam);

// Submit code for a question
router.post("/submit-code", submitCode);

// Manually submit exam
router.post("/submit", examCtrl.submitExam);

// Update tab switch count
router.post("/update-tab-count", examCtrl.updateTabCount);

// ================== ADMIN ROUTES ==================

router.post("/start", adminAuth, examCtrl.startExam);
router.post("/end", adminAuth, examCtrl.endExam);
router.post("/reset", adminAuth, examCtrl.resetEvent);

module.exports = router;
