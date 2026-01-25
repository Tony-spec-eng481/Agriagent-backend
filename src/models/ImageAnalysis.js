const { db, FieldValue } = require("../config/firebase.config");

class ImageAnalysis {
  constructor(data) {
    this.id = data.id;
    this.userId = data.userId;
    this.imageUrl = data.imageUrl;
    this.analysis = data.analysis;
    this.drugInfo = data.drugInfo;
    this.location = data.location;
    this.chatId = data.chatId || `img_${Date.now()}`;
    this.timestamp = data.timestamp || new Date();
    this.createdAt = data.createdAt || new Date();
  }

  // Save analysis to Firestore
  async save() {
    const analysisData = {
      userId: this.userId,
      imageUrl: this.imageUrl,
      analysis: this.analysis,
      drugInfo: this.drugInfo,
      location: this.location,
      chatId: this.chatId,
      timestamp: FieldValue.serverTimestamp(),
      createdAt: new Date(),
    };

    let docRef;

    if (this.id) {
      await db
        .collection("imageAnalysis")
        .doc(this.id)
        .set(analysisData, { merge: true });
      docRef = this.id;
    } else {
      docRef = await db.collection("imageAnalysis").add(analysisData);
      this.id = docRef.id;
    }

    return this;
  }

  // Get analysis by ID
  static async findById(id) {
    const analysisDoc = await db.collection("imageAnalysis").doc(id).get();

    if (!analysisDoc.exists) {
      return null;
    }

    return new ImageAnalysis({ id: analysisDoc.id, ...analysisDoc.data() });
  }

  // Get user's image analyses
  static async findByUserId(userId, options = {}) {
    const { limit = 20, startAfter, startDate, endDate } = options;

    let query = db
      .collection("imageAnalysis")
      .where("userId", "==", userId)
      .orderBy("timestamp", "desc");

    if (startDate) {
      query = query.where("timestamp", ">=", new Date(startDate));
    }

    if (endDate) {
      query = query.where("timestamp", "<=", new Date(endDate));
    }

    if (startAfter) {
      const startAfterDoc = await db
        .collection("imageAnalysis")
        .doc(startAfter)
        .get();
      query = query.startAfter(startAfterDoc);
    }

    query = query.limit(limit);

    const snapshot = await query.get();

    return snapshot.docs.map(
      (doc) => new ImageAnalysis({ id: doc.id, ...doc.data() })
    );
  }

  // Delete analysis
  async delete() {
    if (!this.id) {
      throw new Error("Analysis ID is required for deletion");
    }

    await db.collection("imageAnalysis").doc(this.id).delete();
    return true;
  }

  // Delete all analyses for a user
  static async deleteByUserId(userId) {
    const snapshot = await db
      .collection("imageAnalysis")
      .where("userId", "==", userId)
      .get();

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    return snapshot.size;
  }

  // Search analyses by keyword
  static async search(userId, keyword, options = {}) {
    const { limit = 20 } = options;

    const snapshot = await db
      .collection("imageAnalysis")
      .where("userId", "==", userId)
      .orderBy("timestamp", "desc")
      .limit(100) // Get more to filter locally
      .get();

    const keywordLower = keyword.toLowerCase();

    const results = snapshot.docs
      .map((doc) => new ImageAnalysis({ id: doc.id, ...doc.data() }))
      .filter((analysis) =>
        analysis.analysis.toLowerCase().includes(keywordLower)
      )
      .slice(0, limit);

    return results;
  }

  // Get analysis statistics for user
  static async getStats(userId) {
    const snapshot = await db
      .collection("imageAnalysis")
      .where("userId", "==", userId)
      .get();

    const analyses = snapshot.docs.map((doc) => doc.data());

    const stats = {
      total: analyses.length,
      byMonth: {},
      withDrugInfo: analyses.filter((a) => a.drugInfo).length,
      uniqueLocations: new Set(
        analyses
          .filter((a) => a.location)
          .map(
            (a) => `${a.location.lat.toFixed(2)},${a.location.lng.toFixed(2)}`
          )
      ).size,
    };

    // Group by month
    analyses.forEach((analysis) => {
      const date = analysis.timestamp?.toDate() || new Date();
      const monthYear = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`;

      stats.byMonth[monthYear] = (stats.byMonth[monthYear] || 0) + 1;
    });

    return stats;
  }

  // Export analysis to different formats
  async export(format = "text") {
    const formats = {
      text: this.toText(),
      json: this.toJSON(),
      html: this.toHTML(),
      pdf: this.toPDF(),
    };

    return formats[format] || this.toText();
  }

  toText() {
    return `
AGRICULTURAL IMAGE ANALYSIS REPORT
===================================

Report ID: ${this.id}
User ID: ${this.userId}
Date: ${this.timestamp?.toLocaleString() || new Date().toLocaleString()}
Location: ${JSON.stringify(this.location) || "Not specified"}
Image URL: ${this.imageUrl}

ANALYSIS:
${this.analysis}

${
  this.drugInfo
    ? `
RECOMMENDED TREATMENTS:
${"-".repeat(30)}

${this.drugInfo.drugs
  ?.map(
    (drug, index) => `
${index + 1}. ${drug.name}
   Dosage: ${drug.dosage}
   Application: ${drug.application}
   Safety: ${drug.safety}
   
   Available at:
   ${
     drug.nearbyShops
       ?.map((shop) => `   • ${shop.name} (${shop.distance})`)
       .join("\n   ") || "   Not available nearby"
   }
`
  )
  .join("\n")}

`
    : ""
}

ADDITIONAL NOTES:
• This analysis is generated by AI and should be verified by experts
• Always follow safety precautions when applying treatments
• Consult local agricultural authorities for specific recommendations

Generated by Agri AI Assistant
${new Date().toLocaleString()}
    `.trim();
  }

  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      imageUrl: this.imageUrl,
      analysis: this.analysis,
      drugInfo: this.drugInfo,
      location: this.location,
      timestamp: this.timestamp,
      createdAt: this.createdAt,
    };
  }

  toHTML() {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Agricultural Image Analysis Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { border-bottom: 2px solid #4CAF50; padding-bottom: 20px; margin-bottom: 30px; }
        .section { margin-bottom: 30px; }
        .drug { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Agricultural Image Analysis Report</h1>
        <p><strong>Report ID:</strong> ${this.id}</p>
        <p><strong>Date:</strong> ${this.timestamp?.toLocaleString()}</p>
        <p><strong>Location:</strong> ${
          JSON.stringify(this.location) || "Not specified"
        }</p>
        ${
          this.imageUrl
            ? `<p><strong>Image:</strong> <a href="${this.imageUrl}">${this.imageUrl}</a></p>`
            : ""
        }
    </div>
    
    <div class="section">
        <h2>Analysis Results</h2>
        <p>${this.analysis.replace(/\n/g, "<br>")}</p>
    </div>
    
    ${
      this.drugInfo
        ? `
    <div class="section">
        <h2>Recommended Treatments</h2>
        ${this.drugInfo.drugs
          ?.map(
            (drug) => `
        <div class="drug">
            <h3>${drug.name}</h3>
            <p><strong>Dosage:</strong> ${drug.dosage}</p>
            <p><strong>Application:</strong> ${drug.application}</p>
            <p><strong>Safety:</strong> ${drug.safety}</p>
            ${
              drug.nearbyShops?.length > 0
                ? `
            <p><strong>Available at:</strong></p>
            <ul>
                ${drug.nearbyShops
                  .map((shop) => `<li>${shop.name} (${shop.distance})</li>`)
                  .join("")}
            </ul>
            `
                : ""
            }
        </div>
        `
          )
          .join("")}
    </div>
    `
        : ""
    }
    
    <div class="footer">
        <p><em>This analysis is generated by AI and should be used as a guide only.</em></p>
        <p><em>Always consult with qualified agricultural professionals for accurate diagnosis and treatment.</em></p>
        <p>Generated by Agri AI Assistant • ${new Date().toLocaleString()}</p>
    </div>
</body>
</html>
    `.trim();
  }

  toPDF() {
    // In a real implementation, this would generate a PDF
    // For now, return the HTML version
    return this.toHTML();
  }

  // Get summary for display
  getSummary() {
    const summary = {
      id: this.id,
      date:
        this.timestamp?.toLocaleDateString() || new Date().toLocaleDateString(),
      imageUrl: this.imageUrl,
      analysisPreview:
        this.analysis.substring(0, 200) +
        (this.analysis.length > 200 ? "..." : ""),
      hasDrugInfo: !!this.drugInfo,
      drugCount: this.drugInfo?.drugs?.length || 0,
      location: this.location,
    };

    return summary;
  }
}

module.exports = ImageAnalysis;
