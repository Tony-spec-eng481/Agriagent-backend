const axios = require("axios");
const { db } = require("../config/firebase.config");

class NewsService {
  constructor() {
    this.newsApiKey = process.env.NEWS_API_KEY;
    this.weatherApiKey = process.env.WEATHER_API_KEY;
    this.marketApiKey = process.env.MARKET_API_KEY;
    this.googleApiKey = process.env.GOOGLE_PLACES_API_KEY;

    this.NEWS_API_URL = "https://newsapi.org/v2";
    this.WEATHER_API_URL = "https://api.openweathermap.org/data/2.5";
    this.FINNHUB_API_URL = "https://finnhub.io/api/v1";
    this.GOOGLE_GEOCODE_URL =
      "https://maps.googleapis.com/maps/api/geocode/json";
  }

  // Get country by coordinates using Google Geocoding
  async getCountryByLocation(location) {
    try {
      const response = await axios.get(this.GOOGLE_GEOCODE_URL, {
        params: {
          latlng: `${location.lat},${location.lng}`,
          key: this.googleApiKey,
        },
      });
      if (response.data.status !== "OK" || !response.data.results.length)
        return "us";

      const countryComponent = response.data.results[0].address_components.find(
        (c) => c.types.includes("country"),
      );
      return countryComponent?.short_name?.toLowerCase() || "us";
    } catch (error) {
      console.error("Google geocode error:", error.message);
      return "us";
    }
  }

  // Main agricultural news fetch
  async getAgriculturalNews({
    country = "us",
    category,
    pageSize = 20,
    page = 1,
    query = "agriculture OR farming OR crops OR livestock",
    location = null,
    userId = null,
  }) {
    try {
      const articles = await this.getNewsApiArticles({
        country,
        category,
        pageSize,
        page,
        query,
      });
      const marketData = await this.getMarketPrices("CORN,WEAT,RICE,SOYB");
      const weatherData = location
        ? await this.getWeatherForecast(location)
        : null;
      const tips = await this.getAgriculturalTips(country, location);

      if (articles.length) await this.cacheArticles(articles);

      return {
        articles,
        marketData,
        weather: weatherData,
        agriculturalTips: tips,
        timestamp: new Date(),
        totalArticles: articles.length,
      };
    } catch (error) {
      console.error("Get agricultural news error:", error.message);
      throw error;
    }
  }

  // Get trending articles
  async getTrendingArticles(options = {}) {
    try {
      // Get recent articles
      const articles = await this.getNewsApiArticles({
        query: "agriculture OR farming OR crops OR livestock",
        sortBy: "popularity",
        pageSize: options.limit || 20,
        page: 1,
      });

      return {
        articles: articles.slice(0, 10), // Return top 10 trending articles
        timestamp: new Date(),
        source: "trending",
      };
    } catch (error) {
      console.error("Get trending articles error:", error);
      throw new Error(`Failed to fetch trending articles: ${error.message}`);
    }
  }

  // Get technology articles
  async getTechArticles(options = {}) {
    try {
      const techKeywords = [
        "agricultural technology",
        "farm tech",
        "precision agriculture",
        "agritech",
        "farm robotics",
        "drone farming",
        "AI agriculture",
        "smart farming",
        "IoT farm",
        "vertical farming",
      ];

      const query = techKeywords.join(" OR ");

      const articles = await this.getNewsApiArticles({
        query,
        pageSize: options.pageSize || 20,
        page: options.page || 1,
        sortBy: "relevancy",
      });

      // Filter for tech articles
      const techArticles = articles.filter((article) =>
        this.isTechArticle(article),
      );

      return {
        articles: techArticles,
        timestamp: new Date(),
        source: "tech",
      };
    } catch (error) {
      console.error("Get tech articles error:", error);
      throw new Error(`Failed to fetch tech articles: ${error.message}`);
    }
  }

  // Get regional articles
  async getRegionalArticles(options = {}) {
    try {
      const { location, radius = 100 } = options;

      if (!location) {
        throw new Error("Location required for regional news");
      }

      // Try to get location name
      let regionName = "Local Area";
      try {
        const reverseGeocode = await axios.get(
          `https://api.openweathermap.org/geo/1.0/reverse`,
          {
            params: {
              lat: location.lat,
              lon: location.lng,
              limit: 1,
              appid: this.weatherApiKey,
            },
          },
        );

        if (reverseGeocode.data && reverseGeocode.data.length > 0) {
          const loc = reverseGeocode.data[0];
          regionName = `${loc.name}, ${loc.country}`;
        }
      } catch (error) {
        console.log("Could not get location name:", error);
      }

      // Get local news - using broader search since NewsAPI doesn't have location radius
      const articles = await this.getNewsApiArticles({
        query: `farming OR agriculture OR farm "${regionName.split(",")[0]}"`,
        pageSize: 10,
        page: 1,
      });

      return {
        articles,
        location,
        regionName,
        timestamp: new Date(),
        source: "regional",
      };
    } catch (error) {
      console.error("Get regional articles error:", error);
      throw new Error(`Failed to fetch regional articles: ${error.message}`);
    }
  }

  // Get real market prices from Finnhub
  async getMarketPrices(symbols) {
    try {
      if (!this.marketApiKey) {
        throw new Error("Market API key not configured");
      }

      const symbolArray = symbols.split(",");
      const commodities = [];

      // Map symbols to commodity names
      const symbolMap = {
        CORN: { name: "Corn", unit: "bushel" },
        WEAT: { name: "Wheat", unit: "bushel" },
        RICE: { name: "Rice", unit: "cwt" },
        SOYB: { name: "Soybeans", unit: "bushel" },
        "KC=F": { name: "Coffee", unit: "lb" },
        "CC=F": { name: "Cocoa", unit: "mt" },
        "CT=F": { name: "Cotton", unit: "lb" },
        "SB=F": { name: "Sugar", unit: "lb" },
      };

      // Fetch prices for each symbol
      for (const symbol of symbolArray) {
        try {
          const response = await axios.get(`${this.FINNHUB_API_URL}/quote`, {
            params: {
              symbol,
              token: this.marketApiKey,
            },
            timeout: 5000,
          });

          if (response.data && response.data.c) {
            const price = response.data.c;
            const previousClose = response.data.pc || price * 0.95;
            const changeAmount = price - previousClose;
            const changePercent = (changeAmount / previousClose) * 100;

            commodities.push({
              name: symbolMap[symbol]?.name || symbol,
              symbol,
              price: price.toFixed(2),
              change_amount: changeAmount.toFixed(2),
              change_percent: changePercent.toFixed(2),
              volume: response.data.v || 0,
              unit: symbolMap[symbol]?.unit || "unit",
              last_updated: new Date().toISOString(),
            });
          }
        } catch (symbolError) {
          console.log(`Error fetching ${symbol}:`, symbolError.message);
          // Skip failed symbols
          continue;
        }

        // Rate limiting delay
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      if (commodities.length === 0) {
        throw new Error("No market data available");
      }

      return {
        commodities,
        last_updated: new Date().toISOString(),
        source: "finnhub",
      };
    } catch (error) {
      console.error("Market prices API error:", error);
      throw new Error(`Failed to fetch market data: ${error.message}`);
    }
  }

  // Get real weather forecast from OpenWeatherMap
  async getWeatherForecast(location, retryCount = 0) {
    try {
      if (!this.weatherApiKey || !location) {
        throw new Error("Weather API key or location not provided");
      }

      // Get current weather and 5-day forecast
      const response = await axios.get(`${this.WEATHER_API_URL}/forecast`, {
        params: {
          lat: location.lat,
          lon: location.lng,
          appid: this.weatherApiKey,
          units: "metric",
          cnt: 40,
        },
        timeout: 10000,
      });

      if (!response.data || !response.data.list) {
        throw new Error("Invalid weather data received");
      }

      // Get location name
      let locationName = "Unknown Location";
      try {
        const geoResponse = await axios.get(`${this.WEATHER_API_URL}/weather`, {
          params: {
            lat: location.lat,
            lon: location.lng,
            appid: this.weatherApiKey,
          },
        });
        if (geoResponse.data) {
          locationName = `${geoResponse.data.name}, ${geoResponse.data.sys.country}`;
        }
      } catch (geoError) {
        console.log("Could not get location name:", geoError);
      }

      // Process current weather
      const current = response.data.list[0];
      const currentWeather = {
        temp: Math.round(current.main.temp),
        condition: current.weather[0].description,
        humidity: current.main.humidity,
        wind_speed: Math.round(current.wind.speed * 3.6), // Convert m/s to km/h
        precipitation: current.rain ? current.rain["3h"] || 0 : 0,
        icon: this.getWeatherIcon(current.weather[0].icon),
      };

      // Process 3-day forecast
      const forecast = [];
      const days = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];

      // Get unique days
      const dayMap = new Map();
      response.data.list.forEach((item) => {
        const date = new Date(item.dt * 1000);
        const dayKey = date.toDateString();

        if (!dayMap.has(dayKey) && dayMap.size < 3) {
          dayMap.set(dayKey, {
            date: date.toISOString(),
            day: days[date.getDay()],
            temp_min: item.main.temp_min,
            temp_max: item.main.temp_max,
            condition: item.weather[0].description,
            precipitation_chance: item.pop ? Math.round(item.pop * 100) : 0,
            icon: this.getWeatherIcon(item.weather[0].icon),
          });
        }
      });

      // Convert map to array
      forecast.push(...dayMap.values());

      // Generate agricultural advice
      const agriculturalAdvice = this.generateWeatherAdvice(
        currentWeather,
        forecast,
      );

      return {
        location: {
          name: locationName,
          country: locationName.split(", ")[1] || "",
          lat: location.lat,
          lon: location.lng,
        },
        current: currentWeather,
        forecast,
        agricultural_advice: agriculturalAdvice,
      };
    } catch (error) {
      console.error("Weather API error:", error.message);

      // Retry logic
      if (retryCount < 2) {
        console.log(`Retrying weather fetch (${retryCount + 1})...`);
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * (retryCount + 1)),
        );
        return this.getWeatherForecast(location, retryCount + 1);
      }

      throw new Error(`Failed to fetch weather data: ${error.message}`);
    }
  }

  // Helper: Get weather icon
  getWeatherIcon(iconCode) {
    const iconMap = {
      "01d": "sun.max.fill",
      "01n": "moon.stars.fill",
      "02d": "cloud.sun.fill",
      "02n": "cloud.moon.fill",
      "03d": "cloud.fill",
      "03n": "cloud.fill",
      "04d": "cloud.fill",
      "04n": "cloud.fill",
      "09d": "cloud.rain.fill",
      "09n": "cloud.rain.fill",
      "10d": "cloud.sun.rain.fill",
      "10n": "cloud.moon.rain.fill",
      "11d": "cloud.bolt.fill",
      "11n": "cloud.bolt.fill",
      "13d": "snow",
      "13n": "snow",
      "50d": "cloud.fog.fill",
      "50n": "cloud.fog.fill",
    };
    return iconMap[iconCode] || "questionmark.circle.fill";
  }

  // Helper: Generate weather advice
  generateWeatherAdvice(currentWeather, forecast) {
    const advice = [];

    // Temperature advice
    if (currentWeather.temp > 30) {
      advice.push(
        "High temperatures: Increase irrigation frequency. Provide shade for livestock.",
      );
    } else if (currentWeather.temp < 5) {
      advice.push(
        "Low temperatures: Protect sensitive crops from frost. Ensure livestock have warm shelter.",
      );
    }

    // Rain advice
    if (currentWeather.precipitation > 10) {
      advice.push(
        "Heavy rain expected: Ensure proper drainage. Delay field work if soil is saturated.",
      );
    } else if (currentWeather.precipitation < 1 && currentWeather.temp > 25) {
      advice.push(
        "Dry conditions: Consider irrigation. Mulch to conserve soil moisture.",
      );
    }

    // Humidity advice
    if (currentWeather.humidity > 80) {
      advice.push(
        "High humidity: Watch for fungal diseases. Improve air circulation.",
      );
    }

    // Wind advice
    if (currentWeather.wind_speed > 20) {
      advice.push(
        "Strong winds: Secure loose items. Consider windbreaks for sensitive crops.",
      );
    }

    // Forecast advice
    const hasRainInForecast = forecast.some(
      (day) => day.precipitation_chance > 50,
    );
    if (hasRainInForecast) {
      advice.push("Rain forecasted: Plan outdoor activities accordingly.");
    }

    return advice.length > 0
      ? advice.join(" ")
      : "Favorable weather conditions for most agricultural activities.";
  }

  // Get articles from News API
  async getNewsApiArticles({
    country,
    category,
    pageSize = 20,
    page = 1,
    query,
    sortBy = "publishedAt",
  }) {
    try {
      let endpoint = query ? "/everything" : "/top-headlines";
      const params = {
        apiKey: this.newsApiKey,
        pageSize,
        page,
        language: "en",
        sortBy,
      };
      if (!query) {
        params.country = country;
        if (category && category !== "all") params.category = category;
      } else params.q = query;

      const response = await axios.get(`${this.NEWS_API_URL}${endpoint}`, {
        params,
      });
      if (response.data.status !== "ok") throw new Error(response.data.message);

      let articles = response.data.articles || [];
      if (endpoint === "/everything")
        articles = articles.filter((a) => this.isAgriculturalArticle(a));
      return articles.map((a) => this.formatArticle(a));
    } catch (error) {
      console.error("News API error:", error.message);
      return [];
    }
  }

  // Search news
  async searchNews(options) {
    try {
      const params = {
        q: options.query,
        language: "en",
        apiKey: this.newsApiKey,
        sortBy: options.sortBy || "relevancy",
        pageSize: 20,
      };

      if (options.from) params.from = options.from;
      if (options.to) params.to = options.to;

      const response = await axios.get(`${this.NEWS_API_URL}/everything`, {
        params,
        timeout: 10000,
      });

      if (response.data.status !== "ok") {
        throw new Error(`News API error: ${response.data.message}`);
      }

      // Filter and format articles
      const articles = response.data.articles
        .filter((article) => this.isAgriculturalArticle(article))
        .map((article) => this.formatArticle(article));

      return {
        articles,
        totalResults: response.data.totalResults,
        query: options.query,
        source: "newsapi",
      };
    } catch (error) {
      console.error("Search news error:", error);
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  // Helper: Check if article is agricultural
  isAgriculturalArticle(article) {
    if (!article.title || !article.description) return false;

    const agriculturalKeywords = [
      "agriculture",
      "farm",
      "crop",
      "livestock",
      "harvest",
      "farming",
      "farmer",
      "agricultural",
      "food security",
      "climate change",
      "irrigation",
      "fertilizer",
      "pesticide",
      "rural",
      "agribusiness",
      "horticulture",
      "aquaculture",
      "soil",
      "water management",
      "crop rotation",
      "organic",
      "sustainable",
      "yield",
      "drought",
    ];

    const text =
      `${article.title} ${article.description} ${article.content || ""}`.toLowerCase();
    return agriculturalKeywords.some((keyword) =>
      text.includes(keyword.toLowerCase()),
    );
  }

  // Helper: Check if article is tech-related
  isTechArticle(article) {
    if (!article.title || !article.description) return false;

    const techKeywords = [
      "technology",
      "tech",
      "innovation",
      "digital",
      "smart",
      "precision",
      "drone",
      "robot",
      "ai",
      "artificial intelligence",
      "iot",
      "internet of things",
      "sensor",
      "automation",
      "data",
      "analytics",
      "software",
      "app",
      "mobile",
      "blockchain",
      "machine learning",
    ];

    const text = `${article.title} ${article.description}`.toLowerCase();
    return techKeywords.some((keyword) => text.includes(keyword.toLowerCase()));
  }

  // Helper: Format article
  formatArticle(article) {
    return {
      id: this.generateArticleId(article.url),
      title: article.title || "Untitled Article",
      description: article.description || "No description available",
      content: article.content,
      url: article.url,
      imageUrl: article.urlToImage,
      source: article.source?.name || "Unknown Source",
      author: article.author,
      publishedAt: article.publishedAt || new Date().toISOString(),
      category: this.categorizeArticle(article),
      readTime: this.calculateReadTime(article.content || article.description),
    };
  }

  // Helper: Generate unique ID for article
  generateArticleId(url) {
    if (!url) return Date.now().toString();
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString();
  }

  // Helper: Categorize article
  categorizeArticle(article) {
    const text = `${article.title} ${article.description}`.toLowerCase();

    if (
      text.includes("price") ||
      text.includes("market") ||
      text.includes("commodity")
    )
      return "market";
    if (
      text.includes("weather") ||
      text.includes("climate") ||
      text.includes("forecast")
    )
      return "weather";
    if (
      text.includes("pest") ||
      text.includes("disease") ||
      text.includes("insect")
    )
      return "pests";
    if (this.isTechArticle(article)) return "technology";
    if (
      text.includes("policy") ||
      text.includes("government") ||
      text.includes("regulation")
    )
      return "policy";
    if (
      text.includes("water") ||
      text.includes("irrigation") ||
      text.includes("drought")
    )
      return "water";
    if (
      text.includes("soil") ||
      text.includes("fertilizer") ||
      text.includes("compost")
    )
      return "soil";
    if (
      text.includes("crop") ||
      text.includes("harvest") ||
      text.includes("planting")
    )
      return "crops";
    if (
      text.includes("livestock") ||
      text.includes("animal") ||
      text.includes("cattle")
    )
      return "livestock";
    if (text.includes("sustainable") || text.includes("organic"))
      return "sustainability";

    return "general";
  }

  // Helper: Calculate read time
  calculateReadTime(content) {
    if (!content) return 2;
    const words = content.split(/\s+/).length;
    const minutes = Math.ceil(words / 200);
    return Math.max(1, Math.min(minutes, 10));
  }

  // Get agricultural tips (updated with real seasonal data)
  async getAgriculturalTips(country, location = null) {
    const month = new Date().getMonth() + 1;
    const season = this.getSeason(month, country, location);

    // Realistic tips based on season
    const tips = {
      planting: this.getPlantingTips(season, country, location),
      pestControl: this.getPestControlTips(season, country, location),
      livestock: this.getLivestockTips(season, country, location),
      general: this.getGeneralTips(season, country, location),
      season,
      month: new Date().toLocaleString("default", { month: "long" }),
    };

    return tips;
  }

  // Helper: Get season
  getSeason(month, country, location = null) {
    let isNorthern = true;
    if (location) {
      isNorthern = location.lat >= 0;
    } else {
      const northernCountries = [
        "us",
        "ca",
        "uk",
        "fr",
        "de",
        "it",
        "es",
        "jp",
        "kr",
        "cn",
        "ru",
      ];
      isNorthern = northernCountries.includes(country.toLowerCase());
    }

    const seasons = isNorthern
      ? {
          12: "winter",
          1: "winter",
          2: "winter",
          3: "spring",
          4: "spring",
          5: "spring",
          6: "summer",
          7: "summer",
          8: "summer",
          9: "autumn",
          10: "autumn",
          11: "autumn",
        }
      : {
          12: "summer",
          1: "summer",
          2: "summer",
          3: "autumn",
          4: "autumn",
          5: "autumn",
          6: "winter",
          7: "winter",
          8: "winter",
          9: "spring",
          10: "spring",
          11: "spring",
        };

    return seasons[month] || "spring";
  }

  // Helper: Get planting tips
  getPlantingTips(season, country, location) {
    const tips = {
      spring: [
        "Prepare soil by tilling and adding organic compost",
        "Start planting cool-season crops like lettuce, peas, and spinach",
        "Check local frost dates before planting tender crops",
        "Start seeds indoors for warm-season vegetables",
        "Test soil pH and adjust as needed",
      ],
      summer: [
        "Plant warm-season crops like tomatoes, peppers, and cucumbers",
        "Ensure adequate irrigation during dry periods",
        "Mulch around plants to conserve moisture and suppress weeds",
        "Monitor for pests and diseases regularly",
        "Harvest early morning for best quality",
      ],
      autumn: [
        "Plant cover crops to improve soil health over winter",
        "Harvest remaining summer crops before first frost",
        "Plant garlic and onions for spring harvest",
        "Clean and store garden tools properly",
        "Collect seeds from your best plants",
      ],
      winter: [
        "Plan next season's garden layout and crop rotation",
        "Maintain and repair farm equipment",
        "Order seeds and supplies for spring planting",
        "Prune fruit trees and bushes during dormancy",
        "Protect perennial plants from extreme cold",
      ],
    };

    return tips[season] || tips.spring;
  }

  // Helper: Get pest control tips
  getPestControlTips(season, country, location) {
    const seasonalTips = {
      spring: [
        "Monitor for aphids and caterpillars on new growth",
        "Use floating row covers to protect seedlings",
        "Encourage beneficial insects like ladybugs",
      ],
      summer: [
        "Watch for tomato hornworms and squash bugs",
        "Use neem oil for organic pest control",
        "Remove diseased plants to prevent spread",
      ],
      autumn: [
        "Clean up plant debris to reduce overwintering pests",
        "Apply dormant oil sprays to fruit trees",
        "Till soil to expose soil-borne pests",
      ],
      winter: [
        "Inspect stored crops for signs of pests",
        "Clean and sanitize greenhouse spaces",
        "Plan integrated pest management for next season",
      ],
    };

    const generalTips = [
      "Monitor crops regularly for early pest detection",
      "Use integrated pest management (IPM) strategies",
      "Consider biological controls like beneficial insects",
      "Rotate crops to disrupt pest life cycles",
      "Use physical barriers like row covers when appropriate",
    ];

    return [...(seasonalTips[season] || []), ...generalTips];
  }

  // Helper: Cache articles
  async cacheArticles(articles) {
    try {
      if (!articles || articles.length === 0) return;

      const batch = db.batch();
      const now = new Date();

      articles.forEach((article) => {
        if (article.id && article.title) {
          const docRef = db.collection("cached_news").doc(article.id);
          batch.set(
            docRef,
            {
              ...article,
              cachedAt: now,
              expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
            },
            { merge: true },
          );
        }
      });

      await batch.commit();
    } catch (error) {
      console.error("Cache articles error:", error);
    }
  }

  // Helper: Get livestock tips
  getLivestockTips(season, country, location) {
    const seasonalTips = {
      spring: [
        "De-worm livestock after winter",
        "Provide fresh pasture as grass grows",
        "Check fences after winter damage",
      ],
      summer: [
        "Ensure access to clean, fresh water at all times",
        "Provide shade during hot periods",
        "Watch for signs of heat stress",
      ],
      autumn: [
        "Build up winter feed supplies",
        "Check and repair shelters for winter",
        "Wean spring-born offspring",
      ],
      winter: [
        "Provide adequate shelter from cold winds and precipitation",
        "Increase feed as animals need more energy to stay warm",
        "Check water sources to prevent freezing",
      ],
    };

    return seasonalTips[season] || seasonalTips.spring;
  }

  // Helper: Get general tips
  getGeneralTips(season, country, location) {
    return [
      "Keep detailed records of planting dates, yields, and weather",
      "Rotate crops to maintain soil health",
      "Test soil annually and amend based on results",
      "Maintain farm equipment regularly",
      "Stay informed about local agricultural regulations",
      "Network with other farmers for knowledge sharing",
      "Consider diversifying crops to spread risk",
      "Implement water conservation practices",
    ];
  }
}

module.exports = new NewsService();
