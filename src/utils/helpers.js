const crypto = require("crypto");

// Calculate distance between two coordinates in meters (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Format distance for display
function formatDistance(meters) {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

// Generate unique ID
function generateId(prefix = "") {
  return `${prefix}${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
}

// Hash string (for cache keys, etc.)
function hashString(str) {
  return crypto.createHash("md5").update(str).digest("hex");
}

// Parse location string to coordinates
function parseLocation(locationString) {
  if (!locationString) return null;

  try {
    // Try parsing as JSON
    if (locationString.startsWith("{")) {
      return JSON.parse(locationString);
    }

    // Try parsing as "lat,lng"
    const parts = locationString.split(",");
    if (parts.length === 2) {
      const lat = parseFloat(parts[0].trim());
      const lng = parseFloat(parts[1].trim());

      if (!isNaN(lat) && !isNaN(lng)) {
        return { lat, lng };
      }
    }
  } catch (error) {
    console.error("Error parsing location:", error);
  }

  return null;
}

// Format date for display
function formatDate(date, format = "relative") {
  if (!date) return "Unknown";

  const d = new Date(date);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (format === "relative") {
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  }

  return d.toLocaleString();
}

// Truncate text with ellipsis
function truncateText(text, maxLength = 100) {
  if (!text || text.length <= maxLength) return text;

  return text.substring(0, maxLength).trim() + "...";
}

// Extract keywords from text
function extractKeywords(text, maxKeywords = 5) {
  if (!text) return [];

  // Common stop words to exclude
  const stopWords = new Set([
    "a",
    "an",
    "the",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "by",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "should",
    "could",
    "can",
    "may",
    "might",
    "must",
    "shall",
    "about",
    "above",
    "after",
    "before",
    "between",
    "from",
    "into",
    "through",
    "under",
    "upon",
    "within",
    "without",
  ]);

  // Extract words and count frequencies
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));

  const frequency = {};
  words.forEach((word) => {
    frequency[word] = (frequency[word] || 0) + 1;
  });

  // Sort by frequency and get top keywords
  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word);
}

// Generate download content for analysis
function generateDownloadContent(analysis, format = "text") {
  if (format === "json") {
    return JSON.stringify(analysis, null, 2);
  }

  // Default text format
  let content = "AGRICULTURAL ANALYSIS REPORT\n";
  content += "=".repeat(40) + "\n\n";

  content += `Report ID: ${analysis.id || "N/A"}\n`;
  content += `Date: ${formatDate(analysis.timestamp, "full")}\n`;
  content += `Location: ${analysis.location || "Not specified"}\n\n`;

  if (analysis.imageUrl) {
    content += `Image: ${analysis.imageUrl}\n\n`;
  }

  content += "ANALYSIS:\n";
  content += "-".repeat(40) + "\n";
  content += analysis.analysis + "\n\n";

  if (analysis.drugInfo && analysis.drugInfo.drugs) {
    content += "RECOMMENDED TREATMENTS:\n";
    content += "-".repeat(40) + "\n";

    analysis.drugInfo.drugs.forEach((drug, index) => {
      content += `\n${index + 1}. ${drug.name}\n`;
      content += `   Dosage: ${drug.dosage}\n`;
      content += `   Application: ${drug.application}\n`;
      content += `   Safety: ${drug.safety}\n`;

      if (drug.nearbyShops && drug.nearbyShops.length > 0) {
        content += `   Available at: ${drug.nearbyShops
          .map((s) => s.name)
          .join(", ")}\n`;
      }
    });

    content += "\n";
  }

  content += "GENERAL ADVICE:\n";
  content += "-".repeat(40) + "\n";
  content += "• Monitor affected area regularly\n";
  content += "• Follow recommended safety precautions\n";
  content += "• Consult local agricultural extension if symptoms persist\n";
  content += "• Keep records of treatments applied\n\n";

  content += "=".repeat(40) + "\n";
  content += "Generated by Agri AI Assistant\n";
  content += new Date().toLocaleString();

  return content;
}

// Validate email
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate phone number (simple check)
function isValidPhone(phone) {
  const phoneRegex = /^[\d\s\-\+\(\)]{10,}$/;
  return phoneRegex.test(phone);
}

// Debounce function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Throttle function
function throttle(func, limit) {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Deep clone object
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// Merge objects deeply
function deepMerge(target, source) {
  const output = Object.assign({}, target);

  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }

  return output;
}

function isObject(item) {
  return item && typeof item === "object" && !Array.isArray(item);
}

// Generate pagination metadata
function generatePagination(total, page, limit) {
  const totalPages = Math.ceil(total / limit);

  return {
    page: parseInt(page),
    limit: parseInt(limit),
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
    nextPage: page < totalPages ? page + 1 : null,
    prevPage: page > 1 ? page - 1 : null,
  };
}

// Format currency
function formatCurrency(amount, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

// Get file extension from filename
function getFileExtension(filename) {
  return filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2);
}

// Check if file is an image
function isImageFile(filename) {
  const imageExtensions = ["jpg", "jpeg", "png", "gif", "webp", "bmp"];
  const ext = getFileExtension(filename).toLowerCase();
  return imageExtensions.includes(ext);
}

// Generate random color
function getRandomColor() {
  const colors = [
    "#4CAF50",
    "#2196F3",
    "#FF9800",
    "#F44336",
    "#9C27B0",
    "#3F51B5",
    "#009688",
    "#FF5722",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

module.exports = {
  calculateDistance,
  formatDistance,
  generateId,
  hashString,
  parseLocation,
  formatDate,
  truncateText,
  extractKeywords,
  generateDownloadContent,
  isValidEmail,
  isValidPhone,
  debounce,
  throttle,
  deepClone,
  deepMerge,
  generatePagination,
  formatCurrency,
  getFileExtension,
  isImageFile,
  getRandomColor,
};
