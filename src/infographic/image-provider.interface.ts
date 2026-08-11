/**
 * Image provider abstraction.
 *
 * V1 does NOT generate images. This interface exists so an image backend
 * (OpenAI Images, Stability, a Canva export pipeline, etc.) can be plugged in
 * later without touching the rest of the system. The infographic module's job in
 * V1 is only to produce a high-quality *prompt*.
 */

export interface ImageGenerationRequest {
  prompt: string;
  /** Aspect ratio, e.g. "4:5" for LinkedIn portrait. */
  aspectRatio?: string;
  /** Optional negative prompt. */
  negativePrompt?: string;
}

export interface ImageGenerationResult {
  /** Local path or remote URL of the produced image. */
  imageRef: string;
  provider: string;
}

export interface IImageProvider {
  readonly name: string;
  generate(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
}
