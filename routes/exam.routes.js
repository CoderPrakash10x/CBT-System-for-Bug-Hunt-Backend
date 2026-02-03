const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/exam.controller");
const adminAuth = require("../middlewares/adminAuth");

// USER
router.get("/", ctrl.getExam);
router.post("/join", ctrl.joinExam);
router.post("/answer", ctrl.saveAnswer);
router.post("/submit", ctrl.submitExam);

// ADMIN
router.post("/start", adminAuth, ctrl.startExam);
router.post("/end", adminAuth, ctrl.endExam);
router.post("/reset", adminAuth, ctrl.resetEvent);
router.post("/update-tab-count", ctrl.updateTabCount);

module.exports = router;
