const shopService = require("../services/shop.service");
const firebaseService = require("../services/firebase.service");
const {
  validateShop,
  validateLocation,
  sanitizeInput,
} = require("../utils/validators");
const axios = require("axios");

// Google Places API configuration
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const GOOGLE_PLACES_URL =
  "https://maps.googleapis.com/maps/api/place/nearbysearch/json";

// Initialize Firestore
const db = firebaseService.db || require("firebase-admin").firestore();

class ShopController {  
  constructor() {
    this.getShops = this.getShops.bind(this);
    this.getNearbyShops = this.getNearbyShops.bind(this);
    this.getShop = this.getShop.bind(this);
    this.getShopsByProduct = this.getShopsByProduct.bind(this);
    this.searchShops = this.searchShops.bind(this);
    this.getProducts = this.getProducts.bind(this);
    this.getShopWithProducts = this.getShopWithProducts.bind(this);
  }
  // Get shops (combines Google Places and local database)
  async getShops(req, res, next) {
    try {
      const {
        lat,
        lng,
        radius = 5000,
        category,
        location,
        source = "all",
      } = req.query;

      let shops = [];

      // Get from Google Places API if requested or if no filters
      if ((source === "all" || source === "google") && lat && lng) {
        const googleShops = await this._getGooglePlacesShops(
          lat,
          lng,
          radius,
          category,
        );
        shops = [...shops, ...googleShops];
      }

      // Get from local database
      if (source === "all" || source === "local") {
        let localFilters = {};

        if (category) localFilters.category = category;
        if (location) localFilters.location = location;

        const localShops = await shopService.searchShops(localFilters);

        // If location coordinates provided, filter by distance
        if (lat && lng) {
          const filteredLocalShops = localShops
            .filter((shop) => {
              if (!shop.latitude || !shop.longitude) return true;

              const distance = this.calculateDistance(
                parseFloat(lat),
                parseFloat(lng),
                parseFloat(shop.latitude),
                parseFloat(shop.longitude),
              );

              shop.distance = distance;
              return distance <= radius / 1000; // Convert meters to km
            })
            .sort((a, b) => (a.distance || 0) - (b.distance || 0));

          shops = [...shops, ...filteredLocalShops];
        } else {
          shops = [...shops, ...localShops];
        }
      }

      // Remove duplicates (prioritize local database entries)
      const uniqueShops = this._removeDuplicateShops(shops);

      res.json({
        success: true,
        count: uniqueShops.length,
        shops: uniqueShops,
        source,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get nearby shops
  async getNearbyShops(req, res, next) {
    try {
      const { lat, lng, radius = 10000 } = req.query; // radius in meters

      // Validate location
      if (!lat || !lng) {
        return res.status(400).json({
          success: false,
          error: "Latitude and longitude are required",
        });
      }

      // Convert to numbers
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);
      const radiusKm = parseInt(radius) / 1000; // Convert meters to km

      // Get nearby shops from service
      const nearbyShops = await shopService.findNearbyShops(
        latitude,
        longitude,
        radiusKm,
      );

      // Format response
      const shops = nearbyShops.map((shop) => ({
        id: shop.id,
        name: shop.name,
        address: shop.address,
        location: shop.location,
        latitude: shop.latitude,
        longitude: shop.longitude,
        phone: shop.phone,
        email: shop.email,
        category: shop.category,
        description: shop.description,
        rating: shop.rating,
        reviewCount: shop.reviewCount,
        openingHours: shop.openingHours,
        website: shop.website,
        distance: shop.distance, // Already calculated in service
        isActive: shop.isActive,
        verified: shop.verified,
        imageUrl: shop.imageUrl,
        products: shop.products || [],
        services: shop.services || [],
      }));

      res.json({
        success: true,
        count: shops.length,
        shops,
        location: { lat: latitude, lng: longitude },
        radius: radiusKm,
      });
    } catch (error) {
      console.error("Get nearby shops error:", error);
      next(error);
    }
  }

  // Get shop by ID
  async getShop(req, res, next) {
    try {
      const { id } = req.params;

      // First try to get from our database
      let shop = await this.getShopById(id);

      if (!shop) {
        // Try to get from Google Places API
        try {
          const detailsUrl =
            "https://maps.googleapis.com/maps/api/place/details/json";
          const response = await axios.get(detailsUrl, {
            params: {
              place_id: id,
              fields:
                "name,formatted_address,formatted_phone_number,opening_hours,rating,reviews,website,url,photos",
              key: GOOGLE_PLACES_API_KEY,
            },
          });

          if (response.data.status !== "OK") {
            return res.status(404).json({
              success: false,
              error: "Shop not found",
            });
          }

          const placeDetails = response.data.result;

          shop = {
            id: id,
            name: placeDetails.name,
            address: placeDetails.formatted_address,
            phone: placeDetails.formatted_phone_number,
            website: placeDetails.website,
            googleUrl: placeDetails.url,
            openingHours: placeDetails.opening_hours,
            rating: placeDetails.rating,
            reviews: placeDetails.reviews,
            photos:
              placeDetails.photos?.map(
                (photo) =>
                  `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photo.photo_reference}&key=${GOOGLE_PLACES_API_KEY}`,
              ) || [],
            source: "google",
          };
        } catch (googleError) {
          console.error("Google Places error:", googleError);
          return res.status(404).json({
            success: false,
            error: "Shop not found",
          });
        }
      }

      res.json({
        success: true,
        shop,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get shops by product
  async getShopsByProduct(req, res, next) {
    try {
      const { product, lat, lng, radius = 10000 } = req.query;

      if (!product) {
        return res.status(400).json({
          success: false,
          error: "Product name is required",
        });
      }

      // Search in our database
      const localShops = await shopService.searchShops({
        products: product.toLowerCase(),
      });

      let shops = localShops;

      // If location provided, filter by distance
      if (lat && lng) {
        shops = shops
          .filter((shop) => {
            if (!shop.latitude || !shop.longitude) return true;

            const distance = this.calculateDistance(
              parseFloat(lat),
              parseFloat(lng),
              parseFloat(shop.latitude),
              parseFloat(shop.longitude),
            );

            shop.distance = distance;
            return distance <= radius / 1000; // Convert to km
          })
          .sort((a, b) => (a.distance || 0) - (b.distance || 0));
      }

      // Also search Google Places if location provided
      if (lat && lng && shops.length < 5) {
        try {
          const response = await axios.get(GOOGLE_PLACES_URL, {
            params: {
              location: `${lat},${lng}`,
              radius,
              keyword: `${product} agricultural supplies`,
              key: GOOGLE_PLACES_API_KEY,
            },
          });

          if (response.data.status === "OK") {
            const googleShops = response.data.results.map((place) => ({
              id: place.place_id,
              name: place.name,
              address: place.vicinity,
              location: place.geometry.location,
              rating: place.rating || 0,
              source: "google",
            }));

            shops = [...shops, ...googleShops];
          }
        } catch (googleError) {
          console.error("Google Places error:", googleError);
          // Continue with local shops only
        }
      }

      res.json({
        success: true,
        count: shops.length,
        product,
        shops,
      });
    } catch (error) {
      next(error);
    }
  }

  // Create new shop
  async createShop(req, res, next) {
    try {
      const shopData = sanitizeInput(req.body);
      const { uid } = req.user || {};

      // Validate input
      const validation = validateShop(shopData);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: validation.errors,
        });
      }

      // Prepare shop data
      const shop = {
        ...shopData,
        addedBy: uid || null,
        verified: uid ? false : true, // If added by user, needs verification
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        rating: shopData.rating || 0,
        reviewCount: shopData.reviewCount || 0,
      };

      // If location is an object with lat/lng, extract to separate fields
      if (shopData.location && typeof shopData.location === "object") {
        shop.latitude = shopData.location.lat || shopData.location.latitude;
        shop.longitude = shopData.location.lng || shopData.location.longitude;
        shop.location =
          shopData.location.name || shopData.location.address || "Unknown";
      }

      const shopId = await firebaseService.saveShop(shop);

      res.status(201).json({
        success: true,
        shopId,
        message: uid
          ? "Shop added successfully. Waiting for verification."
          : "Shop added successfully.",
        shop: {
          id: shopId,
          ...shop,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Update shop
  async updateShop(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = sanitizeInput(req.body);
      const { uid } = req.user || {};

      // Check if shop exists
      const existingShop = await this.getShopById(id);
      if (!existingShop) {
        return res.status(404).json({
          success: false,
          error: "Shop not found",
        });
      }

      // Check permissions (admin or owner)
      if (uid) {
        const userDoc = await db.collection("users").doc(uid).get();
        const userData = userDoc.data();

        if (!userData.isAdmin && existingShop.addedBy !== uid) {
          return res.status(403).json({
            success: false,
            error: "Permission denied",
          });
        }
      }

      // Update shop
      updateData.updatedAt = new Date();
      await firebaseService.updateShop(id, updateData);

      const updatedShop = await this.getShopById(id);

      res.json({
        success: true,
        shop: updatedShop,
        message: "Shop updated successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete shop
  async deleteShop(req, res, next) {
    try {
      const { id } = req.params;
      const { uid } = req.user || {};

      // Check if shop exists
      const existingShop = await this.getShopById(id);
      if (!existingShop) {
        return res.status(404).json({
          success: false,
          error: "Shop not found",
        });
      }

      // Check permissions
      if (uid) {
        const userDoc = await db.collection("users").doc(uid).get();
        const userData = userDoc.data();

        if (!userData.isAdmin && existingShop.addedBy !== uid) {
          return res.status(403).json({
            success: false,
            error: "Permission denied",
          });
        }
      }

      // Delete shop (or mark as inactive)
      await db.collection("shops").doc(id).update({
        isActive: false,
        updatedAt: new Date(),
      });

      res.json({
        success: true,
        message: "Shop deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  // Search shops (simple search endpoint)
  async searchShops(req, res, next) {
    try {
      const { q, category, location, lat, lng, radius = 10000 } = req.query;

      let filters = {};
      if (category) filters.category = category;
      if (location) filters.location = location;
      if (q) filters.products = q; // Using products filter for search

      const shops = await shopService.searchShops(filters);

      // Filter by distance if coordinates provided
      let filteredShops = shops;
      if (lat && lng) {
        filteredShops = shops
          .filter((shop) => {
            if (!shop.latitude || !shop.longitude) return true;

            const distance = this.calculateDistance(
              parseFloat(lat),
              parseFloat(lng),
              parseFloat(shop.latitude),
              parseFloat(shop.longitude),
            );

            shop.distance = distance;
            return distance <= radius / 1000;
          })
          .sort((a, b) => (a.distance || 0) - (b.distance || 0));
      }

      res.json({
        success: true,
        count: filteredShops.length,
        shops: filteredShops,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get shop categories
  async getCategories(req, res, next) {
    try {
      const categories = await shopService.getShopCategories();
      res.json({
        success: true,
        categories,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get shop locations
  async getLocations(req, res, next) {
    try {
      const locations = await shopService.getShopLocations();
      res.json({
        success: true,
        locations,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get top rated shops
  async getTopRatedShops(req, res, next) {
    try {
      const { limit = 10 } = req.query;
      const shops = await shopService.getTopRatedShops(parseInt(limit));

      res.json({
        success: true,
        count: shops.length,
        shops,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get shop products
  async getShopProducts(req, res, next) {
    try {
      const { id } = req.params;
      const products = await shopService.getShopProducts(id);

      res.json({
        success: true,
        shopId: id,
        products,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get shop reviews
  async getShopReviews(req, res, next) {
    try {
      const { id } = req.params;
      const reviews = await shopService.getShopReviews(id);

      res.json({
        success: true,
        shopId: id,
        reviews,
      });
    } catch (error) {
      next(error);
    }
  }

  // Add review to shop
  async addReview(req, res, next) {
    try {
      const { id } = req.params;
      const reviewData = sanitizeInput(req.body);
      const { uid } = req.user;

      if (!uid) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      // Validate review data
      if (!reviewData.rating || !reviewData.comment) {
        return res.status(400).json({
          success: false,
          error: "Rating and comment are required",
        });
      }

      // Check if shop exists
      const shop = await this.getShopById(id);
      if (!shop) {
        return res.status(404).json({
          success: false,
          error: "Shop not found",
        });
      }

      // Save review
      const reviewRef = await db.collection("reviews").add({
        shopId: id,
        userId: uid,
        rating: parseFloat(reviewData.rating),
        comment: reviewData.comment,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
      });

      // Update shop rating
      const reviews = await shopService.getShopReviews(id);
      const totalReviews = reviews.length + 1;
      const totalRating =
        reviews.reduce((sum, r) => sum + r.rating, 0) +
        parseFloat(reviewData.rating);
      const newRating = totalRating / totalReviews;

      await db.collection("shops").doc(id).update({
        rating: newRating,
        reviewCount: totalReviews,
        updatedAt: new Date(),
      });

      res.status(201).json({
        success: true,
        reviewId: reviewRef.id,
        message: "Review added successfully",
        shopId: id,
        newRating,
      });
    } catch (error) {
      next(error);
    }
  }

  // Toggle shop verification
  async toggleVerification(req, res, next) {
    try {
      const { id } = req.params;
      const { uid } = req.user;

      if (!uid) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      // Check if user is admin
      const userDoc = await db.collection("users").doc(uid).get();
      const userData = userDoc.data();

      if (!userData.isAdmin) {
        return res.status(403).json({
          success: false,
          error: "Admin access required",
        });
      }

      // Check if shop exists
      const shop = await this.getShopById(id);
      if (!shop) {
        return res.status(404).json({
          success: false,
          error: "Shop not found",
        });
      }

      // Toggle verification
      const newVerifiedStatus = !shop.verified;
      await db.collection("shops").doc(id).update({
        verified: newVerifiedStatus,
        updatedAt: new Date(),
      });

      res.json({
        success: true,
        message: `Shop ${newVerifiedStatus ? "verified" : "unverified"} successfully`,
        verified: newVerifiedStatus,
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete review
  async deleteReview(req, res, next) {
    try {
      const { id, reviewId } = req.params;
      const { uid } = req.user;

      if (!uid) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      // Get review
      const reviewDoc = await db.collection("reviews").doc(reviewId).get();
      if (!reviewDoc.exists) {
        return res.status(404).json({
          success: false,
          error: "Review not found",
        });
      }

      const review = reviewDoc.data();

      // Check permissions (admin or review owner)
      const userDoc = await db.collection("users").doc(uid).get();
      const userData = userDoc.data();

      if (!userData.isAdmin && review.userId !== uid) {
        return res.status(403).json({
          success: false,
          error: "Permission denied",
        });
      }

      // Soft delete review
      await db.collection("reviews").doc(reviewId).update({
        isActive: false,
        updatedAt: new Date(),
      });

      // Update shop rating
      const reviews = await shopService.getShopReviews(id);
      const totalReviews = reviews.length;

      if (totalReviews > 0) {
        const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
        const newRating = totalRating / totalReviews;

        await db.collection("shops").doc(id).update({
          rating: newRating,
          reviewCount: totalReviews,
          updatedAt: new Date(),
        });
      } else {
        await db.collection("shops").doc(id).update({
          rating: 0,
          reviewCount: 0,
          updatedAt: new Date(),
        });
      }

      res.json({
        success: true,
        message: "Review deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  // ===== PRODUCT METHODS =====

  // Get products with filters
  async getProducts(req, res, next) {
    try {
      const {
        q, // search query
        category,
        lat,
        lng,
        radius = 10000,
        minPrice = 0,
        maxPrice = 100000,
        shopId,
        inStock = true,
        sortBy = "distance", // distance, price, rating
        limit = 50,
      } = req.query;

      let products = [];

      // Build Firestore query
      let query = db.collection("products").where("isActive", "==", true);

      if (category && category !== "all") {
        query = query.where("category", "==", category);
      }

      if (shopId) {
        query = query.where("shopId", "==", shopId);
      }

      if (inStock === "true") {
        query = query.where("inStock", "==", true);
      }

      query = query.where("price", ">=", parseFloat(minPrice));
      query = query.where("price", "<=", parseFloat(maxPrice));

      const snapshot = await query.limit(parseInt(limit)).get();

      if (snapshot.empty) {
        return res.json({
          success: true,
          products: [],
          count: 0,
        });
      }

      products = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Filter by search query
      if (q) {
        products = products.filter(
          (product) =>
            product.name.toLowerCase().includes(q.toLowerCase()) ||
            product.description.toLowerCase().includes(q.toLowerCase()) ||
            product.category.toLowerCase().includes(q.toLowerCase()),
        );
      }

      // Calculate distance if location provided
      if (lat && lng) {
        for (const product of products) {
          const shop = await this.getShopById(product.shopId);
          if (shop && shop.latitude && shop.longitude) {
            product.distance = this.calculateDistance(
              parseFloat(lat),
              parseFloat(lng),
              parseFloat(shop.latitude),
              parseFloat(shop.longitude),
            );
            product.shopName = shop.name;
            product.shopPhone = shop.phone;
            product.shopLocation = shop.location;
            product.shopRating = shop.rating;
          }
        }
      }

      // Sort products
      products.sort((a, b) => {
        if (sortBy === "price") return a.price - b.price;
        if (sortBy === "rating")
          return (b.shopRating || 0) - (a.shopRating || 0);
        if (sortBy === "distance") return (a.distance || 0) - (b.distance || 0);
        return 0;
      });

      res.json({
        success: true,
        products,
        count: products.length,
        filters: {
          category,
          priceRange: [minPrice, maxPrice],
          location: lat && lng ? { lat, lng } : null,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Get shop with products
  async getShopWithProducts(req, res, next) {
    try {
      const { id } = req.params;

      // Get shop
      const shop = await this.getShopById(id);
      if (!shop) {
        return res.status(404).json({
          success: false,
          error: "Shop not found",
        });
      }

      // Get shop products
      const productsSnapshot = await db
        .collection("products")
        .where("shopId", "==", id)
        .where("isActive", "==", true)
        .get();

      const products = productsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      res.json({
        success: true,
        shop: {
          ...shop,
          products,
        },
        productCount: products.length,
      });
    } catch (error) {
      next(error);
    }
  }

  // Add new product
  async addProduct(req, res, next) {
    try {
      const productData = req.body;
      const { uid } = req.user;

      // Validation
      if (!productData.name || !productData.price || !productData.shopId) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields",
        });
      }

      // Check if shop exists and user owns it
      const shop = await this.getShopById(productData.shopId);
      if (!shop) {
        return res.status(404).json({
          success: false,
          error: "Shop not found",
        });
      }

      if (shop.addedBy !== uid) {
        const userDoc = await db.collection("users").doc(uid).get();
        const userData = userDoc.data();

        if (!userData.isAdmin) {
          return res.status(403).json({
            success: false,
            error: "Permission denied",
          });
        }
      }

      // Prepare product data
      const product = {
        name: productData.name,
        description: productData.description || "",
        price: parseFloat(productData.price),
        currency: productData.currency || "KES",
        unit: productData.unit || "kg",
        category: productData.category || "General",
        imageUrl: productData.imageUrl || "",
        shopId: productData.shopId,
        inStock: productData.inStock !== false,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
      };

      // Save product
      const productRef = await db.collection("products").add(product);

      res.status(201).json({
        success: true,
        productId: productRef.id,
        message: "Product added successfully",
        product: {
          id: productRef.id,
          ...product,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Update product
  async updateProduct(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const { uid } = req.user;

      // Get product
      const productDoc = await db.collection("products").doc(id).get();
      if (!productDoc.exists) {
        return res.status(404).json({
          success: false,
          error: "Product not found",
        });
      }

      const product = productDoc.data();

      // Get shop to check ownership
      const shop = await this.getShopById(product.shopId);

      if (shop.addedBy !== uid) {
        const userDoc = await db.collection("users").doc(uid).get();
        const userData = userDoc.data();

        if (!userData.isAdmin) {
          return res.status(403).json({
            success: false,
            error: "Permission denied",
          });
        }
      }

      // Update product
      updateData.updatedAt = new Date();
      await db.collection("products").doc(id).update(updateData);

      const updatedProduct = await db.collection("products").doc(id).get();

      res.json({
        success: true,
        product: {
          id: updatedProduct.id,
          ...updatedProduct.data(),
        },
        message: "Product updated successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete product (soft delete)
  async deleteProduct(req, res, next) {
    try {
      const { id } = req.params;
      const { uid } = req.user;

      // Get product
      const productDoc = await db.collection("products").doc(id).get();
      if (!productDoc.exists) {
        return res.status(404).json({
          success: false,
          error: "Product not found",
        });
      }

      const product = productDoc.data();

      // Get shop to check ownership
      const shop = await this.getShopById(product.shopId);

      if (shop.addedBy !== uid) {
        const userDoc = await db.collection("users").doc(uid).get();
        const userData = userDoc.data();

        if (!userData.isAdmin) {
          return res.status(403).json({
            success: false,
            error: "Permission denied",
          });
        }
      }

      // Soft delete
      await db.collection("products").doc(id).update({
        isActive: false,
        updatedAt: new Date(),
      });

      res.json({
        success: true,
        message: "Product deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  // Get product by ID with shop info
  async getProductWithShop(req, res, next) {
    try {
      const { id } = req.params;

      const productDoc = await db.collection("products").doc(id).get();
      if (!productDoc.exists || !productDoc.data().isActive) {
        return res.status(404).json({
          success: false,
          error: "Product not found",
        });
      }

      const product = {
        id: productDoc.id,
        ...productDoc.data(),
      };

      // Get shop info
      const shop = await this.getShopById(product.shopId);

      if (!shop) {
        return res.status(404).json({
          success: false,
          error: "Shop not found",
        });
      }

      res.json({
        success: true,
        product: {
          ...product,
          shopName: shop.name,
          shopPhone: shop.phone,
          shopAddress: shop.address,
          shopLocation: shop.location,
          shopRating: shop.rating,
          shopDistance: product.distance,
          shopOpeningHours: shop.openingHours,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // ===== HELPER METHODS =====

  // Get shop by ID (helper method)
  async getShopById(id) {
    try {
      const shopDoc = await db.collection("shops").doc(id).get();
      if (!shopDoc.exists || !shopDoc.data().isActive) {
        return null;
      }
      return {
        id: shopDoc.id,
        ...shopDoc.data(),
      };
    } catch (error) {
      console.error("Error getting shop by ID:", error);
      return null;
    }
  }

  // Helper to calculate distance
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Get Google Places shops
  async _getGooglePlacesShops(lat, lng, radius, category) {
    try {
      let keyword = "agriculture farm supply shop";
      if (category) {
        keyword = `${category} ${keyword}`;
      }

      const response = await axios.get(GOOGLE_PLACES_URL, {
        params: {
          location: `${lat},${lng}`,
          radius,
          keyword,
          type: "store",
          key: GOOGLE_PLACES_API_KEY,
        },
      });

      if (response.data.status !== "OK") {
        return [];
      }

      return response.data.results.map((place) => ({
        id: place.place_id,
        name: place.name,
        address: place.vicinity,
        location: place.geometry.location,
        rating: place.rating || 0,
        totalRatings: place.user_ratings_total || 0,
        openNow: place.opening_hours?.open_now || null,
        photos:
          place.photos?.map(
            (photo) =>
              `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photo.photo_reference}&key=${GOOGLE_PLACES_API_KEY}`,
          ) || [],
        types: place.types,
        source: "google",
      }));
    } catch (error) {
      console.error("Google Places API error:", error);
      return [];
    }
  }

  _removeDuplicateShops(shops) {
    const seen = new Set();
    return shops.filter((shop) => {
      const key = shop.id || `${shop.name}-${shop.address}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
}

module.exports = new ShopController();
