const express = require("express");
const router = express.Router();

const adminAuth = require("../middlewares/adminAuth");
const {
  getUserReport,
  downloadUserReport,
  getAllSubmissionsSummary,
} = require("../controllers/adminReport.controller");

/* ================= ADMIN VERIFY ================= */
router.post("/verify", (req, res) => {
  const key = req.headers["x-admin-key"];

  if (!key || key !== process.env.ADMIN_KEY) {
    return res.status(401).json({
      success: false,
      message: "Invalid admin key",
    });
  }

  res.json({ success: true });
});

/* ================= REPORT ROUTES ================= */

// 🔍 Single user detailed report (JSON – UI ke liye)
router.get("/report/:userId", adminAuth, getUserReport);

// 📥 Single user PDF download
router.get(
  "/report/:userId/download",
  adminAuth,
  downloadUserReport
);

// 📊 All submissions summary (left panel list)
router.get(
  "/submissions",
  adminAuth,
  getAllSubmissionsSummary
);

module.exports = router;
