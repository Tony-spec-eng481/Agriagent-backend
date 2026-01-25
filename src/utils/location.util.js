const axios = require("axios");

class LocationUtil {
  // Reverse geocode coordinates to address
  async reverseGeocode(lat, lng) {
    try {
      const response = await axios.get(
        "https://nominatim.openstreetmap.org/reverse",
        {
          params: {
            lat,
            lon: lng,
            format: "json",
            addressdetails: 1,
            "accept-language": "en",
          },
          headers: {
            "User-Agent": "AgriAI-Assistant/1.0",
          },
        }
      );

      if (response.data && response.data.address) {
        return this.formatAddress(response.data);
      }

      return null;
    } catch (error) {
      console.error("Reverse geocode error:", error);
      return null;
    }
  }

  // Format address from Nominatim response
  formatAddress(data) {
    const address = data.address;
    const components = [];

    if (address.road) components.push(address.road);
    if (address.village) components.push(address.village);
    if (address.town) components.push(address.town);
    if (address.city) components.push(address.city);
    if (address.county) components.push(address.county);
    if (address.state) components.push(address.state);
    if (address.country) components.push(address.country);

    return {
      formatted: components.join(", "),
      components: address,
      displayName: data.display_name,
      lat: parseFloat(data.lat),
      lng: parseFloat(data.lon),
    };
  }

  // Geocode address to coordinates
  async geocodeAddress(address) {
    try {
      const response = await axios.get(
        "https://nominatim.openstreetmap.org/search",
        {
          params: {
            q: address,
            format: "json",
            addressdetails: 1,
            limit: 1,
            "accept-language": "en",
          },
          headers: {
            "User-Agent": "AgriAI-Assistant/1.0",
          },
        }
      );

      if (response.data && response.data.length > 0) {
        const result = response.data[0];
        return {
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
          address: result.display_name,
          components: result.address,
        };
      }

      return null;
    } catch (error) {
      console.error("Geocode error:", error);
      return null;
    }
  }

  // Get timezone for coordinates
  async getTimezone(lat, lng) {
    try {
      const response = await axios.get(
        "http://api.timezonedb.com/v2.1/get-time-zone",
        {
          params: {
            key: process.env.TIMEZONE_API_KEY,
            format: "json",
            by: "position",
            lat,
            lng,
          },
        }
      );

      if (response.data.status === "OK") {
        return {
          zoneName: response.data.zoneName,
          abbreviation: response.data.abbreviation,
          gmtOffset: response.data.gmtOffset,
          timestamp: response.data.timestamp,
        };
      }

      return null;
    } catch (error) {
      console.error("Timezone error:", error);
      return null;
    }
  }

  // Get weather for coordinates
  async getWeather(lat, lng) {
    try {
      const apiKey = process.env.WEATHER_API_KEY;
      if (!apiKey) {
        return this.getMockWeather();
      }

      const response = await axios.get(
        "https://api.openweathermap.org/data/2.5/weather",
        {
          params: {
            lat,
            lon: lng,
            appid: apiKey,
            units: "metric",
          },
        }
      );

      return {
        temperature: response.data.main.temp,
        feelsLike: response.data.main.feels_like,
        humidity: response.data.main.humidity,
        pressure: response.data.main.pressure,
        description: response.data.weather[0].description,
        icon: `https://openweathermap.org/img/wn/${response.data.weather[0].icon}@2x.png`,
        windSpeed: response.data.wind.speed,
        windDirection: response.data.wind.deg,
        clouds: response.data.clouds.all,
        sunrise: new Date(response.data.sys.sunrise * 1000),
        sunset: new Date(response.data.sys.sunset * 1000),
      };
    } catch (error) {
      console.error("Weather error:", error);
      return this.getMockWeather();
    }
  }

  // Get agricultural zones
  getAgriculturalZone(lat, lng) {
    // This is a simplified version. In production, use actual agricultural zone data.
    if (lat > 60) return "Subarctic";
    if (lat > 50) return "Cool Temperate";
    if (lat > 40) return "Warm Temperate";
    if (lat > 23.5) return "Subtropical";
    if (lat > -23.5) return "Tropical";
    if (lat > -40) return "Subtropical (Southern)";
    if (lat > -50) return "Warm Temperate (Southern)";
    return "Subarctic (Southern)";
  }

  // Calculate growing season
  getGrowingSeason(lat, lng) {
    const month = new Date().getMonth() + 1;
    const hemisphere = lat >= 0 ? "northern" : "southern";

    if (hemisphere === "northern") {
      if (month >= 3 && month <= 5) return "Spring planting";
      if (month >= 6 && month <= 8) return "Summer growing";
      if (month >= 9 && month <= 11) return "Autumn harvest";
      return "Winter dormancy";
    } else {
      if (month >= 9 && month <= 11) return "Spring planting";
      if (month >= 12 || month <= 2) return "Summer growing";
      if (month >= 3 && month <= 5) return "Autumn harvest";
      return "Winter dormancy";
    }
  }

  // Get soil type (mock - in production use soil databases)
  getSoilType(lat, lng) {
    // Simple mock based on latitude
    if (lat > 50) return "Podzolic soils";
    if (lat > 40) return "Brown earth soils";
    if (lat > 30) return "Mediterranean soils";
    if (lat > 20) return "Tropical red soils";
    if (lat > 10) return "Lateritic soils";
    return "Alluvial soils";
  }

  // Get distance between two points in km
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  deg2rad(deg) {
    return deg * (Math.PI / 180);
  }

  // Find nearest shops from a list
  findNearestShops(userLat, userLng, shops, maxDistance = 50) {
    return shops
      .map((shop) => {
        if (!shop.location) return null;

        const distance = this.calculateDistance(
          userLat,
          userLng,
          shop.location.lat,
          shop.location.lng
        );

        return {
          ...shop,
          distance: parseFloat(distance.toFixed(2)),
          distanceFormatted:
            distance < 1
              ? `${(distance * 1000).toFixed(0)}m`
              : `${distance.toFixed(1)}km`,
        };
      })
      .filter((shop) => shop && shop.distance <= maxDistance)
      .sort((a, b) => a.distance - b.distance);
  }

  // Get location-based agricultural advice
  getLocationAdvice(lat, lng) {
    const zone = this.getAgriculturalZone(lat, lng);
    const season = this.getGrowingSeason(lat, lng);
    const soil = this.getSoilType(lat, lng);

    const advice = {
      zone,
      season,
      soil,
      recommendations: [],
    };

    // Add zone-specific recommendations
    if (zone.includes("Tropical")) {
      advice.recommendations.push(
        "Suitable for rice, sugarcane, bananas, and tropical fruits",
        "Consider irrigation during dry seasons",
        "Watch for tropical pests and diseases"
      );
    } else if (zone.includes("Temperate")) {
      advice.recommendations.push(
        "Good for wheat, maize, soybeans, and temperate fruits",
        "Consider crop rotation to maintain soil health",
        "Plan for seasonal weather changes"
      );
    } else if (zone.includes("Subtropical")) {
      advice.recommendations.push(
        "Ideal for citrus, avocados, and some grains",
        "Manage water resources carefully",
        "Protect from occasional frosts"
      );
    }

    // Add season-specific recommendations
    if (season.includes("planting")) {
      advice.recommendations.push(
        "Prepare soil with organic matter",
        "Test soil pH and nutrients",
        "Plan crop rotation schedule"
      );
    } else if (season.includes("growing")) {
      advice.recommendations.push(
        "Monitor for pests and diseases",
        "Ensure adequate irrigation",
        "Apply fertilizers as needed"
      );
    } else if (season.includes("harvest")) {
      advice.recommendations.push(
        "Harvest at optimal maturity",
        "Prepare storage facilities",
        "Clean and maintain equipment"
      );
    } else {
      advice.recommendations.push(
        "Maintain farm infrastructure",
        "Plan for next season",
        "Attend agricultural workshops"
      );
    }

    // Add soil-specific recommendations
    if (soil.includes("clay")) {
      advice.recommendations.push(
        "Improve drainage with organic matter",
        "Consider raised beds for better root growth"
      );
    } else if (soil.includes("sandy")) {
      advice.recommendations.push(
        "Add organic matter to improve water retention",
        "Use mulch to reduce evaporation"
      );
    }

    return advice;
  }

  // Mock weather data
  getMockWeather() {
    return {
      temperature: 25,
      feelsLike: 26,
      humidity: 65,
      pressure: 1013,
      description: "Partly cloudy",
      icon: "https://example.com/icon.png",
      windSpeed: 12,
      windDirection: 180,
      clouds: 40,
      sunrise: new Date(),
      sunset: new Date(Date.now() + 43200000),
    };
  }

  // Validate coordinates
  isValidCoordinates(lat, lng) {
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }

  // Parse coordinate string
  parseCoordinateString(str) {
    if (!str) return null;

    try {
      // Try JSON
      if (str.startsWith("{")) {
        const parsed = JSON.parse(str);
        if (parsed.lat && parsed.lng) {
          return {
            lat: parseFloat(parsed.lat),
            lng: parseFloat(parsed.lng),
          };
        }
      }

      // Try "lat,lng" format
      const parts = str.split(",");
      if (parts.length === 2) {
        const lat = parseFloat(parts[0].trim());
        const lng = parseFloat(parts[1].trim());

        if (!isNaN(lat) && !isNaN(lng)) {
          return { lat, lng };
        }
      }

      return null;
    } catch (error) {
      console.error("Parse coordinate error:", error);
      return null;
    }
  }

  // Format coordinates for display
  formatCoordinates(lat, lng, format = "decimal") {
    if (format === "dms") {
      return `${this.toDMS(lat, true)} ${this.toDMS(lng, false)}`;
    }

    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }

  // Convert decimal to DMS
  toDMS(decimal, isLat) {
    const direction = isLat
      ? decimal >= 0
        ? "N"
        : "S"
      : decimal >= 0
      ? "E"
      : "W";

    const absDecimal = Math.abs(decimal);
    const degrees = Math.floor(absDecimal);
    const minutes = Math.floor((absDecimal - degrees) * 60);
    const seconds = ((absDecimal - degrees - minutes / 60) * 3600).toFixed(1);

    return `${degrees}°${minutes}'${seconds}"${direction}`;
  }
}

module.exports = new LocationUtil();
