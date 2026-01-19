import { generateImage } from "../_core/imageGeneration.js";

/**
 * Generate a cover image for a novel using AI
 */
export async function generateNovelCover(params: {
  title: string;
  description?: string;
}): Promise<{ imageUrl: string }> {
  const { title, description } = params;

  // Construct prompt for Chinese ink painting style cover
  const prompt = buildCoverPrompt(title, description);

  // Generate image using built-in image generation service
  const result = await generateImage({
    prompt,
  });

  if (!result.url) {
    throw new Error("Failed to generate cover image");
  }

  return {
    imageUrl: result.url,
  };
}

/**
 * Build prompt for cover generation
 */
function buildCoverPrompt(title: string, description?: string): string {
  let prompt = `Create a Chinese ink painting (水墨画) style book cover for a novel titled "${title}".`;

  if (description) {
    prompt += ` The novel is about: ${description}.`;
  }

  prompt += `
  
Style requirements:
- Traditional Chinese ink wash painting aesthetic
- Elegant and minimalist composition
- Use black ink gradients and subtle color accents (light red/朱砂红)
- Incorporate classic Chinese elements (mountains, water, clouds, bamboo, plum blossoms)
- Leave white space for the title
- Vertical composition preferred
- Artistic and literary atmosphere
- Suitable for a novel cover

The image should evoke a sense of classical Chinese literature and poetry.`;

  return prompt;
}
