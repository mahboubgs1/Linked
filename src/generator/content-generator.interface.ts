/**
 * Content generator abstraction.
 *
 * Implementations produce a full weekly series of connected posts for one topic
 * given the active calendar slots. V1 ships a deterministic template generator;
 * an AI-backed generator can be swapped in behind this same interface.
 */

import { ContentSlot, GeneratedSeries, Topic } from '../types';

export interface IContentGenerator {
  readonly name: string;
  generateSeries(topic: Topic, slots: ContentSlot[]): GeneratedSeries;
}
