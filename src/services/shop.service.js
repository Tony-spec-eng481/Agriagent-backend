const { db } = require("../config/firebase.config");

class ShopService {
  // Calculate distance between two coordinates (Haversine formula)
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this._deg2rad(lat2 - lat1);
    const dLon = this._deg2rad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this._deg2rad(lat1)) *
        Math.cos(this._deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in kilometers
    return distance;
  }

  _deg2rad(deg) {
    return deg * (Math.PI / 180);
  }

  // Find nearby shops
  async findNearbyShops(lat, lng, radius = 10) {  
    // radius in kilometers
    try {
      const snapshot = await db
        .collection("shops")
        .where("isActive", "==", true)
        .get();

      if (snapshot.empty) {
        return [];
      }

      const shops = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Filter shops within radius and calculate distance
      const nearbyShops = shops
        .filter((shop) => {
          if (!shop.latitude || !shop.longitude) return false;

          const distance = this.calculateDistance(
            parseFloat(lat),
            parseFloat(lng),
            parseFloat(shop.latitude),
            parseFloat(shop.longitude),
          );

          shop.distance = distance;
          return distance <= radius;
        })
        .sort((a, b) => a.distance - b.distance);

      return nearbyShops;
    } catch (error) {
      console.error("Error finding nearby shops:", error);
      throw error;   
    }
  }

  // Search shops with filters
  async searchShops(filters = {}) {
    try {
      let query = db.collection("shops").where("isActive", "==", true);

      // Apply filters
      if (filters.category) {
        query = query.where("category", "==", filters.category);
      }

      if (filters.location) {
        query = query.where("location", "==", filters.location);
      }

      if (filters.verified !== undefined) {
        query = query.where("verified", "==", filters.verified);
      }

      // For product search
      if (filters.products) {
        const snapshot = await db
          .collection("shops")
          .where("isActive", "==", true)
          .get();
        return snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((shop) => {
            if (!shop.products || !Array.isArray(shop.products)) return false;
            return shop.products.some((product) =>
              product.toLowerCase().includes(filters.products.toLowerCase()),
            );
          });
      }

      const snapshot = await query.get();

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error("Error searching shops:", error);
      throw error;
    }
  }

  // Get shop by ID
  async getShopById(shopId) {
    try {
      const shopDoc = await db.collection("shops").doc(shopId).get();

      if (!shopDoc.exists) {
        return null;
      }

      return {
        id: shopDoc.id,
        ...shopDoc.data(),
      };
    } catch (error) {
      console.error("Error getting shop by ID:", error);
      throw error;
    }
  }

  // Get all shop categories
  async getShopCategories() {
    try {
      const snapshot = await db
        .collection("shops")
        .where("isActive", "==", true)
        .get();
      const categories = new Set();

      snapshot.docs.forEach((doc) => {
        const shop = doc.data();
        if (shop.category) {
          categories.add(shop.category);
        }
      });

      return Array.from(categories).sort();
    } catch (error) {
      console.error("Error getting shop categories:", error);
      throw error;
    }
  }

  // Get all shop locations
  async getShopLocations() {
    try {
      const snapshot = await db
        .collection("shops")
        .where("isActive", "==", true)
        .get();
      const locations = new Set();

      snapshot.docs.forEach((doc) => {
        const shop = doc.data();
        if (shop.location) {
          locations.add(shop.location);
        }
      });

      return Array.from(locations).sort();
    } catch (error) {
      console.error("Error getting shop locations:", error);
      throw error;
    }
  }

  // Get top rated shops
  async getTopRatedShops(limit = 10) {
    try {
      const snapshot = await db
        .collection("shops")
        .where("isActive", "==", true)
        .where("rating", ">=", 4.0)
        .orderBy("rating", "desc")
        .limit(limit)
        .get();

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error("Error getting top rated shops:", error);
      throw error;
    }
  }

  // Get shop products
  async getShopProducts(shopId) {
    try {
      const shop = await this.getShopById(shopId);
      return shop?.products || [];
    } catch (error) {
      console.error("Error getting shop products:", error);
      throw error;
    }
  }

  // Get shop reviews
  async getShopReviews(shopId) {
    try {
      const snapshot = await db
        .collection("reviews")
        .where("shopId", "==", shopId)
        .where("isActive", "==", true)
        .orderBy("createdAt", "desc")
        .get();

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error("Error getting shop reviews:", error);
      return [];
    }
  }
}

module.exports = new ShopService();
