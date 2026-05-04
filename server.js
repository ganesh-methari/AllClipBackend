const express = require("express");
const app = express();

/* 🔥 HARD CORS FIX (no issues ever) */
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

app.use(express.json());

/*  ROUTES */
app.use("/music", require("./socialMedia/musicDown"));

/*  TEST */
app.get("/", (req, res) => {
  res.send("🚀 API Running");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("✅ Server running on", PORT));