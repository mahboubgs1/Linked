/**
 * LinkedIn provider abstraction.
 *
 * Kept modular so a real OAuth-backed implementation can be added or swapped
 * later without changing the publish command. Credentials are supplied via env,
 * never hardcoded.
 */

export interface LinkedInPostContent {
  /** The post text/commentary. */
  text: string;
  /** Author URN the post is published as (person or organization). */
  authorUrn: string;
}

export interface LinkedInPublishResult {
  /** Provider-assigned post id (URN or synthetic id in dry-run). */
  id: string;
  /** Whether this was a real API call or a simulated one. */
  dryRun: boolean;
  /** Raw provider response payload (for logging/inspection). */
  raw?: unknown;
}

export interface ILinkedInProvider {
  readonly name: string;
  publish(content: LinkedInPostContent): Promise<LinkedInPublishResult>;
}
