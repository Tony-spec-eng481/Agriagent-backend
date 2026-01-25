const admin = require("firebase-admin");
const dotenv = require("dotenv");

dotenv.config();

const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const sampleDrugs = [
  {
    name: "Glyphosate 360",
    type: "Herbicide",
    category: "Weed Control",
    activeIngredient: "Glyphosate",
    dosage: "2-3 liters per hectare",
    applicationMethod: "Spray application - mix with water and apply evenly to weeds",
    applicationTiming: "Apply when weeds are actively growing, preferably in the morning",
    harmfulEffects: "Can cause skin irritation, eye damage. Harmful if swallowed. Keep away from water sources.",
    safetyPrecautions: "Wear protective clothing, gloves, and face mask. Do not apply near water bodies. Wait 7 days before planting crops.",
    targetPests: ["Broadleaf weeds", "Grassy weeds", "Perennial weeds"],
    targetCrops: ["Maize", "Wheat", "Soybeans"],
    imageUrl: "https://via.placeholder.com/300x300?text=Glyphosate+360",
    priceRange: "KES 1,500 - 2,000 per liter",
    availability: "Common",
    manufacturer: "AgroChem Industries",
    registrationNumber: "KE-AGR-2024-001",
  },
  {
    name: "Chlorpyrifos 480 EC",
    type: "Insecticide",
    category: "Pest Control",
    activeIngredient: "Chlorpyrifos",
    dosage: "500ml - 1 liter per hectare",
    applicationMethod: "Foliar spray - mix with water and spray on affected plants",
    applicationTiming: "Apply early morning or late evening. Do not apply during flowering.",
    harmfulEffects: "Highly toxic to bees and aquatic life. Can cause neurological effects in humans.",
    safetyPrecautions: "Wear full protective gear. Do not apply near beehives or water sources. Wait 14 days before harvest.",
    targetPests: ["Aphids", "Thrips", "Whiteflies", "Armyworms"],
    targetCrops: ["Maize", "Tomatoes", "Cabbage", "Beans"],
    imageUrl: "https://via.placeholder.com/300x300?text=Chlorpyrifos+480",
    priceRange: "KES 2,000 - 2,500 per liter",
    availability: "Common",
    manufacturer: "CropProtect Ltd",
    registrationNumber: "KE-AGR-2024-002",
  },
  {
    name: "Mancozeb 80 WP",
    type: "Fungicide",
    category: "Disease Control",
    activeIngredient: "Mancozeb",
    dosage: "2-3 kg per hectare",
    applicationMethod: "Spray application - mix with water and apply to foliage",
    applicationTiming: "Apply preventively or at first sign of disease. Repeat every 7-10 days.",
    harmfulEffects: "May cause skin and eye irritation. Harmful if inhaled.",
    safetyPrecautions: "Wear protective clothing and mask. Wash hands after use. Do not apply in windy conditions.",
    targetPests: ["Early blight", "Late blight", "Downy mildew", "Rust"],
    targetCrops: ["Tomatoes", "Potatoes", "Onions", "Wheat"],
    imageUrl: "https://via.placeholder.com/300x300?text=Mancozeb+80",
    priceRange: "KES 800 - 1,200 per kg",
    availability: "Common",
    manufacturer: "Fungicide Solutions",
    registrationNumber: "KE-AGR-2024-003",
  },
  {
    name: "Imidacloprid 200 SL",
    type: "Insecticide",
    category: "Pest Control",
    activeIngredient: "Imidacloprid",
    dosage: "200-300ml per hectare",
    applicationMethod: "Soil drench or foliar spray - mix with water and apply",
    applicationTiming: "Apply at planting or early growth stage. Can be applied as seed treatment.",
    harmfulEffects: "Highly toxic to bees. Can cause nausea and dizziness in humans.",
    safetyPrecautions: "Do not apply during flowering. Keep away from beehives. Wear protective gear.",
    targetPests: ["Aphids", "Whiteflies", "Thrips", "Termites"],
    targetCrops: ["Maize", "Cotton", "Vegetables", "Fruits"],
    imageUrl: "https://via.placeholder.com/300x300?text=Imidacloprid+200",
    priceRange: "KES 3,000 - 3,500 per liter",
    availability: "Common",
    manufacturer: "Insecticide Pro",
    registrationNumber: "KE-AGR-2024-004",
  },
  {
    name: "Copper Oxychloride 50 WP",
    type: "Fungicide",
    category: "Disease Control",
    activeIngredient: "Copper Oxychloride",
    dosage: "2-3 kg per hectare",
    applicationMethod: "Spray application - mix with water and apply evenly",
    applicationTiming: "Apply preventively before disease onset. Repeat every 10-14 days.",
    harmfulEffects: "Can cause skin irritation and eye damage. Harmful if swallowed.",
    safetyPrecautions: "Wear protective clothing. Do not apply in hot weather. Wash hands after use.",
    targetPests: ["Bacterial blight", "Fungal diseases", "Leaf spots"],
    targetCrops: ["Coffee", "Tomatoes", "Beans", "Fruits"],
    imageUrl: "https://via.placeholder.com/300x300?text=Copper+Oxychloride",
    priceRange: "KES 1,000 - 1,500 per kg",
    availability: "Common",
    manufacturer: "Copper Solutions",
    registrationNumber: "KE-AGR-2024-005",
  },
  {
    name: "2,4-D Amine 720",
    type: "Herbicide",
    category: "Weed Control",
    activeIngredient: "2,4-Dichlorophenoxyacetic acid",
    dosage: "1-2 liters per hectare",
    applicationMethod: "Spray application - mix with water and apply to weeds",
    applicationTiming: "Apply when weeds are in active growth stage, preferably in morning",
    harmfulEffects: "Can cause eye and skin irritation. Harmful to aquatic life.",
    safetyPrecautions: "Wear protective gear. Do not apply near sensitive crops. Keep away from water sources.",
    targetPests: ["Broadleaf weeds"],
    targetCrops: ["Maize", "Wheat", "Rice", "Sugarcane"],
    imageUrl: "https://via.placeholder.com/300x300?text=2,4-D+Amine",
    priceRange: "KES 1,200 - 1,800 per liter",
    availability: "Common",
    manufacturer: "WeedControl Inc",
    registrationNumber: "KE-AGR-2024-006",
  },
  {
    name: "Lambda-Cyhalothrin 50 EC",
    type: "Insecticide",
    category: "Pest Control",
    activeIngredient: "Lambda-Cyhalothrin",
    dosage: "200-400ml per hectare",
    applicationMethod: "Foliar spray - mix with water and spray on affected areas",
    applicationTiming: "Apply when pests are first detected. Best applied in evening.",
    harmfulEffects: "Highly toxic to fish and bees. Can cause skin irritation.",
    safetyPrecautions: "Wear full protective equipment. Do not apply near water or beehives. Wait 7 days before harvest.",
    targetPests: ["Armyworms", "Cutworms", "Bollworms", "Leaf miners"],
    targetCrops: ["Maize", "Cotton", "Vegetables", "Fruits"],
    imageUrl: "https://via.placeholder.com/300x300?text=Lambda-Cyhalothrin",
    priceRange: "KES 2,500 - 3,000 per liter",
    availability: "Common",
    manufacturer: "Pyrethroid Solutions",
    registrationNumber: "KE-AGR-2024-007",
  },
  {
    name: "Metalaxyl-M 35 FS",
    type: "Fungicide",
    category: "Disease Control",
    activeIngredient: "Metalaxyl-M",
    dosage: "Seed treatment: 2-3ml per kg of seed",
    applicationMethod: "Seed treatment - coat seeds before planting",
    applicationTiming: "Apply to seeds before planting",
    harmfulEffects: "Low toxicity but may cause skin irritation.",
    safetyPrecautions: "Wear gloves when handling treated seeds. Store in cool, dry place.",
    targetPests: ["Damping off", "Root rot", "Seedling diseases"],
    targetCrops: ["Maize", "Beans", "Peas", "Sunflower"],
    imageUrl: "https://via.placeholder.com/300x300?text=Metalaxyl-M",
    priceRange: "KES 4,000 - 5,000 per liter",
    availability: "Moderate",
    manufacturer: "SeedProtect Ltd",
    registrationNumber: "KE-AGR-2024-008",
  },
  {
    name: "Atrazine 500 SC",
    type: "Herbicide",
    category: "Weed Control",
    activeIngredient: "Atrazine",
    dosage: "2-3 liters per hectare",
    applicationMethod: "Pre-emergence or early post-emergence spray",
    applicationTiming: "Apply before weeds emerge or when they are very small",
    harmfulEffects: "Can contaminate groundwater. May cause eye irritation.",
    safetyPrecautions: "Wear protective clothing. Do not apply near water sources. Follow label instructions carefully.",
    targetPests: ["Annual grasses", "Broadleaf weeds"],
    targetCrops: ["Maize", "Sugarcane"],
    imageUrl: "https://via.placeholder.com/300x300?text=Atrazine+500",
    priceRange: "KES 1,800 - 2,200 per liter",
    availability: "Common",
    manufacturer: "Herbicide Pro",
    registrationNumber: "KE-AGR-2024-009",
  },
  {
    name: "Deltamethrin 25 EC",
    type: "Insecticide",
    category: "Pest Control",
    activeIngredient: "Deltamethrin",
    dosage: "200-300ml per hectare",
    applicationMethod: "Foliar spray - mix with water and apply",
    applicationTiming: "Apply when pests are detected. Best in evening.",
    harmfulEffects: "Highly toxic to bees and aquatic organisms.",
    safetyPrecautions: "Do not apply during flowering. Wear protective gear. Keep away from water.",
    targetPests: ["Aphids", "Thrips", "Whiteflies", "Leafhoppers"],
    targetCrops: ["Vegetables", "Fruits", "Cotton", "Maize"],
    imageUrl: "https://via.placeholder.com/300x300?text=Deltamethrin+25",
    priceRange: "KES 2,200 - 2,800 per liter",
    availability: "Common",
    manufacturer: "Pyrethroid Pro",
    registrationNumber: "KE-AGR-2024-010",
  },
];

async function seedDrugs() {
  try {
    console.log("Seeding drugs data...");

    const batch = db.batch();

    sampleDrugs.forEach((drug) => {
      const drugRef = db.collection("drugs").doc();
      batch.set(drugRef, {
        ...drug,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        isActive: true,
      });
    });

    await batch.commit();

    console.log(`Successfully seeded ${sampleDrugs.length} drugs!`);
    process.exit(0);
  } catch (error) {
    console.error("Error seeding drugs:", error);
    process.exit(1);
  }
}

seedDrugs();
