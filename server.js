const express = require("express");
const cors = require("cors");
const musicRoutes = require("./socialMedia/musicDown"); // Import the combined routes

const app = express();


app.use(cors()); //  allow all (for now)

app.use(express.json());

app.use("/music", musicRoutes);

app.get("/", (req, res) => {
  res.send("🚀 API Running");
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});