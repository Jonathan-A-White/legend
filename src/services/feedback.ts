// src/services/feedback.ts: feedback to the factory, a grist of the kind 'feedback' (grinds/feedback.json): which kind it is, the
// screen they were on, their words, the app's version and at most one screenshot they attach. The grind forwards ("forward":
// "mayor"): no model reads it, the mill mails it to the Mayor and answers {"status":"sent"}. The wire work is grist.ts's askGrind.
import type { grist } from 'bsv-kit/grist';
import { publish } from '../events/bus';
import { getDeviceKeyBytes } from './deviceKey';
import { askGrind, GristError } from './grist';

export const FEEDBACK_KIND = 'feedback';
export const FEEDBACK_VERSION = '1.0';

/** The limits of the input schema (schemas/feedback-input-1.0.schema.json). */
export const MAX_FEEDBACK_CHARS = 1200;
export const MAX_SCREEN_NAME = 40;

/** The screenshot a grist may carry: the grind's `attachments`. */
export const SCREENSHOT_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024;

/** 'Can I add this?' is add, 'Something's wrong' is wrong, and a note that is neither is other. */
export type FeedbackKind = 'add' | 'wrong' | 'other';

/** What the grind is sent (Feedback Request 1.0). */
export interface FeedbackRequest {
  kind: FeedbackKind;
  screen: string;
  text: string;
  app_version: string;
}

/** What the mill answers a forwarded grist: it has mailed it to the Mayor. */
export interface FeedbackAnswer {
  status: 'sent';
}

export function buildFeedbackRequest(kind: FeedbackKind, screen: string, text: string): FeedbackRequest {
  return { kind, screen: screen.trim().slice(0, MAX_SCREEN_NAME), text: text.trim(), app_version: __APP_VERSION__ };
}

/** The app's own check of an answer, run before it is believed: exactly the mill's {"status":"sent"}. */
export function isFeedbackAnswer(value: unknown): value is FeedbackAnswer {
  if (typeof value !== 'object' || value === null) return false;
  const answer = value as Record<string, unknown>;
  return Object.keys(answer).length === 1 && answer.status === 'sent';
}

/** Sends `request` (with its screenshot, if any) with the phone's key, waits for the mill's receipt and tells the bus ('feedback.sent').
 * Throws a GristError whatever went wrong; nothing is announced then. */
export async function submitFeedback(request: FeedbackRequest, options: { files?: grist.GristFile[]; signal?: AbortSignal } = {}): Promise<void> {
  try {
    await askGrind(FEEDBACK_KIND, request, isFeedbackAnswer, { key: getDeviceKeyBytes(), version: FEEDBACK_VERSION, files: options.files, signal: options.signal });
  } catch (err) {
    throw err instanceof GristError ? err : new GristError('unreachable', err instanceof Error ? err.message : 'Something went wrong.');
  }
  if (options.signal?.aborted) return;
  publish({ kind: 'feedback.sent', feedback: request.kind });
}
