const express = require("express");
const cors = require("cors");
const musicRoutes = require("./socialMedia/musicDown"); // Import the combined routes

const app = express();

const cors = require("cors");

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://all-clip-frontend.vercel.app"
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json());

app.use("/music", musicRoutes);

app.get("/", (req, res) => {
  res.send("🚀 API Running");
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});