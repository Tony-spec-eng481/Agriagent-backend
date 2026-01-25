// Format chat response for display
function formatChatResponse(response) {
  if (!response) return "";

  // Convert markdown-like formatting to HTML
  let formatted = response
    // Headers
    .replace(/^###\s+(.+)$/gm, "<h3>$1</h3>")
    .replace(/^##\s+(.+)$/gm, "<h2>$1</h2>")
    .replace(/^#\s+(.+)$/gm, "<h1>$1</h1>")

    // Bold
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")

    // Italic
    .replace(/\*(.*?)\*/g, "<em>$1</em>")

    // Lists
    .replace(/^\s*[-*+]\s+(.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>")

    // Paragraphs
    .replace(/\n\n/g, "</p><p>")

    // Line breaks
    .replace(/\n/g, "<br>");

  // Wrap in paragraph if not already wrapped
  if (!formatted.startsWith("<")) {
    formatted = `<p>${formatted}</p>`;
  }

  return formatted;
}

// Format drug information
function formatDrugInfo(drug) {
  return {
    name: drug.name || "Unknown",
    brand: drug.brand || "",
    dosage: drug.dosage || "Consult manufacturer instructions",
    application: drug.application || "Follow label directions",
    safety: drug.safety || "Use appropriate protective equipment",
    image: drug.image || null,
    shops: drug.shops || [],
    category: drug.category || "general",
  };
}

// Format shop information
function formatShopInfo(shop) {
  return {
    id: shop.id || shop.place_id,
    name: shop.name || "Unknown Shop",
    address: shop.address || shop.vicinity || "",
    location: shop.location || shop.geometry?.location,
    rating: shop.rating || 0,
    totalRatings: shop.user_ratings_total || 0,
    openNow: shop.opening_hours?.open_now,
    phone: shop.phone || shop.formatted_phone_number,
    website: shop.website,
    photos: shop.photos || [],
    products: shop.products || [],
    categories: shop.categories || shop.types || [],
    distance: shop.distance ? `${(shop.distance / 1000).toFixed(1)} km` : null,
  };
}

// Format news article
function formatNewsArticle(article) {
  return {
    id: article.url?.hashCode() || Date.now().toString(),
    title: article.title || "No Title",
    description: article.description || "",
    content: article.content || "",
    url: article.url || "#",
    imageUrl: article.urlToImage || article.imageUrl,
    source: article.source?.name || article.source || "Unknown",
    author: article.author || "",
    publishedAt: article.publishedAt || new Date().toISOString(),
    category: article.category || "general",
    readTime: calculateReadTime(article.content || article.description),
  };
}

// Calculate read time in minutes
function calculateReadTime(text) {
  if (!text) return 2;

  const words = text.split(/\s+/).length;
  const minutes = Math.ceil(words / 200); // 200 words per minute

  return Math.max(1, Math.min(minutes, 10)); // Between 1-10 minutes
}

// Format location for display
function formatLocation(location) {
  if (!location) return "Unknown location";

  if (typeof location === "string") {
    return location;
  }

  if (location.lat && location.lng) {
    return `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`;
  }

  if (location.address) {
    return location.address;
  }

  return "Unknown location";
}

// Format date range
function formatDateRange(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isSameDay(start, end)) {
    return `${formatDate(start, "medium")}`;
  }

  return `${formatDate(start, "short")} - ${formatDate(end, "short")}`;
}

function isSameDay(date1, date2) {
  return (
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  );
}

function formatDate(date, format = "short") {
  const d = new Date(date);

  const formats = {
    short: d.toLocaleDateString(),
    medium: d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    long: d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    time: d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    datetime: d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };

  return formats[format] || d.toLocaleDateString();
}

// Format file size
function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Format rating with stars
function formatRating(rating, maxStars = 5) {
  const fullStars = Math.floor(rating);
  const halfStar = rating % 1 >= 0.5;
  const emptyStars = maxStars - fullStars - (halfStar ? 1 : 0);

  return {
    fullStars,
    halfStar,
    emptyStars,
    numeric: rating.toFixed(1),
  };
}

// Format price range
function formatPriceRange(minPrice, maxPrice, currency = "USD") {
  if (!minPrice && !maxPrice) return "Price not available";

  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  });

  if (minPrice === maxPrice) {
    return formatter.format(minPrice);
  }

  if (!maxPrice) {
    return `From ${formatter.format(minPrice)}`;
  }

  if (!minPrice) {
    return `Up to ${formatter.format(maxPrice)}`;
  }

  return `${formatter.format(minPrice)} - ${formatter.format(maxPrice)}`;
}

// Format phone number
function formatPhoneNumber(phone) {
  if (!phone) return "";

  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, "");

  // Format based on length
  if (cleaned.length === 10) {
    return `(${cleaned.substring(0, 3)}) ${cleaned.substring(
      3,
      6
    )}-${cleaned.substring(6)}`;
  }

  if (cleaned.length === 11) {
    return `+${cleaned.charAt(0)} (${cleaned.substring(
      1,
      4
    )}) ${cleaned.substring(4, 7)}-${cleaned.substring(7)}`;
  }

  // Return original if can't format
  return phone;
}

// Generate excerpt from text
function generateExcerpt(text, maxLength = 150) {
  if (!text) return "";

  if (text.length <= maxLength) return text;

  // Try to break at sentence end
  const shortened = text.substring(0, maxLength);
  const lastPeriod = shortened.lastIndexOf(". ");
  const lastQuestion = shortened.lastIndexOf("? ");
  const lastExclamation = shortened.lastIndexOf("! ");

  const breakPoint = Math.max(lastPeriod, lastQuestion, lastExclamation);

  if (breakPoint > maxLength * 0.5) {
    return text.substring(0, breakPoint + 1) + "..";
  }

  return text.substring(0, maxLength).trim() + "...";
}

// Format agricultural measurement
function formatMeasurement(value, unit) {
  const units = {
    hectare: "ha",
    acre: "ac",
    kilogram: "kg",
    pound: "lb",
    liter: "L",
    gallon: "gal",
    ton: "ton",
    meter: "m",
    foot: "ft",
  };

  const shortUnit = units[unit] || unit;

  if (value === undefined || value === null) {
    return `Unknown ${shortUnit}`;
  }

  return `${value} ${shortUnit}`;
}

// Add hashCode method to String prototype
String.prototype.hashCode = function () {
  let hash = 0;
  for (let i = 0; i < this.length; i++) {
    const char = this.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString();
};

module.exports = {
  formatChatResponse,
  formatDrugInfo,
  formatShopInfo,
  formatNewsArticle,
  formatLocation,
  formatDateRange,
  formatDate,
  formatFileSize,
  formatRating,
  formatPriceRange,
  formatPhoneNumber,
  generateExcerpt,
  formatMeasurement,
  calculateReadTime,
};
