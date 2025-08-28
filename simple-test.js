// simple-test.js - Minimal test server
import express from "express";
import cors from "cors";

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Test route
app.get("/", (req, res) => {
  res.json({ message: "Simple test server is working!" });
});

app.get("/test", (req, res) => {
  res.json({ message: "Test endpoint is working!" });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Simple test server running at http://localhost:${PORT}`);
  console.log(`✅ Test endpoint: http://localhost:${PORT}/test`);
});

