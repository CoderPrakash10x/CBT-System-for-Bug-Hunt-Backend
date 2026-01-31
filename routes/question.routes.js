const express = require("express");
const router = express.Router();
const { getQuestions } = require("../controllers/question.controller");

router.get("/", getQuestions);

module.exports = router;
