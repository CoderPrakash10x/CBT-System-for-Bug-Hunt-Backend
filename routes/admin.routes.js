const express = require("express");
const router = express.Router();

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

module.exports = router;
