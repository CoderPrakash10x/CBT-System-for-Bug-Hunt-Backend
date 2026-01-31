const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");

const connectDB = require("./config/db");
const authRoutes = require("./routes/auth.routes");
const examRoutes = require("./routes/exam.routes");
const questionRoutes = require("./routes/question.routes");
const leaderboardRoutes = require("./routes/leaderboard.routes");
const adminRoutes = require("./routes/admin.routes");

dotenv.config();

const app = express();
const corsOptions = {
  origin: [
    "https://cbt-system-for-bug-hunt-frontend.vercel.app", // Main domain
    "https://cbt-system-for-bug-hunt-frontend-exp11ds82.vercel.app", // Current deployment URL from screenshot
    "http://localhost:5173"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-admin-key"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(cors(corsOptions));
app.use(express.json());



// test route
app.get("/ping", (req, res) => {
  res.json({
    success: true,
    message: "Bug Hunt Backend is running 🚀",
  });
});

// routes
app.use("/api/auth", authRoutes);
app.use("/api/exam", examRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/admin", adminRoutes);

// start server AFTER db connect
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});