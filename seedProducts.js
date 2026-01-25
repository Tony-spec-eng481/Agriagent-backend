// scripts/seed-products.js
const {
  db,
  generateId,
  getTimestamp,
} = require("./src/config/firebase.config");

const seedProducts = async (shops) => {
  console.log("🚀 Starting products seed...");

  // Product categories
  const categories = [
    "Fertilizers",
    "Pesticides",
    "Herbicides",
    "Seeds",
    "Tools & Equipment",
    "Animal Feeds",
    "Veterinary",
    "Irrigation",
    "Greenhouse",
    "Safety Gear",
  ];

  // Product units
  const units = [
    "kg",
    "g",
    "liters",
    "ml",
    "packet",
    "bag",
    "piece",
    "set",
    "roll",
    "meter",
  ];

  // Sample products data
  const allProducts = [];

  // Fertilizers (available in most shops)
  const fertilizers = [
    {
      name: "CAN (Calcium Ammonium Nitrate) 50kg",
      description:
        "High nitrogen fertilizer for leafy vegetables and cereals. Promotes vegetative growth.",
      price: 3200,
      currency: "KES",
      unit: "bag",
      category: "Fertilizers",
      imageUrl:
        "https://images.unsplash.com/photo-1589923186741-b7d59d6b2c4c?w=800&auto=format&fit=crop",
      variations: ["50kg bag", "25kg bag"],
    },
    {
      name: "DAP (Diammonium Phosphate) 50kg",
      description:
        "Essential for root development and flowering. Perfect for cereal crops.",
      price: 4200,
      currency: "KES",
      unit: "bag",
      category: "Fertilizers",
      imageUrl:
        "https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=800&auto=format&fit=crop",
      variations: ["50kg bag"],
    },
    {
      name: "NPK 17:17:17 50kg",
      description:
        "Balanced fertilizer suitable for all crops. Contains equal parts Nitrogen, Phosphorus, Potassium.",
      price: 4500,
      currency: "KES",
      unit: "bag",
      category: "Fertilizers",
      imageUrl:
        "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800&auto=format&fit=crop",
    },
    {
      name: "UREA 50kg",
      description:
        "High nitrogen content fertilizer for quick growth. Best for maize and rice.",
      price: 2800,
      currency: "KES",
      unit: "bag",
      category: "Fertilizers",
    },
    {
      name: "Mavuno Fertilizer 25kg",
      description:
        "Compound fertilizer with micronutrients. Specifically formulated for Kenyan soils.",
      price: 2400,
      currency: "KES",
      unit: "bag",
      category: "Fertilizers",
    },
  ];

  // Pesticides
  const pesticides = [
    {
      name: "Karate 2.5EC 1L",
      description:
        "Broad spectrum insecticide for control of aphids, thrips, and caterpillars.",
      price: 1850,
      currency: "KES",
      unit: "liter",
      category: "Pesticides",
      imageUrl:
        "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&auto=format&fit=crop",
    },
    {
      name: "Actara 25WG 100g",
      description:
        "Systemic insecticide for sucking pests. Long-lasting protection.",
      price: 1200,
      currency: "KES",
      unit: "packet",
      category: "Pesticides",
    },
    {
      name: "Bestox 5EC 500ml",
      description: "Contact insecticide for fast knockdown of flying insects.",
      price: 850,
      currency: "KES",
      unit: "ml",
      category: "Pesticides",
    },
  ];

  // Herbicides
  const herbicides = [
    {
      name: "Roundup Turbo 1L",
      description:
        "Non-selective herbicide for total weed control. Systemic action.",
      price: 1950,
      currency: "KES",
      unit: "liter",
      category: "Herbicides",
      imageUrl:
        "https://images.unsplash.com/photo-1579113800032-c38bd7635818?w=800&auto=format&fit=crop",
    },
    {
      name: "Primextra Gold 1L",
      description:
        "Pre-emergence herbicide for maize and beans. Controls grasses and broadleaf weeds.",
      price: 2200,
      currency: "KES",
      unit: "liter",
      category: "Herbicides",
    },
    {
      name: "2,4-D Amine 1L",
      description: "Selective herbicide for broadleaf weed control in cereals.",
      price: 950,
      currency: "KES",
      unit: "liter",
      category: "Herbicides",
    },
  ];

  // Seeds
  const seeds = [
    {
      name: "SC Duma 43 Maize Seeds 10kg",
      description:
        "High yielding, drought tolerant hybrid maize. Maturity: 120-130 days.",
      price: 4500,
      currency: "KES",
      unit: "bag",
      category: "Seeds",
      imageUrl:
        "https://images.unsplash.com/photo-1590419690008-905895e8fe0d?w=800&auto=format&fit=crop",
    },
    {
      name: "KAT B9 Bean Seeds 5kg",
      description: "Disease resistant bean variety. High yield potential.",
      price: 2800,
      currency: "KES",
      unit: "bag",
      category: "Seeds",
    },
    {
      name: "Tomato Anna F1 Seeds 100g",
      description:
        "Hybrid tomato seeds. Fruit weight: 180-200g. Resistant to TYLCV.",
      price: 1200,
      currency: "KES",
      unit: "packet",
      category: "Seeds",
    },
    {
      name: "Kales Seeds 500g",
      description:
        "Sukuma wiki (collard greens) seeds. Quick maturity: 45-60 days.",
      price: 650,
      currency: "KES",
      unit: "packet",
      category: "Seeds",
    },
  ];

  // Tools & Equipment
  const tools = [
    {
      name: "Jembe (Garden Hoe)",
      description: "Traditional African hoe for land preparation and weeding.",
      price: 850,
      currency: "KES",
      unit: "piece",
      category: "Tools & Equipment",
      imageUrl:
        "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=800&auto=format&fit=crop",
    },
    {
      name: "Panga (Machete)",
      description: "Heavy duty machete for clearing bushes and harvesting.",
      price: 1200,
      currency: "KES",
      unit: "piece",
      category: "Tools & Equipment",
    },
    {
      name: "Sprayer 20L",
      description: "Knapsack sprayer for applying pesticides and foliar feeds.",
      price: 4500,
      currency: "KES",
      unit: "piece",
      category: "Tools & Equipment",
    },
    {
      name: "Watering Can 10L",
      description: "Plastic watering can for seedlings and small gardens.",
      price: 750,
      currency: "KES",
      unit: "piece",
      category: "Tools & Equipment",
    },
  ];

  // Animal Feeds
  const animalFeeds = [
    {
      name: "Layers Mash 70kg",
      description:
        "Complete feed for laying hens. Contains calcium for strong eggshells.",
      price: 3800,
      currency: "KES",
      unit: "bag",
      category: "Animal Feeds",
    },
    {
      name: "Dairy Meal 70kg",
      description:
        "High energy feed for dairy cows. Increases milk production.",
      price: 4200,
      currency: "KES",
      unit: "bag",
      category: "Animal Feeds",
    },
    {
      name: "Pig Grower 50kg",
      description: "Balanced feed for growing pigs. Promotes fast weight gain.",
      price: 3500,
      currency: "KES",
      unit: "bag",
      category: "Animal Feeds",
    },
  ];

  // Veterinary Products
  const veterinary = [
    {
      name: "Oxytetracycline 20% 100ml",
      description: "Broad spectrum antibiotic for livestock.",
      price: 850,
      currency: "KES",
      unit: "bottle",
      category: "Veterinary",
    },
    {
      name: "Ivermectin 1% 50ml",
      description: "Dewormer for internal and external parasites.",
      price: 1200,
      currency: "KES",
      unit: "bottle",
      category: "Veterinary",
    },
  ];

  // Combine all products
  const productTemplates = [
    ...fertilizers,
    ...pesticides,
    ...herbicides,
    ...seeds,
    ...tools,
    ...animalFeeds,
    ...veterinary,
  ];

  // Assign products to shops
  let productId = 1;
  shops.forEach((shop, shopIndex) => {
    // Determine how many products each shop gets based on shop size
    let productCount;
    if (shopIndex < 3) {
      productCount = 15; // Large shops
    } else if (shopIndex < 6) {
      productCount = 10; // Medium shops
    } else {
      productCount = 6; // Small shops
    }

    // Select random products for this shop
    const selectedTemplates = [];
    const usedIndices = new Set();

    while (
      selectedTemplates.length < productCount &&
      selectedTemplates.length < productTemplates.length
    ) {
      const randomIndex = Math.floor(Math.random() * productTemplates.length);
      if (!usedIndices.has(randomIndex)) {
        usedIndices.add(randomIndex);
        selectedTemplates.push(productTemplates[randomIndex]);
      }
    }

    // Create product instances for this shop
    selectedTemplates.forEach((template) => {
      // Add price variation (± 10-20%)
      const priceVariation = template.price * (0.9 + Math.random() * 0.2);
      const roundedPrice = Math.round(priceVariation / 50) * 50; // Round to nearest 50

      const product = {
        id: `prod_${shop.id}_${productId.toString().padStart(3, "0")}`,
        name: template.name,
        description: template.description,
        price: roundedPrice,
        currency: template.currency,
        unit: template.unit,
        category: template.category,
        imageUrl: template.imageUrl || "",
        shopId: shop.id,
        shopName: shop.name,
        inStock: Math.random() > 0.1, // 90% in stock
        isActive: true,
        minOrder:
          template.unit === "bag" ? 1 : template.unit === "liter" ? 0.5 : 1,
        ...getTimestamp(),
      };

      allProducts.push(product);
      productId++;
    });
  });

  // Add some products that appear in multiple shops (with different prices)
  const popularProducts = [
    {
      name: "SC Duma 43 Maize Seeds 10kg",
      description: "High yielding, drought tolerant hybrid maize.",
      basePrice: 4500,
      category: "Seeds",
      unit: "bag",
    },
    {
      name: "CAN Fertilizer 50kg",
      description: "High nitrogen fertilizer for leafy growth.",
      basePrice: 3200,
      category: "Fertilizers",
      unit: "bag",
    },
    {
      name: "Roundup Turbo 1L",
      description: "Non-selective herbicide for weed control.",
      basePrice: 1950,
      category: "Herbicides",
      unit: "liter",
    },
  ];

  // Add popular products to multiple shops
  popularProducts.forEach((popularProduct, index) => {
    // Select 3-5 random shops to carry this product
    const shopCount = 3 + Math.floor(Math.random() * 3);
    const selectedShopIndices = new Set();

    while (selectedShopIndices.size < shopCount) {
      const randomShopIndex = Math.floor(
        Math.random() * Math.min(8, shops.length),
      );
      selectedShopIndices.add(randomShopIndex);
    }

    selectedShopIndices.forEach((shopIndex) => {
      const shop = shops[shopIndex];
      const priceVariation =
        popularProduct.basePrice * (0.85 + Math.random() * 0.3);
      const roundedPrice = Math.round(priceVariation / 50) * 50;

      const product = {
        id: `prod_pop_${index}_${shop.id}`,
        name: popularProduct.name,
        description: popularProduct.description,
        price: roundedPrice,
        currency: "KES",
        unit: popularProduct.unit,
        category: popularProduct.category,
        shopId: shop.id,
        shopName: shop.name,
        inStock: Math.random() > 0.2, // 80% in stock
        isActive: true,
        popular: true,
        ...getTimestamp(),
      };

      allProducts.push(product);
    });
  });

  try {
    // Batch write products
    const batch = db.batch();
    const productCollection = db.collection("products");

    allProducts.forEach((product) => {
      const docRef = productCollection.doc(product.id);
      batch.set(docRef, product);
    });

    await batch.commit();
    console.log(
      `✅ Successfully seeded ${allProducts.length} products across ${shops.length} shops`,
    );

    return allProducts;
  } catch (error) {
    console.error("❌ Error seeding products:", error);
    throw error;
  }
};

// Run if called directly
if (require.main === module) {
  // We need shops first, so import and run shops seed
  const { seedShops } = require("./seedShops");

  seedShops()
    .then((shops) => seedProducts(shops))
    .then(() => {
      console.log("🎉 Product seeding completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Product seeding failed:", error);
      process.exit(1);
    });
}

module.exports = { seedProducts };
