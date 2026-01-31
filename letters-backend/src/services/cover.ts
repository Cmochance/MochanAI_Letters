import {
  uploadFromUrl,
  generateFileKey,
  isStorageConfigured,
} from "./storage.js";

interface CoverOptions {
  title: string;
  description?: string;
  novelId?: number;
  userId?: number;
}

interface CoverResult {
  imageUrl: string;
  storageKey?: string;
}

/**
 * Generate novel cover using AI image generation
 * Optionally uploads to R2 storage for persistence
 */
export async function generateNovelCover(
  options: CoverOptions
): Promise<CoverResult> {
  const apiKey = process.env.BUILT_IN_FORGE_API_KEY;
  const baseUrl =
    process.env.BUILT_IN_FORGE_BASE_URL || "https://api.openai.com";

  if (!apiKey) {
    throw new Error("Image generation API key not configured");
  }

  // Build prompt for ink wash style cover
  const prompt = `Chinese ink wash painting style book cover for a novel titled "${options.title}". ${
    options.description || ""
  }. Traditional Chinese aesthetic, elegant, minimalist, black ink on rice paper texture, artistic calligraphy elements.`;

  try {
    const response = await fetch(`${baseUrl}/v1/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
      }),
    });

    if (!response.ok) {
      throw new Error(`Image generation failed: ${response.statusText}`);
    }

    const data = await response.json();
    const generatedUrl = data.data[0].url;

    // If R2 storage is configured, upload the image for persistence
    // DALL-E URLs expire after some time, so we need to store them
    if (isStorageConfigured()) {
      try {
        const filename = `cover-${options.novelId || "temp"}.png`;
        const key = generateFileKey("covers", filename, options.userId);
        const { url } = await uploadFromUrl(key, generatedUrl);
        return { imageUrl: url, storageKey: key };
      } catch (uploadError) {
        console.error("Failed to upload cover to R2:", uploadError);
        // Fall back to the generated URL
        return { imageUrl: generatedUrl };
      }
    }

    return { imageUrl: generatedUrl };
  } catch (error) {
    console.error("Cover generation error:", error);
    // Return placeholder image URL
    return {
      imageUrl: `https://placehold.co/600x800/F5F1E8/2C2C2C?text=${encodeURIComponent(
        options.title
      )}`,
    };
  }
}

/**
 * Upload a custom cover image to R2 storage
 */
export async function uploadCustomCover(
  data: Buffer | Uint8Array,
  contentType: string,
  novelId: number,
  userId: number
): Promise<CoverResult> {
  if (!isStorageConfigured()) {
    throw new Error("R2 storage is not configured");
  }

  const ext = contentType.split("/")[1] || "png";
  const filename = `cover-${novelId}.${ext}`;
  const key = generateFileKey("covers", filename, userId);

  const { uploadFile } = await import("./storage.js");
  const { url } = await uploadFile(key, data, contentType);

  return { imageUrl: url, storageKey: key };
}
