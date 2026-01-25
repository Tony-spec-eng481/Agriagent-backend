const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

class DownloadUtil {
  // Generate text file
  generateTextFile(data, filename = "analysis.txt") {
    let content = "";

    if (data.type === "chat") {
      content = this.formatChatForDownload(data);
    } else if (data.type === "analysis") {
      content = this.formatAnalysisForDownload(data);
    } else if (data.type === "history") {
      content = this.formatHistoryForDownload(data);
    } else {
      content = JSON.stringify(data, null, 2);
    }

    return {
      content,
      filename,
      type: "text/plain",
    };
  }

  // Generate PDF file
  async generatePDF(data, filename = "analysis.pdf") {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          margin: 50,
          size: "A4",
          info: {
            Title: "Agricultural Analysis Report",
            Author: "Agri AI Assistant",
            Subject: "Agricultural Analysis",
            Keywords: "agriculture, analysis, report",
            CreationDate: new Date(),
          },
        });

        const chunks = [];

        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => {
          const pdfBuffer = Buffer.concat(chunks);
          resolve({
            content: pdfBuffer,
            filename,
            type: "application/pdf",
          });
        });

        this.addPDFContent(doc, data);
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  // Generate CSV file
  generateCSV(data, filename = "data.csv") {
    let content = "";

    if (Array.isArray(data)) {
      if (data.length > 0) {
        // Create headers from first object
        const headers = Object.keys(data[0]);
        content += headers.join(",") + "\n";

        // Add rows
        data.forEach((item) => {
          const row = headers.map((header) => {
            let value = item[header];

            // Handle special cases
            if (value === null || value === undefined) {
              value = "";
            } else if (typeof value === "object") {
              value = JSON.stringify(value);
            } else if (typeof value === "string" && value.includes(",")) {
              value = `"${value}"`;
            }

            return value;
          });

          content += row.join(",") + "\n";
        });
      }
    }

    return {
      content,
      filename,
      type: "text/csv",
    };
  }

  // Format chat for download
  formatChatForDownload(chat) {
    let content = "AGRI AI ASSISTANT - CHAT EXPORT\n";
    content += "=".repeat(50) + "\n\n";

    content += `Chat ID: ${chat.id || "N/A"}\n`;
    content += `Date: ${new Date(
      chat.timestamp || Date.now()
    ).toLocaleString()}\n`;
    content += `User: ${chat.userId || "Anonymous"}\n\n`;

    content += "CONVERSATION:\n";
    content += "-".repeat(50) + "\n\n";

    if (chat.messages && Array.isArray(chat.messages)) {
      chat.messages.forEach((msg, index) => {
        content += `${index + 1}. ${
          msg.sender === "user" ? "You" : "AI Assistant"
        }\n`;
        content += `   Time: ${new Date(msg.timestamp).toLocaleTimeString()}\n`;
        content += `   Message: ${msg.text}\n\n`;

        if (msg.drugInfo) {
          content += "   Recommended Treatments:\n";
          msg.drugInfo.drugs?.forEach((drug, i) => {
            content += `   ${i + 1}. ${drug.name}\n`;
            content += `      Dosage: ${drug.dosage}\n`;
            content += `      Application: ${drug.application}\n`;
          });
          content += "\n";
        }
      });
    }

    content += "=".repeat(50) + "\n";
    content += "End of conversation\n";
    content += `Exported on: ${new Date().toLocaleString()}\n`;

    return content;
  }

  // Format analysis for download
  formatAnalysisForDownload(analysis) {
    let content = "AGRICULTURAL ANALYSIS REPORT\n";
    content += "=".repeat(50) + "\n\n";

    content += `Report ID: ${analysis.id || "N/A"}\n`;
    content += `Date: ${new Date(
      analysis.timestamp || Date.now()
    ).toLocaleString()}\n`;
    content += `Location: ${analysis.location || "Not specified"}\n\n`;

    if (analysis.imageUrl) {
      content += `Image URL: ${analysis.imageUrl}\n\n`;
    }

    content += "ANALYSIS RESULTS:\n";
    content += "-".repeat(50) + "\n";
    content += analysis.analysis + "\n\n";

    if (analysis.drugInfo && analysis.drugInfo.drugs) {
      content += "RECOMMENDED TREATMENTS:\n";
      content += "-".repeat(50) + "\n";

      analysis.drugInfo.drugs.forEach((drug, index) => {
        content += `${index + 1}. ${drug.name}\n`;
        content += `   Brand: ${drug.brand || "N/A"}\n`;
        content += `   Dosage: ${drug.dosage}\n`;
        content += `   Application: ${drug.application}\n`;
        content += `   Safety Precautions: ${drug.safety}\n`;

        if (drug.nearbyShops && drug.nearbyShops.length > 0) {
          content += `   Available at:\n`;
          drug.nearbyShops.forEach((shop) => {
            content += `      • ${shop.name} (${
              shop.distance || "Unknown distance"
            })\n`;
          });
        }

        content += "\n";
      });
    }

    content += "ADDITIONAL RECOMMENDATIONS:\n";
    content += "-".repeat(50) + "\n";
    content += "1. Monitor the affected area regularly\n";
    content += "2. Follow all safety precautions when applying treatments\n";
    content += "3. Consult with local agricultural extension officers\n";
    content += "4. Keep records of all treatments applied\n";
    content += "5. Consider crop rotation to prevent future issues\n\n";

    content += "DISCLAIMER:\n";
    content += "-".repeat(50) + "\n";
    content +=
      "This analysis is generated by AI and should be used as a guide only.\n";
    content +=
      "Always consult with qualified agricultural professionals for accurate diagnosis and treatment.\n";
    content +=
      "Follow local regulations and guidelines for pesticide and fertilizer use.\n\n";

    content += "=".repeat(50) + "\n";
    content += "Generated by Agri AI Assistant\n";
    content += new Date().toLocaleString();

    return content;
  }

  // Format history for download
  formatHistoryForDownload(history) {
    let content = "AGRI AI ASSISTANT - HISTORY EXPORT\n";
    content += "=".repeat(50) + "\n\n";

    content += `Export Date: ${new Date().toLocaleString()}\n`;
    content += `Total Items: ${history.items?.length || 0}\n\n`;

    content += "HISTORY ITEMS:\n";
    content += "-".repeat(50) + "\n\n";

    if (history.items && Array.isArray(history.items)) {
      history.items.forEach((item, index) => {
        content += `ITEM ${index + 1}\n`;
        content += `Type: ${item.type || "chat"}\n`;
        content += `Date: ${new Date(item.timestamp).toLocaleString()}\n`;

        if (item.message) {
          content += `Question: ${item.message}\n`;
        }

        if (item.response) {
          content += `Response: ${item.response.substring(0, 500)}${
            item.response.length > 500 ? "..." : ""
          }\n`;
        }

        if (item.analysis) {
          content += `Analysis: ${item.analysis.substring(0, 500)}${
            item.analysis.length > 500 ? "..." : ""
          }\n`;
        }

        content += "\n" + "-".repeat(40) + "\n\n";
      });
    }

    content += "=".repeat(50) + "\n";
    content += "End of history export\n";

    return content;
  }

  // Add content to PDF
  addPDFContent(doc, data) {
    // Add header
    doc
      .fontSize(20)
      .font("Helvetica-Bold")
      .text("Agricultural Analysis Report", { align: "center" });

    doc.moveDown();

    // Add metadata
    doc
      .fontSize(10)
      .font("Helvetica")
      .text(`Report ID: ${data.id || "N/A"}`);
    doc.text(
      `Date: ${new Date(data.timestamp || Date.now()).toLocaleString()}`
    );
    doc.text(`Location: ${data.location || "Not specified"}`);

    if (data.imageUrl) {
      doc.text(`Image: ${data.imageUrl}`);
    }

    doc.moveDown();

    // Add analysis section
    doc.fontSize(14).font("Helvetica-Bold").text("Analysis Results:");

    doc.moveDown(0.5);

    doc
      .fontSize(10)
      .font("Helvetica")
      .text(data.analysis || "No analysis available", {
        align: "left",
        width: 500,
      });

    doc.moveDown();

    // Add drug recommendations if available
    if (data.drugInfo && data.drugInfo.drugs) {
      doc.fontSize(14).font("Helvetica-Bold").text("Recommended Treatments:");

      doc.moveDown(0.5);

      data.drugInfo.drugs.forEach((drug, index) => {
        doc
          .fontSize(12)
          .font("Helvetica-Bold")
          .text(`${index + 1}. ${drug.name}`);

        doc.fontSize(10).font("Helvetica").text(`   Dosage: ${drug.dosage}`);
        doc.text(`   Application: ${drug.application}`);
        doc.text(`   Safety: ${drug.safety}`);

        if (drug.nearbyShops && drug.nearbyShops.length > 0) {
          doc.text(`   Available at:`);
          drug.nearbyShops.forEach((shop) => {
            doc.text(
              `      • ${shop.name} (${shop.distance || "Unknown distance"})`
            );
          });
        }

        doc.moveDown();
      });
    }

    // Add footer
    const pageHeight = doc.page.height;
    const footerY = pageHeight - 50;

    doc
      .fontSize(8)
      .font("Helvetica-Oblique")
      .text("Generated by Agri AI Assistant", 50, footerY, {
        align: "center",
        width: 500,
      });

    doc.text(new Date().toLocaleString(), 50, footerY + 15, {
      align: "center",
      width: 500,
    });
  }

  // Generate filename based on type and data
  generateFilename(type, data) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    switch (type) {
      case "chat":
        return `chat-${data.id || "export"}-${timestamp}.txt`;
      case "analysis":
        return `analysis-${data.id || "export"}-${timestamp}.pdf`;
      case "history":
        return `history-export-${timestamp}.csv`;
      case "data":
        return `data-export-${timestamp}.json`;
      default:
        return `export-${timestamp}.txt`;
    }
  }

  // Get appropriate content type
  getContentType(format) {
    switch (format) {
      case "pdf":
        return "application/pdf";
      case "csv":
        return "text/csv";
      case "json":
        return "application/json";
      case "text":
      default:
        return "text/plain";
    }
  }
}

module.exports = new DownloadUtil();
