/* ======================================================
   ENV CONFIG & IMPORTS
====================================================== */
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const multer = require("multer");
const dotenv = require("dotenv");
const dns = require("dns");

// Load environment variables
const fs = require("fs");
const path = require("path");

if (fs.existsSync(path.resolve(__dirname, ".env.local"))) {
  dotenv.config({ path: ".env.local" });
} else {
  dotenv.config();
}

dns.setDefaultResultOrder("ipv4first");

// Import routes
const chatRoutes = require("./src/routes/chat.routes");
const shopRoutes = require("./src/routes/shop.routes");
const newsRoutes = require("./src/routes/news.routes");
const authRoutes = require("./src/routes/auth.routes");
const historyRoutes = require("./src/routes/history.routes");
const imageRoutes = require("./src/routes/image.routes");

/* ======================================================
   EXPRESS INIT
====================================================== */
const app = express();

/* -------------------- Global Middleware -------------------- */
app.use(helmet());
app.use(
  cors({
    origin: [
      "http://localhost:19006",
      "http://localhost:3000",
      "http://192.168.1.103:19006",
      "exp://192.168.1.103:19000",
      "http://10.0.2.2:3000",
      "http://localhost:8081",
      "http://192.168.1.103:3000",
      "http://localhost:19000",
      "exp://localhost:19000",
      "http://localhost:8081", // For Expo web
      "http://127.0.0.1:8081", // For local web
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// Handle preflight requests
app.options("/", cors());

/* ======================================================
   MULTER CONFIG
====================================================== */
const upload = multer({
  storage: multer.memoryStorage(),  
  limits: { fileSize: 10 * 1024 * 1024 },
});

/* ======================================================
   MOUNT ROUTES
====================================================== */

// Mount API routes
app.use("/api/chat", chatRoutes);
app.use("/api/shops", shopRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/image", imageRoutes);

// Additional direct routes (legacy - will be moved to routers)
// app.post(
//   "/api/image/analyze-base64",
//   require("./src/controllers/chat.controller").analyzeImageBase64,
// // );
// app.post(
//   "/api/image/analyze",
//   upload.single("image"),
//   require("./src/controllers/chat.controller").analyzeImageMultipart,
// );
// app.get(
//   "/api/history/:userId",
//   require("./src/middleware/auth.middleware").authenticate,
//   require("./src/controllers/chat.controller").getChatHistory,
// );

/* ======================================================
   HEALTH & DEBUG ENDPOINTS
====================================================== */
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date(),
    service: "agriculture-api",
    version: "1.0.0",
    routes: {
      chat: "/api/chat",
      shops: "/api/shops",
      news: "/api/news",
      health: "/health",
      debug: "/debug",
    },
  });
});

app.get("/debug", (req, res) => {
  res.json({
    success: true,
    timestamp: new Date(),
    message: "Debug endpoint working",
    headers: req.headers,
    ip: req.ip,
    url: req.url,
  });
});

app.get("/network-test", (req, res) => {
  res.json({
    success: true,
    message: "Backend is reachable!",
    timestamp: new Date(),
    yourIP: req.ip,
    serverIP: "192.168.1.104",
    instructions: "If you can see this, network is working correctly",
  });
});

// API info endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Agriculture API Server",
    version: "1.0.0",
    endpoints: {
      news: "/api/news",
      chat: "/api/chat",
      shops: "/api/shops",
      health: "/health",
      debug: "/debug",
    },
  });
});

/* ======================================================
   ERROR HANDLER
====================================================== */
app.use((err, req, res, next) => {
  console.error("API ERROR:", {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  const statusCode = err.statusCode || 500;
  const errorResponse = {
    success: false,
    error: "Internal server error",
    message: err.message,
  };

  // Hide stack trace in production
  if (process.env.NODE_ENV === "development") {
    errorResponse.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
    message: `Cannot ${req.method} ${req.url}`,
  });
});

/* ======================================================
   SERVER START
====================================================== */
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";

if (require.main === module) {
  app.listen(PORT, HOST, () => {
    console.log(`🚀 Server running on http://${HOST}:${PORT}`);
    console.log(`📡 Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`🔗 Health check: http://${HOST}:${PORT}/health`);
    console.log(`🌐 Network URL: http://192.168.1.104:${PORT}`);
    console.log(`📊 API Endpoints:`);
    console.log(`   - News: http://${HOST}:${PORT}/api/news`);
    console.log(`   - Chat: http://${HOST}:${PORT}/api/chat`);
    console.log(`   - Shops: http://${HOST}:${PORT}/api/shops`);
  });
}

module.exports = app;
