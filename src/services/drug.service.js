const { db } = require("../config/firebase.config");

class DrugService {
  // Extract keywords from text to search for relevant drugs
  extractKeywords(text) {
    const lowerText = text.toLowerCase();
    const keywords = [];

    const pestKeywords = [
      "aphid",
      "thrip",
      "whitefly",
      "armyworm",
      "cutworm",
      "bollworm",
      "leaf miner",
      "termite",
      "bug",
      "insect",
    ];

    const diseaseKeywords = [
      "blight",
      "mildew",
      "rust",
      "rot",
      "wilt",
      "spot",
      "scab",
      "anthracnose",
      "fungus",
      "bacteria",
      "virus",
    ];

    const weedKeywords = ["weed", "grass", "broadleaf", "herbicide"];

    pestKeywords.forEach((keyword) => {
      if (lowerText.includes(keyword)) keywords.push(keyword);
    });

    diseaseKeywords.forEach((keyword) => {
      if (lowerText.includes(keyword)) keywords.push(keyword);
    });

    weedKeywords.forEach((keyword) => {
      if (lowerText.includes(keyword)) keywords.push(keyword);
    });

    return keywords;
  }

  // Get drug recommendations based on analysis text
  async getRecommendations(analysisText, location = null) {
    try {
      const keywords = this.extractKeywords(analysisText);
      const lowerText = analysisText.toLowerCase();

      const drugsSnapshot = await db
        .collection("drugs")
        .where("isActive", "==", true)
        .get();

      if (drugsSnapshot.empty) {
        return {
          drugs: [],
          message: "No drugs found in database.",
        };
      }

      const allDrugs = drugsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Score drugs based on relevance
      const scoredDrugs = allDrugs.map((drug) => {
        let score = 0;
        const drugLower = JSON.stringify(drug).toLowerCase();

        // Check target pests
        if (drug.targetPests && Array.isArray(drug.targetPests)) {
          drug.targetPests.forEach((target) => {
            if (lowerText.includes(target.toLowerCase())) {
              score += 10;
            }
          });
        }

        // Check drug type based on analysis
        if (lowerText.includes("pest") && drug.type === "Insecticide")
          score += 5;
        if (lowerText.includes("disease") && drug.type === "Fungicide")
          score += 5;
        if (lowerText.includes("weed") && drug.type === "Herbicide") score += 5;

        // Check keywords
        keywords.forEach((keyword) => {
          if (drugLower.includes(keyword)) score += 3;
        });

        // Location-based scoring (if drug has location preference)
        if (location && drug.preferredLocations) {
          if (drug.preferredLocations.includes(location)) {
            score += 2;
          }
        }

        return { ...drug, relevanceScore: score };
      });

      // Get top recommended drugs
      const recommendedDrugs = scoredDrugs
        .filter((d) => d.relevanceScore > 0)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 5)
        .map(({ relevanceScore, ...drug }) => drug);

      // Format response
      if (recommendedDrugs.length === 0) {
        return {
          drugs: allDrugs.slice(0, 3).map((d) => ({
            id: d.id,
            name: d.name,
            type: d.type,
            dosage: d.dosage,
            applicationMethod: d.applicationMethod,
            applicationTiming: d.applicationTiming,
            harmfulEffects: d.harmfulEffects,
            safetyPrecautions: d.safetyPrecautions,
          })),
          message:
            "General recommendations (not specifically matched to your issue)",
        };
      }

      return {
        drugs: recommendedDrugs.map((d) => ({
          id: d.id,
          name: d.name,
          type: d.type,
          category: d.category,
          activeIngredient: d.activeIngredient,
          dosage: d.dosage,
          applicationMethod: d.applicationMethod,
          applicationTiming: d.applicationTiming,
          harmfulEffects: d.harmfulEffects,
          safetyPrecautions: d.safetyPrecautions,
          imageUrl: d.imageUrl,
          targetPests: d.targetPests,
          targetCrops: d.targetCrops,
          priceRange: d.priceRange,
          availability: d.availability,
        })),
        message: "Recommended treatments based on your analysis",
      };
    } catch (error) {
      console.error("Error getting drug recommendations:", error);
      return {
        drugs: [],
        message: "Error fetching drug recommendations",
      };
    }
  }

  // Get drug by ID
  async getDrugById(drugId) {
    try {
      const drugDoc = await db.collection("drugs").doc(drugId).get();

      if (!drugDoc.exists) {
        return null;
      }

      return {
        id: drugDoc.id,
        ...drugDoc.data(),
      };
    } catch (error) {
      console.error("Error getting drug by ID:", error);
      throw error;
    }
  }

  // Search drugs
  async searchDrugs(query, filters = {}) {
    try {
      let drugsQuery = db.collection("drugs").where("isActive", "==", true);

      // Apply filters
      if (filters.type) {
        drugsQuery = drugsQuery.where("type", "==", filters.type);
      }

      if (filters.category) {
        drugsQuery = drugsQuery.where("category", "==", filters.category);
      }

      const snapshot = await drugsQuery.get();

      if (snapshot.empty) {
        return [];
      }

      const allDrugs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Filter by query if provided
      if (query) {
        const lowerQuery = query.toLowerCase();
        return allDrugs.filter(
          (drug) =>
            drug.name.toLowerCase().includes(lowerQuery) ||
            drug.activeIngredient?.toLowerCase().includes(lowerQuery) ||
            drug.targetPests?.some((pest) =>
              pest.toLowerCase().includes(lowerQuery)
            )
        );
      }

      return allDrugs;
    } catch (error) {
      console.error("Error searching drugs:", error);
      throw error;
    }
  }
}

module.exports = new DrugService();
