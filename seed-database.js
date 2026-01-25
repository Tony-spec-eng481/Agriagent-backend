// scripts/seed-database.js
// const { clearCollection } = require("./src/config/firebase.config");
const { seedShops } = require("./seedShops");
const { seedProducts } = require("./seedProducts");

const seedDatabase = async () => {
  console.log("🌱 Starting database seeding...");

  try {
    // Optionally clear existing data (uncomment if needed)
    // await clearCollection('shops');
    // await clearCollection('products');
    // await clearCollection('reviews');

    // Seed shops first
    const shops = await seedShops();

    // Seed products (requires shops)
    const products = await seedProducts(shops);

    // Seed some sample reviews (optional)
    await seedSampleReviews(shops);

    console.log("🎉 Database seeding completed successfully!");
    console.log(`📊 Summary:`);
    console.log(`   - ${shops.length} shops seeded`);
    console.log(`   - ${products.length} products seeded`);
  } catch (error) {
    console.error("💥 Database seeding failed:", error);
    throw error;
  }
};

// Optional: Seed sample reviews
const seedSampleReviews = async (shops) => {
  console.log("📝 Seeding sample reviews...");

  const reviews = [];
  const reviewTexts = [
    "Great quality products and excellent service. Will definitely buy again!",
    "Prices are reasonable and the staff is very knowledgeable.",
    "Products always fresh and delivery is prompt. Highly recommended!",
    "Good variety of farm inputs. Saved me a trip to Nairobi.",
    "The agrovet officer gave me valuable advice on pest control.",
    "Authentic products, not counterfeit like some other shops.",
    "Clean and organized shop. Easy to find what you need.",
    "Bulk discounts available for large orders. Very farmer-friendly.",
    "Open early and close late. Convenient for farmers.",
    "They accept M-Pesa which makes payment very easy.",
  ];

  // Create some reviews for each shop
  shops.forEach((shop) => {
    const reviewCount = Math.floor(Math.random() * 5) + 3; // 3-7 reviews per shop

    for (let i = 0; i < reviewCount; i++) {
      const rating = Math.floor(Math.random() * 2) + 4; // 4-5 stars
      const randomReview =
        reviewTexts[Math.floor(Math.random() * reviewTexts.length)];

      reviews.push({
        id: `review_${shop.id}_${i}`,
        shopId: shop.id,
        userId: `user_${Math.floor(Math.random() * 1000)}`,
        userName: [
          "John Mwangi",
          "Mary Wanjiku",
          "Peter Kamau",
          "Sarah Atieno",
          "James Ochieng",
        ][Math.floor(Math.random() * 5)],
        rating: rating,
        comment: randomReview,
        isActive: true,
        createdAt: new Date(
          Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000,
        ).toISOString(), // Random date in last 90 days
        updatedAt: new Date().toISOString(),
      });
    }
  });

  try {
    const batch = require("./seed-config").db.batch();
    const reviewCollection = require("./seed-config").db.collection("reviews");

    reviews.forEach((review) => {
      const docRef = reviewCollection.doc(review.id);
      batch.set(docRef, review);
    });

    await batch.commit();
    console.log(`✅ Seeded ${reviews.length} sample reviews`);
  } catch (error) {
    console.warn("⚠️ Could not seed reviews:", error.message);
  }
};

// Run seeding
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log(
        "✨ All done! Your database is now populated with sample data.",
      );
      console.log("\n💡 Next steps:");
      console.log("   1. Start your backend server: npm start");
      console.log("   2. Run your React Native app");
      console.log("   3. The shops and products will appear automatically");
      process.exit(0);
    })
    .catch((error) => {
      console.error("🔥 Seeding failed:", error);
      process.exit(1);
    });
}

module.exports = { seedDatabase };
