const express = require("express");
const router = express.Router();
const newsController = require("../controllers/news.controller");
const { authenticate } = require("../middleware/auth.middleware");
// const { tokenRefreshMiddleware } = require("../middleware/token.middleware");

// // Apply token middleware before authentication
// router.use(tokenRefreshMiddleware);

// Public debug route
router.get("/debug", (req, res) => {
  res.json({
    success: true,
    message: "News router is working",
    timestamp: new Date(),
    endpoints: {
      getAllNews: "GET /api/news/all",
      getTrending: "GET /api/news/trending",
      getWeather: "GET /api/news/weather",
      getMarket: "GET /api/news/market",
      getTech: "GET /api/news/tech",
      getRegional: "GET /api/news/regional",
      getCategories: "GET /api/news/categories",
      search: "GET /api/news/search",
      getTips: "GET /api/news/tips",
      markArticle: "POST /api/news/mark",
      getHistory: "GET /api/news/history",
    },
    timestamp: new Date(),
  });
});

// Public routes
router.get("/categories", newsController.getNewsCategories);
router.get("/search", authenticate, newsController.searchNews);

// Category-based news routes (require authentication)
router.get("/all", authenticate, newsController.getAllNews);
router.get("/trending", authenticate, newsController.getTrendingTopics);
router.get("/weather", authenticate, newsController.getWeatherData);
router.get("/market", authenticate, newsController.getMarketData);
router.get("/tech", authenticate, newsController.getTechNews);
router.get("/regional", authenticate, newsController.getRegionalNews);

// Agricultural tips
router.get("/tips", authenticate, newsController.getAgriculturalTips);

// User actions
router.post("/mark", authenticate, newsController.markArticle);
router.get("/history", authenticate, newsController.getReadingHistory);

// 404 handler for undefined routes
router.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "News endpoint not found",
    message: `Cannot ${req.method} ${req.originalUrl}`,
    availableEndpoints: [
      "GET /api/news/all",
      "GET /api/news/trending",
      "GET /api/news/weather",
      "GET /api/news/market",
      "GET /api/news/tech",
      "GET /api/news/regional",
      "GET /api/news/categories",
      "GET /api/news/search",
      "GET /api/news/tips",
      "POST /api/news/mark",
      "GET /api/news/history",
    ],
  });
});

module.exports = router;
