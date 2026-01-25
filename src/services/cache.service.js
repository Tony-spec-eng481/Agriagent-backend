const NodeCache = require("node-cache");
const { db } = require("../config/firebase.config");

class CacheService {
  constructor() {
    // Memory cache for fast access
    this.memoryCache = new NodeCache({
      stdTTL: 3600, // 1 hour default
      checkperiod: 600,
      useClones: false,
    });

    // Cache statistics
    this.stats = {
      memoryHits: 0,
      memoryMisses: 0,
      firestoreHits: 0,
      firestoreMisses: 0,
    };
  }

  // Generate cache key
  generateKey(prefix, params) {
    const paramsStr = JSON.stringify(params);
    const hash = this.hashCode(paramsStr);
    return `${prefix}_${hash}`;
  }

  // Hash function
  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  // Get from cache (tries memory first, then Firestore)
  async get(key) {
    // Try memory cache first
    const memoryValue = this.memoryCache.get(key);
    if (memoryValue !== undefined) {
      this.stats.memoryHits++;
      return memoryValue;
    }

    this.stats.memoryMisses++;

    // Try Firestore cache
    try {
      const cacheDoc = await db.collection("cache").doc(key).get();

      if (cacheDoc.exists) {
        const cacheData = cacheDoc.data();

        // Check if cache has expired
        if (
          cacheData.expiresAt &&
          new Date(cacheData.expiresAt.toDate()) < new Date()
        ) {
          await cacheDoc.ref.delete();
          return null;
        }

        // Store in memory cache for faster future access
        const ttl = cacheData.expiresAt
          ? Math.floor(
              (new Date(cacheData.expiresAt.toDate()) - new Date()) / 1000
            )
          : 3600;

        this.memoryCache.set(key, cacheData.data, ttl);
        this.stats.firestoreHits++;

        return cacheData.data;
      }

      this.stats.firestoreMisses++;
      return null;
    } catch (error) {
      console.error("Firestore cache error:", error);
      return null;
    }
  }

  // Set cache (both memory and Firestore)
  async set(key, value, ttl = 3600) {
    // Set in memory cache
    this.memoryCache.set(key, value, ttl);

    // Set in Firestore for persistence
    try {
      const expiresAt = new Date(Date.now() + ttl * 1000);

      await db.collection("cache").doc(key).set({
        data: value,
        createdAt: new Date(),
        expiresAt,
        ttl,
      });

      return true;
    } catch (error) {
      console.error("Firestore cache set error:", error);
      return false;
    }
  }

  // Delete from cache
  async del(key) {
    this.memoryCache.del(key);

    try {
      await db.collection("cache").doc(key).delete();
      return true;
    } catch (error) {
      console.error("Firestore cache delete error:", error);
      return false;
    }
  }

  // Clear all cache
  async clear(prefix = null) {
    if (prefix) {
      // Clear memory cache with prefix
      const keys = this.memoryCache.keys();
      keys.forEach((key) => {
        if (key.startsWith(prefix)) {
          this.memoryCache.del(key);
        }
      });

      // Clear Firestore cache with prefix
      try {
        const snapshot = await db
          .collection("cache")
          .where("__name__", ">=", prefix)
          .where("__name__", "<=", prefix + "\uf8ff")
          .get();

        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });

        await batch.commit();
      } catch (error) {
        console.error("Firestore cache clear error:", error);
      }
    } else {
      // Clear all
      this.memoryCache.flushAll();

      try {
        const snapshot = await db.collection("cache").get();
        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });

        await batch.commit();
      } catch (error) {
        console.error("Firestore cache clear all error:", error);
      }
    }
  }

  // Cache for chat responses
  async cacheChatResponse(userId, message, response, ttl = 86400) {
    const key = this.generateKey("chat", { userId, message });
    return await this.set(key, response, ttl);
  }

  async getCachedChat(userId, message) {
    const key = this.generateKey("chat", { userId, message });
    return await this.get(key);
  }

  // Cache for image analysis
  async cacheImageAnalysis(imageHash, analysis, ttl = 86400) {
    const key = this.generateKey("image", { hash: imageHash });
    return await this.set(key, analysis, ttl);
  }

  async getCachedImageAnalysis(imageHash) {
    const key = this.generateKey("image", { hash: imageHash });
    return await this.get(key);
  }

  // Cache for shop data
  async cacheShops(location, radius, shops, ttl = 1800) {
    const key = this.generateKey("shops", { location, radius });
    return await this.set(key, shops, ttl);
  }

  async getCachedShops(location, radius) {
    const key = this.generateKey("shops", { location, radius });
    return await this.get(key);
  }

  // Cache for news
  async cacheNews(country, category, news, ttl = 3600) {
    const key = this.generateKey("news", { country, category });
    return await this.set(key, news, ttl);
  }

  async getCachedNews(country, category) {
    const key = this.generateKey("news", { country, category });
    return await this.get(key);
  }

  // Get cache statistics
  getStats() {
    const memoryStats = this.memoryCache.getStats();

    return {
      memory: {
        hits: this.stats.memoryHits,
        misses: this.stats.memoryMisses,
        hitRate:
          this.stats.memoryHits /
            (this.stats.memoryHits + this.stats.memoryMisses) || 0,
        keys: memoryStats.keys,
        ksize: memoryStats.ksize,
        vsize: memoryStats.vsize,
      },
      firestore: {
        hits: this.stats.firestoreHits,
        misses: this.stats.firestoreMisses,
        hitRate:
          this.stats.firestoreHits /
            (this.stats.firestoreHits + this.stats.firestoreMisses) || 0,
      },
      overall: {
        totalHits: this.stats.memoryHits + this.stats.firestoreHits,
        totalMisses: this.stats.memoryMisses + this.stats.firestoreMisses,
        overallHitRate:
          (this.stats.memoryHits + this.stats.firestoreHits) /
            (this.stats.memoryHits +
              this.stats.memoryMisses +
              this.stats.firestoreHits +
              this.stats.firestoreMisses) || 0,
      },
    };
  }
   
  // Clean expired cache entries
  async cleanup() {
    console.log("Starting cache cleanup...");

    // Clean memory cache (NodeCache handles this automatically)

    // Clean Firestore cache
    try {
      const now = new Date();
      const snapshot = await db
        .collection("cache")
        .where("expiresAt", "<", now)
        .get();

      if (!snapshot.empty) {
        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });

        await batch.commit();
        console.log(`Cleaned ${snapshot.size} expired cache entries`);
      }
    } catch (error) {
      console.error("Cache cleanup error:", error);
    }
  }
}

module.exports = new CacheService();
