const express = require("express");
const cors = require("cors");

const roomRoutes = require("./routes/rooms");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "YouTube Watch Party API is running 🚀",
  });
});

// API Routes
app.use("/api/rooms", roomRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found.",
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);

  res.status(500).json({
    success: false,
    message: "Something went wrong.",
  });
});

module.exports = app;