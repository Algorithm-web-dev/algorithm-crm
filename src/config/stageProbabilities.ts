// ============================================================================
//  Stage close-probabilities, loaded from /config/stage-probabilities.json.
//  The JSON is validated at build time — a missing stage or out-of-range value
//  fails the deploy rather than silently shipping bad numbers.
// ============================================================================

import { z } from 'zod';
import raw from '../../config/stage-probabilities.json';

const pct = z.number().int().min(0).max(100);

const schema = z.object({
  status: z.string(),
  lastReviewed: z.string().nullable(),
  reviewedBy: z.string().nullable(),
  probabilities: z
    .object({
      inbox: pct,
      qualifying: pct,
      discovery: pct,
      proposal: pct,
      negotiation: pct,
      verbal: pct,
      won: pct,
      lost: pct,
    })
    .strict(),
});

export const STAGE_PROBABILITY_CONFIG = schema.parse(raw);
export const STAGE_PROBABILITIES = STAGE_PROBABILITY_CONFIG.probabilities;
