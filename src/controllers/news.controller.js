const newsService = require("../services/news.service");
const firebaseService = require("../services/firebase.service");
const cacheService = require("../services/cache.service");
const { validateLocation, sanitizeInput } = require("../utils/validators");

class NewsController {
  // Get all news
  async getAllNews(req, res, next) {
    try {
      const {
        country,
        category = "agriculture",
        pageSize = 20,  
        page = 1,
        lat,
        lng,
      } = req.query;
      const userId = req.user?.uid;

      if (!userId) {
        return res
          .status(401)
          .json({ success: false, error: "Authentication required" });
      }

      // Determine user location
      let userLocation = null;
      if (lat && lng) {
        const validation = validateLocation({ lat, lng });
        if (validation.isValid)
          userLocation = { lat: parseFloat(lat), lng: parseFloat(lng) };
      } else if (userId) {
        try {
          const userDoc = await firebaseService.db
            .collection("users")
            .doc(userId)
            .get();
          if (userDoc.exists && userDoc.data()?.location)
            userLocation = userDoc.data().location;
        } catch {}
      }

      // Determine country dynamically using Google API if not provided
      let resolvedCountry = country;
      if (!resolvedCountry && userLocation) {
        resolvedCountry = await newsService.getCountryByLocation(userLocation);
      }

      // Cache key
      const cacheKey = cacheService.generateKey("news_all", {
        userId,
        country: resolvedCountry,
        category,
        page,
        lat: userLocation?.lat,
        lng: userLocation?.lng,
      });
      const cachedResponse = await cacheService.get(cacheKey);
      if (cachedResponse)
        return res.json({ success: true, ...cachedResponse, cached: true });

      // Fetch news
      const newsData = await newsService.getAgriculturalNews({
        country: resolvedCountry,
        category,
        pageSize: parseInt(pageSize),
        page: parseInt(page),
        location: userLocation,
        userId,
      });

      await cacheService.set(cacheKey, newsData, 3600);

      res.json({ success: true, ...newsData, cached: false });
    } catch (error) {
      console.error("Get all news error:", error);
      res
        .status(500)
        .json({
          success: false,
          error: "Failed to fetch news data",
          message: error.message,
        });
    }
  }

  // Get trending topics
  async getTrendingTopics(req, res, next) {
    try {
      const { country = "us", limit = 20, lat, lng } = req.query;
      const userId = req.user?.uid;

      // Get location
      let location = null;
      if (lat && lng) {
        const validation = validateLocation({ lat, lng });
        if (validation.isValid) {
          location = { lat: parseFloat(lat), lng: parseFloat(lng) };
        }
      }

      // Check cache
      const cacheKey = cacheService.generateKey("news_trending", {
        userId,
        country,
        limit,
        lat: location?.lat,
        lng: location?.lng,
      });

      const cachedResponse = await cacheService.get(cacheKey);
      if (cachedResponse) {
        return res.json({
          success: true,
          ...cachedResponse,
          cached: true,
        });
      }

      // Get trending articles
      const trendingData = await newsService.getTrendingArticles({
        country,
        limit: parseInt(limit),
        location,
        userId,
      });

      // Cache for 30 minutes
      await cacheService.set(cacheKey, trendingData, 1800);

      res.json({
        success: true,
        articles: trendingData.articles || [],
        timestamp: new Date(),
        source: "trending",
        cached: false,
      });
    } catch (error) {
      console.error("Get trending topics error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch trending articles",
        message: error.message,
      });
    }
  }

  // Get weather data
  async getWeatherData(req, res, next) {
    try {
      const { lat, lng } = req.query;
      const userId = req.user?.uid;

      let location = null;

      // Get location from query or use default
      if (lat && lng) {
        const validation = validateLocation({ lat, lng });
        if (!validation.isValid) {
          return res.status(400).json({
            success: false,
            error: validation.errors.join(", "),
          });
        }
        location = { lat: parseFloat(lat), lng: parseFloat(lng) };
      } else {
        // Default location
        location = { lat: 40.7128, lng: -74.006 }; // New York
      }

      // Check cache
      const cacheKey = cacheService.generateKey("weather", {
        lat: location.lat,
        lng: location.lng,
      });

      const cachedResponse = await cacheService.get(cacheKey);
      if (cachedResponse) {
        return res.json({
          success: true,
          weather: cachedResponse,
          location,
          cached: true,
        });
      }

      // Get weather forecast
      const weatherData = await newsService.getWeatherForecast(location);

      // Ensure proper structure
      if (!weatherData) {
        throw new Error("Weather service unavailable");
      }

      // Cache for 30 minutes
      await cacheService.set(cacheKey, weatherData, 1800);

      res.json({
        success: true,
        weather: weatherData,
        location,
        cached: false,
      });
    } catch (error) {
      console.error("Get weather error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch weather data",
        message: error.message,
      });
    }
  }

  // Get market data
  async getMarketData(req, res, next) {
    try {
      const { symbols, country = "us" } = req.query;
      const userId = req.user?.uid;

      // Default symbols for agricultural commodities
      const defaultSymbols = "CORN,WEAT,RICE,SOYB,KC=F,CC=F,CT=F,SB=F";
      const symbolsToFetch = symbols || defaultSymbols;

      // Check cache
      const cacheKey = cacheService.generateKey("market_prices", {
        userId,
        symbols: symbolsToFetch,
        country,
      });

      const cachedResponse = await cacheService.get(cacheKey);
      if (cachedResponse) {
        return res.json({
          success: true,
          ...cachedResponse,
          cached: true,
        });
      }

      // Get real market data from Finnhub
      const marketData = await newsService.getMarketPrices(symbolsToFetch);

      // Cache for 15 minutes (market data changes frequently)
      await cacheService.set(cacheKey, marketData, 900);

      res.json({
        success: true,
        ...marketData,
        cached: false,
      });
    } catch (error) {
      console.error("Get market data error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch market data",
        message: error.message,
      });
    }
  }

  // Get tech news
  async getTechNews(req, res, next) {
    try {
      const { country = "us", pageSize = 20, page = 1 } = req.query;
      const userId = req.user?.uid;

      // Check cache
      const cacheKey = cacheService.generateKey("news_tech", {
        userId,
        country,
        page,
      });

      const cachedResponse = await cacheService.get(cacheKey);
      if (cachedResponse) {
        return res.json({
          success: true,
          ...cachedResponse,
          cached: true,
        });
      }

      // Get technology-focused agricultural news
      const techData = await newsService.getTechArticles({
        country,
        pageSize: parseInt(pageSize),
        page: parseInt(page),
        userId,
      });

      // Cache for 1 hour
      await cacheService.set(cacheKey, techData, 3600);

      res.json({
        success: true,
        articles: techData.articles || [],
        timestamp: new Date(),
        source: "tech",
        cached: false,
      });
    } catch (error) {
      console.error("Get tech news error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch tech news",
        message: error.message,
      });
    }
  }

  // Get regional news
  async getRegionalNews(req, res, next) {
    try {
      const { country = "us", lat, lng, radius = 100 } = req.query;
      const userId = req.user?.uid;

      // Provide default location if none given
      let location = null;
      if (lat && lng) {
        const validation = validateLocation({ lat, lng });
        if (!validation.isValid) {
          return res.status(400).json({
            success: false,
            error: validation.errors,
          });
        }
        location = { lat: parseFloat(lat), lng: parseFloat(lng) };
      } else {
        // Default to a major agricultural region
        location = { lat: 39.8283, lng: -98.5795 }; // Center of US
      }

      // Check cache
      const cacheKey = cacheService.generateKey("news_regional", {
        userId,
        lat: location.lat,
        lng: location.lng,
        radius,
      });

      const cachedResponse = await cacheService.get(cacheKey);
      if (cachedResponse) {
        return res.json({
          success: true,
          ...cachedResponse,
          cached: true,
        });
      }

      // Get regional articles
      const regionalData = await newsService.getRegionalArticles({
        location,
        radius: parseInt(radius),
        userId,
      });

      // Cache for 1 hour
      await cacheService.set(cacheKey, regionalData, 3600);

      res.json({
        success: true,
        ...regionalData,
        cached: false,
      });
    } catch (error) {
      console.error("Get regional news error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch regional news",
        message: error.message,
      });
    }
  }

  // Get agricultural tips
  async getAgriculturalTips(req, res, next) {
    try {
      const { country = "us" } = req.query;
      const userId = req.user?.uid;

      // Get user location for personalized tips
      let location = null;
      if (userId) {
        try {
          const userDoc = await firebaseService.db
            .collection("users")
            .doc(userId)
            .get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            if (userData?.location) {
              location = userData.location;
            }
          }
        } catch (userError) {
          console.log("Could not fetch user location:", userError);
        }
      }

      // Check cache
      const cacheKey = cacheService.generateKey("agricultural_tips", {
        country,
        month: new Date().getMonth(),
        lat: location?.lat,
        lng: location?.lng,
      });

      const cachedResponse = await cacheService.get(cacheKey);
      if (cachedResponse) {
        return res.json({
          success: true,
          tips: cachedResponse,
          cached: true,
        });
      }

      // Get agricultural tips
      const tips = await newsService.getAgriculturalTips(country, location);

      // Cache for 1 day
      await cacheService.set(cacheKey, tips, 86400);

      res.json({
        success: true,
        tips,
        timestamp: new Date(),
        cached: false,
      });
    } catch (error) {
      console.error("Get agricultural tips error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch agricultural tips",
        message: error.message,
      });
    }
  }

  // Search news articles
  async searchNews(req, res, next) {
    try {
      const {
        q,
        category,
        from,
        to,
        language = "en",
        sortBy = "relevancy",
      } = req.query;
      const userId = req.user?.uid;

      if (!q || q.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: "Search query is required",
        });
      }

      // Check cache
      const cacheKey = cacheService.generateKey("news_search", {
        query: q.toLowerCase(),
        category,
        from,
        to,
        userId,
      });

      const cachedResponse = await cacheService.get(cacheKey);
      if (cachedResponse) {
        return res.json({
          success: true,
          ...cachedResponse,
          cached: true,
        });
      }

      // Search news
      const searchResults = await newsService.searchNews({
        query: q,
        category,
        from,
        to,
        language,
        sortBy,
        userId,
      });

      // Cache for 15 minutes
      await cacheService.set(cacheKey, searchResults, 900);

      res.json({
        success: true,
        ...searchResults,
        cached: false,
      });
    } catch (error) {
      console.error("Search news error:", error);
      res.status(500).json({
        success: true,
        articles: [],
        totalResults: 0,
        error: "Search service unavailable",
        message: error.message,
      });
    }
  }

  // Get news categories
  async getNewsCategories(req, res, next) {
    try {
      const categories = [
        { id: "all", name: "All", description: "All agricultural news" },
        {
          id: "trending",
          name: "Trending",
          description: "Most popular topics",
        },
        {
          id: "weather",
          name: "Weather",
          description: "Forecast and climate news",
        },
        {
          id: "market",
          name: "Market",
          description: "Commodity prices and analysis",
        },
        {
          id: "tech",
          name: "Technology",
          description: "Agricultural innovations",
        },
        { id: "regional", name: "Regional", description: "Local farming news" },
      ];

      res.json({
        success: true,
        categories,
        timestamp: new Date(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  // Mark article as read/saved
  async markArticle(req, res, next) {
    try {
      const { uid } = req.user;
      const { articleId, action, articleTitle } = req.body;

      if (!articleId || !["read", "saved", "liked"].includes(action)) {
        return res.status(400).json({
          success: false,
          error:
            "Invalid parameters. articleId and action (read/saved/liked) required.",
        });
      }

      const articleData = {
        articleId,
        articleTitle: articleTitle || "Untitled Article",
        userId: uid,
        action,
        timestamp: new Date(),
      };

      // Attach user snapshot
      try {
        const userDoc = await firebaseService.db
          .collection("users")
          .doc(uid)
          .get();
        if (userDoc.exists) {
          const u = userDoc.data();
          articleData.user = {
            uid: userDoc.id,
            name: u.name || null,
            email: u.email || null,
            avatar: u.avatar || null,
          };
        }
      } catch (e) {
        // ignore
      }

      await firebaseService.db.collection("user_articles").add(articleData);

      res.json({
        success: true,
        message: `Article ${action} successfully`,
        data: articleData,
      });
    } catch (error) {
      console.error("Mark article error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to mark article",
        message: error.message,
      });
    }
  }

  // Get user's reading history
  async getReadingHistory(req, res, next) {
    try {
      const { uid } = req.user;
      const { limit = 20, action } = req.query;

      let query = firebaseService.db
        .collection("user_articles")
        .where("userId", "==", uid)
        .orderBy("timestamp", "desc")
        .limit(parseInt(limit));

      if (action) {
        query = query.where("action", "==", action);
      }

      const historySnapshot = await query.get();

      const history = historySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      res.json({
        success: true,
        history,
        count: history.length,
      });
    } catch (error) {
      console.error("Get reading history error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get reading history",
        message: error.message,
      });
    }
  }
}

module.exports = new NewsController();
