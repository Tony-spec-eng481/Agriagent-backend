const sharp = require("sharp");
const axios = require("axios");

class ImageService {
  // Process and optimize image
  async processImage(imageBuffer, options = {}) {
    const {
      maxWidth = 1024,
      maxHeight = 1024,
      quality = 80,
      format = "jpeg",
    } = options;

    try {
      let processedImage = sharp(imageBuffer);

      // Get image metadata
      const metadata = await processedImage.metadata();

      // Resize if needed
      if (metadata.width > maxWidth || metadata.height > maxHeight) {
        processedImage = processedImage.resize(maxWidth, maxHeight, {
          fit: "inside",
          withoutEnlargement: true,
        });
      }

      // Convert to specified format and compress
      switch (format.toLowerCase()) {
        case "jpeg":
        case "jpg":
          processedImage = processedImage.jpeg({ quality });
          break;
        case "png":
          processedImage = processedImage.png({ compressionLevel: 9 });
          break;
        case "webp":
          processedImage = processedImage.webp({ quality });
          break;
        default:
          processedImage = processedImage.jpeg({ quality });
      }

      // Apply additional optimizations
      processedImage = processedImage
        .normalize() // Normalize brightness and contrast
        .sharpen() // Sharpen slightly for better analysis
        .withMetadata(); // Keep metadata

      return await processedImage.toBuffer();
    } catch (error) {
      console.error("Image processing error:", error);
      throw new Error("Failed to process image");
    }
  }

  // Extract image features (for potential ML analysis)
  async extractFeatures(imageBuffer) {
    try {
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();

      return {
        dimensions: {
          width: metadata.width,
          height: metadata.height,
        },
        format: metadata.format,
        size: imageBuffer.length,
        hasAlpha: metadata.hasAlpha,
        channels: metadata.channels,
        isProgressive: metadata.isProgressive,
      };
    } catch (error) {
      console.error("Feature extraction error:", error);
      return null;
    }
  }

  // Generate thumbnail
  async generateThumbnail(imageBuffer, size = 200) {
    try {
      return await sharp(imageBuffer)
        .resize(size, size, {
          fit: "cover",
          position: "center",
        })
        .jpeg({ quality: 70 })
        .toBuffer();
    } catch (error) {
      console.error("Thumbnail generation error:", error);
      return null;
    }
  }

  // Validate image
  async validateImage(imageBuffer) {
    try {
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();

      // Check minimum dimensions
      if (metadata.width < 100 || metadata.height < 100) {
        return {
          valid: false,
          error: "Image too small (minimum 100x100 pixels)",
        };
      }

      // Check file size (already checked by multer, but double-check)
      if (imageBuffer.length > 10 * 1024 * 1024) {
        return {
          valid: false,
          error: "Image too large (maximum 10MB)",
        };
      }

      // Check format
      const allowedFormats = ["jpeg", "jpg", "png", "gif", "webp"];
      if (!allowedFormats.includes(metadata.format)) {
        return {
          valid: false,
          error: `Unsupported image format: ${metadata.format}`,
        };
      }

      return {
        valid: true,
        metadata,
      };
    } catch (error) {
      return {
        valid: false,
        error: "Invalid image file",
      };
    }
  }

  // Download image from URL (for drug images, etc.)
  async downloadImage(url, options = {}) {
    try {
      const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 10000,
        ...options,
      });

      if (response.status !== 200) {
        throw new Error(`Failed to download image: ${response.status}`);
      }

      const imageBuffer = Buffer.from(response.data, "binary");

      // Process downloaded image
      return await this.processImage(imageBuffer, options);
    } catch (error) {
      console.error("Image download error:", error);
      throw new Error("Failed to download image");
    }
  }

  // Create image collage (for multiple images)
  async createCollage(images, options = {}) {
    try {
      const {
        width = 800,
        height = 600,
        backgroundColor = { r: 255, g: 255, b: 255 },
      } = options;

      // Process each image
      const processedImages = await Promise.all(
        images.map(async (imgBuffer, index) => {
          const resized = await sharp(imgBuffer)
            .resize(Math.floor(width / 2) - 20, Math.floor(height / 2) - 20, {
              fit: "cover",
            })
            .toBuffer();

          return {
            input: resized,
            top: index < 2 ? 10 : Math.floor(height / 2) + 10,
            left: index % 2 === 0 ? 10 : Math.floor(width / 2) + 10,
          };
        })
      );

      // Create collage
      const collage = await sharp({
        create: {
          width,
          height,
          channels: 3,
          background: backgroundColor,
        },
      })
        .composite(processedImages)
        .jpeg({ quality: 90 })
        .toBuffer();

      return collage;
    } catch (error) {
      console.error("Collage creation error:", error);
      throw new Error("Failed to create collage");
    }
  }

  // Extract dominant colors
  async extractColors(imageBuffer, maxColors = 5) {
    try {
      const image = sharp(imageBuffer);

      // Resize for faster processing
      const resized = await image
        .resize(100, 100, { fit: "inside" })
        .raw()
        .toBuffer({ resolveWithObject: true });

      const pixels = resized.data;
      const width = resized.info.width;
      const height = resized.info.height;

      // Simple color extraction (for production, use more sophisticated algorithm)
      const colors = new Map();

      for (let i = 0; i < pixels.length; i += 3) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];

        // Round colors to reduce variations
        const roundedR = Math.round(r / 32) * 32;
        const roundedG = Math.round(g / 32) * 32;
        const roundedB = Math.round(b / 32) * 32;

        const colorKey = `${roundedR},${roundedG},${roundedB}`;
        colors.set(colorKey, (colors.get(colorKey) || 0) + 1);
      }

      // Sort by frequency and get top colors
      const sortedColors = Array.from(colors.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxColors)
        .map(([colorKey]) => {
          const [r, g, b] = colorKey.split(",").map(Number);
          return { r, g, b };
        });

      return sortedColors;
    } catch (error) {
      console.error("Color extraction error:", error);
      return [];
    }
  }
}

module.exports = new ImageService();
