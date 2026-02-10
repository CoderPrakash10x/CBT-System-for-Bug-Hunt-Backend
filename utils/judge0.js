const axios = require("axios");

const JUDGE0_URL = "https://ce.judge0.com/submissions";
const JUDGE0_HEADERS = {
  "Content-Type": "application/json",
  "X-Auth-Token": process.env.JUDGE0_API_KEY // Agar key hai toh yahan dalna
};

const LANGUAGE_MAP = {
  c: 50,      // C (GCC)
  java: 62,   // Java
  python: 71, // Python
};

const submitToJudge0 = async ({ sourceCode, language, stdin, expectedOutput }) => {
  try {
    const res = await axios.post(
      `${JUDGE0_URL}?base64_encoded=false&wait=true`,
      {
        source_code: sourceCode,
        language_id: LANGUAGE_MAP[language],
        stdin,
        expected_output: expectedOutput,
      },
      { headers: JUDGE0_HEADERS }
    );

    // Judge0 verdict code 3 means 'Accepted'
    return res.data;
  } catch (err) {
    console.error("Judge0 API Error:", err.response?.data || err.message);
    throw new Error("Compiler Service Unavailable");
  }
};

module.exports = { submitToJudge0 };