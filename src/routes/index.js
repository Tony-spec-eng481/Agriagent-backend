const express = require("express");
const router = express.Router();

// Import all route modules
const chatRoutes = require("./chat.routes");
const shopRoutes = require("./shop.routes");
const newsRoutes = require("./news.routes");

// Mount routes
router.use("/chat", chatRoutes);
router.use("/shops", shopRoutes);
router.use("/news", newsRoutes);

// API root endpoint
router.get("/", (req, res) => {
  res.json({
    message: "API Router",
    version: "1.0.0",
    endpoints: {
      chat: "/api/chat",
      shops: "/api/shops",
      news: "/api/news",
    },
  });
});

module.exports = router;
