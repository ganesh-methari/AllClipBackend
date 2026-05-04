const express = require("express");
const cors = require("cors");
const musicRoutes = require("./socialMedia/musicDown");

const app = express();

/* ✅ VERY IMPORTANT — GLOBAL CORS (handles preflight automatically) */
app.use(cors());

/* ✅ Middleware */
app.use(express.json());

/* ✅ Routes */
app.use("/music", musicRoutes);

/* ✅ Test route */
app.get("/", (req, res) => {
  res.send("🚀 API Running");
});

/* ✅ Start server */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});