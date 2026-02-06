import {
  uploadFromUrl,
  uploadFile,
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

const DEFAULT_IMAGE_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_IMAGE_MODEL = "dall-e-3";

function normalizeOpenAICompatibleBaseUrl(baseUrl: string): string {
  const trimmedBaseUrl = baseUrl.replace(/\/+$/, "");
  return trimmedBaseUrl.endsWith("/v1")
    ? trimmedBaseUrl
    : `${trimmedBaseUrl}/v1`;
}

function getImageGenerationConfig() {
  const apiKey =
    process.env.IMAGE_GEN_API_KEY || process.env.BUILT_IN_FORGE_API_KEY;
  const rawBaseUrl =
    process.env.IMAGE_GEN_BASE_URL ||
    process.env.BUILT_IN_FORGE_BASE_URL ||
    DEFAULT_IMAGE_BASE_URL;
  const model = process.env.IMAGE_GEN_MODEL || DEFAULT_IMAGE_MODEL;
  const baseUrl = normalizeOpenAICompatibleBaseUrl(rawBaseUrl);

  return {
    apiKey,
    baseUrl,
    model,
  };
}

/**
 * Generate novel cover using AI image generation
 * Optionally uploads to R2 storage for persistence
 */
export async function generateNovelCover(
  options: CoverOptions
): Promise<CoverResult> {
  const { apiKey, baseUrl, model } = getImageGenerationConfig();

  if (!apiKey) {
    throw new Error(
      "Image generation API key not configured. Set IMAGE_GEN_API_KEY (or BUILT_IN_FORGE_API_KEY as fallback)."
    );
  }

  // Build prompt for ink wash style cover
  const prompt = `Chinese ink wash painting style book cover for a novel titled "${options.title}". ${
    options.description || ""
  }. Traditional Chinese aesthetic, elegant, minimalist, black ink on rice paper texture, artistic calligraphy elements.`;

  try {
    const response = await fetch(`${baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        response_format: "url",
      }),
    });

    if (!response.ok) {
      throw new Error(`Image generation failed: ${response.statusText}`);
    }

    const data = await response.json();
    const generatedUrl = data?.data?.[0]?.url as string | undefined;
    const generatedB64 = data?.data?.[0]?.b64_json as string | undefined;

    if (!generatedUrl && !generatedB64) {
      throw new Error("Image generation API returned no image payload");
    }

    if (generatedUrl && isStorageConfigured()) {
      // If R2 storage is configured, upload the image for persistence.
      // Signed URLs from image providers can expire quickly.
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

    if (generatedUrl) {
      return { imageUrl: generatedUrl };
    }

    // Some OpenAI-compatible providers return only base64 image data.
    if (!generatedB64) {
      throw new Error("Image generation API returned an empty base64 image");
    }

    if (!isStorageConfigured()) {
      throw new Error(
        "Image provider returned base64 image data, but R2 storage is not configured for persistence"
      );
    }

    const filename = `cover-${options.novelId || "temp"}.png`;
    const key = generateFileKey("covers", filename, options.userId);
    const buffer = Buffer.from(generatedB64, "base64");
    const { url } = await uploadFile(key, buffer, "image/png");
    return { imageUrl: url, storageKey: key };
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

  const { url } = await uploadFile(key, data, contentType);

  return { imageUrl: url, storageKey: key };
}
