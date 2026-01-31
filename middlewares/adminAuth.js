module.exports = (req, res, next) => {
  const key = req.headers["x-admin-key"];

  if (!key) {
    return res.status(401).json({
      success: false,
      message: "Admin key missing",
    });
  }

  if (key !== process.env.ADMIN_KEY) {
    return res.status(401).json({
      success: false,
      message: "Invalid admin key",
    });
  }

  next();
};
