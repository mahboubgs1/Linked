/**
 * LinkedIn series prompt composer.
 *
 * Assembles the full system + user prompt (and the JSON output schema) for
 * generating one connected weekly series, pulling from the prompt layer, brand
 * engine, knowledge base, and strategy engine. This is the single place the AI
 * generator's instructions live — the generator itself stays logic-only.
 */

import { ContentSlot, Topic } from '../types';
import { BRAND_PROFILE } from '../brand/brand-profile';
import { FORBIDDEN_PATTERNS } from '../brand/forbidden-patterns';
import { VOICE_RULES } from '../brand/voice-rules';
import { KnowledgeContext } from '../knowledge/knowledge.service';
import { audienceFor } from '../strategy/audience-mapper';
import { pillarForTopic } from '../strategy/content-pillar';
import { executivePersona } from './executive.prompt';
import { ARABIC_VOICE_RULES } from './arabic.prompt';
import { POST_TYPE_GUIDES } from './case-study.prompt';

export interface SeriesPrompt {
  system: string;
  user: string;
  schema: Record<string, unknown>;
}

/** JSON Schema the model must satisfy (structured outputs — no length/format constraints). */
export const SERIES_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    posts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          type: { type: 'string', enum: ['teaser', 'training', 'case_study'] },
          title: { type: 'string' },
          body: { type: 'string' },
          hashtags: { type: 'array', items: { type: 'string' } },
          infographic: {
            type: 'object',
            additionalProperties: false,
            properties: {
              title: { type: 'string' },
              keyPoints: { type: 'array', items: { type: 'string' } },
              takeaway: { type: 'string' },
            },
            required: ['title', 'keyPoints', 'takeaway'],
          },
        },
        required: ['type', 'title', 'body', 'hashtags', 'infographic'],
      },
    },
  },
  required: ['posts'],
};

function knowledgeBlock(ctx: KnowledgeContext): string {
  const lines: string[] = [];
  if (ctx.experience) lines.push(`- Experience: ${ctx.experience.summary}`);
  if (ctx.project) lines.push(`- Project: ${ctx.project.name} — ${ctx.project.summary}`);
  if (ctx.achievement) lines.push(`- Achievement: ${ctx.achievement.statement}`);
  if (ctx.lesson) lines.push(`- Lesson: ${ctx.lesson.lesson}`);
  if (lines.length === 0) return 'No specific prior experience matched; write from general IT application management practice.';
  return lines.join('\n');
}

export function buildSeriesPrompt(
  topic: Topic,
  slots: ContentSlot[],
  knowledge: KnowledgeContext,
): SeriesPrompt {
  const pillar = pillarForTopic(topic.title);

  const system = [
    executivePersona(BRAND_PROFILE),
    '',
    'LANGUAGE:',
    ARABIC_VOICE_RULES,
    '',
    'GROUNDING — weave this real experience in naturally (do not fabricate specifics beyond it):',
    knowledgeBlock(knowledge),
    '',
    'AVOID these generic / hype phrasings entirely:',
    FORBIDDEN_PATTERNS.map((p) => `- "${p.phrase}"`).join('\n'),
    '',
    `CONSTRAINTS: each post body between ${VOICE_RULES.minLength} and ${VOICE_RULES.maxLength} characters, ` +
      `with ${VOICE_RULES.minHashtags}-${VOICE_RULES.maxHashtags} relevant hashtags (Arabic and/or English), ` +
      'and each post must end with a question or a clear call-to-action.',
    '',
    'Return ONLY the JSON described by the schema. Do not add commentary.',
  ].join('\n');

  const postSpecs = slots
    .map((slot) => {
      const aud = audienceFor(slot.type);
      return [
        `• ${slot.type.toUpperCase()} (${slot.day}) — target audience: ${aud.label}`,
        POST_TYPE_GUIDES[slot.type],
      ].join('\n');
    })
    .join('\n\n');

  const user = [
    `Weekly topic: "${topic.title}" (content pillar: ${pillar.label}).`,
    `Produce ${slots.length} connected posts that revolve around this single topic:`,
    '',
    postSpecs,
    '',
    'For every post also produce an infographic brief (title, 3-6 key points, one takeaway) in Arabic.',
    'Keep the three posts connected so they read as one weekly narrative.',
  ].join('\n');

  return { system, user, schema: SERIES_SCHEMA };
}
