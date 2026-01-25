const express = require("express");
const router = express.Router();
const shopController = require("../controllers/shop.controller");
const { authenticate } = require("../middleware/auth.middleware");

// Debug route - always public
router.get("/debug", (req, res) => {
  res.json({
    success: true,
    message: "Shop router is working",
    timestamp: new Date(),
    path: "/api/shops",
  });
});

// ===== PUBLIC ROUTES (no authentication required) =====

router.get("/", shopController.getShops.bind(shopController));
router.get("/nearby", shopController.getNearbyShops.bind(shopController));
router.get("/product", shopController.getShopsByProduct.bind(shopController));
router.get("/search", shopController.searchShops.bind(shopController));
router.get("/categories", shopController.getCategories.bind(shopController));
router.get("/locations", shopController.getLocations.bind(shopController));
router.get("/top-rated", shopController.getTopRatedShops.bind(shopController));
router.get("/:id", shopController.getShop.bind(shopController));
router.get(
  "/:id/products",
  shopController.getShopProducts.bind(shopController),
);
router.get("/:id/reviews", shopController.getShopReviews.bind(shopController));
router.get(
  "/:id/with-products",
  shopController.getShopWithProducts.bind(shopController),
);

// ✅ PRODUCTS
router.get("/products/all", shopController.getProducts.bind(shopController));
router.get(
  "/products/:id",
  shopController.getProductWithShop.bind(shopController),
);


// ===== PROTECTED ROUTES (require authentication) =====

// Shop management routes
router.post("/", authenticate, shopController.createShop);
router.post("/:id/reviews", authenticate, shopController.addReview);
router.put("/:id", authenticate, shopController.updateShop);
router.put("/:id/verify", authenticate, shopController.toggleVerification);
router.delete("/:id", authenticate, shopController.deleteShop);
router.delete(
  "/:id/reviews/:reviewId",
  authenticate,
  shopController.deleteReview,
);

// Product management routes
router.post("/:id/products", authenticate, shopController.addProduct);
router.put("/products/:id", authenticate, shopController.updateProduct);
router.delete("/products/:id", authenticate, shopController.deleteProduct);

module.exports = router;
