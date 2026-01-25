const NodeCache = require('node-cache');

// Initialize cache with 24-hour TTL
const cache = new NodeCache({
  stdTTL: 86400, // 24 hours in seconds
  checkperiod: 600, // Check for expired keys every 10 minutes
  useClones: false,
  deleteOnExpire: true
});

// Cache middleware
const cacheMiddleware = (duration) => {
  return (req, res, next) => {
    const key = req.originalUrl || req.url;
    const cachedResponse = cache.get(key);

    if (cachedResponse) {
      console.log('Cache hit for:', key);
      return res.json(cachedResponse);
    }

    // Override res.json to cache response
    const originalJson = res.json;
    res.json = function(body) {
      cache.set(key, body, duration);
      return originalJson.call(this, body);
    };

    next();
  };
};

// Cache service methods
const cacheService = {
  get: (key) => cache.get(key),
  set: (key, value, ttl) => cache.set(key, value, ttl || 86400),
  del: (key) => cache.del(key),
  has: (key) => cache.has(key),
  flush: () => cache.flushAll(),
  getStats: () => cache.getStats(),
  
  // Chat specific cache methods
  cacheChatResponse: (userId, message, response) => {
    const key = `chat_${userId}_${message.toLowerCase().replace(/\s+/g, '_')}`;
    cache.set(key, response, 86400);
    return key;
  },
  
  getCachedChat: (userId, message) => {
    const key = `chat_${userId}_${message.toLowerCase().replace(/\s+/g, '_')}`;
    return cache.get(key);
  }
};

module.exports = {
  cache,
  cacheMiddleware,
  cacheService
};