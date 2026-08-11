/**
 * AI-backed content generator (Claude).
 *
 * Implements the same IContentGenerator interface as the template generator, so
 * it is a drop-in replacement. It composes the prompt via the prompt layer,
 * asks the provider for schema-constrained JSON, and maps the result onto the
 * calendar slots. Infographic prompts are rendered locally from the returned
 * brief so branding stays consistent regardless of the model.
 */

import {
  ContentSlot,
  GeneratedPost,
  GeneratedSeries,
  InfographicBrief,
  PostType,
  Topic,
} from '../types';
import { IContentGenerator } from './content-generator.interface';
import { IAIProvider } from './ai-provider.interface';
import { DefaultInfographicPromptBuilder } from '../infographic/prompt.builder';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { buildSeriesPrompt } from '../prompts/linkedin.prompt';
import { logger } from '../logging/logger';

interface AiPost {
  type: PostType;
  title: string;
  body: string;
  hashtags: string[];
  infographic: InfographicBrief;
}

const promptBuilder = new DefaultInfographicPromptBuilder();
const knowledge = new KnowledgeService();

export class AIContentGenerator implements IContentGenerator {
  readonly name = 'ai';

  constructor(private readonly provider: IAIProvider) {}

  async generateSeries(
    topic: Topic,
    slots: ContentSlot[],
  ): Promise<GeneratedSeries> {
    const ctx = knowledge.forTopic(topic.slug || topic.title);
    const { system, user, schema } = buildSeriesPrompt(topic, slots, ctx);

    logger.info('generated', `Requesting AI series for "${topic.title}"`, {
      provider: this.provider.name,
    });

    const raw = await this.provider.complete({ system, user, jsonSchema: schema });

    let parsed: { posts: AiPost[] };
    try {
      parsed = JSON.parse(raw) as { posts: AiPost[] };
    } catch (err) {
      throw new Error(
        `Could not parse AI response as JSON: ${(err as Error).message}`,
      );
    }
    if (!parsed.posts || !Array.isArray(parsed.posts)) {
      throw new Error('AI response did not contain a "posts" array.');
    }

    const posts: GeneratedPost[] = slots.map((slot, i) => {
      const match =
        parsed.posts.find((p) => p.type === slot.type) ?? parsed.posts[i];
      if (!match) {
        throw new Error(`AI response missing a post for slot "${slot.type}".`);
      }
      return this.toGeneratedPost(topic.title, slot, match);
    });

    return { topicId: topic.id, topic: topic.title, posts };
  }

  private toGeneratedPost(
    topic: string,
    slot: ContentSlot,
    ai: AiPost,
  ): GeneratedPost {
    const brief: InfographicBrief = {
      title: ai.infographic?.title ?? topic,
      keyPoints: ai.infographic?.keyPoints ?? [],
      takeaway: ai.infographic?.takeaway ?? '',
    };
    return {
      type: slot.type,
      day: slot.day,
      title: ai.title?.trim() || `${topic} — ${slot.type} (${slot.day})`,
      body: ai.body.trim(),
      hashtags: Array.isArray(ai.hashtags) ? ai.hashtags : [],
      infographicPrompt: promptBuilder.build(topic, brief),
    };
  }
}
