export type FulfillmentStageKey = 'processing' | 'dispatch' | 'delivered';

const matchesAny = (value: string, patterns: RegExp[]) => patterns.some((pattern) => pattern.test(value));

const DELIVERED_PATTERNS: RegExp[] = [
  /deliver/i,
  /fulfill(ed)?/i,
  /collection/i,
  /\bcollected?\b/i,
  /\bclosed\b/i,
];

const DISPATCH_PATTERNS: RegExp[] = [
  /dispatch/i,
  /shipp?/i,
  /in[\s-]?transit/i,
  /out[\s-]?for[\s-]?delivery/i,
  /courier/i,
  /rider/i,
  /waybill/i,
  /pick[\s-]?up/i,
];

const PROCESSING_PATTERNS: RegExp[] = [
  /process/i,
  /quality/i,
  /\bready\b/i,
  /\blab\b/i,
  /prescription/i,
  /\bpx\b/i,
  /lens/i,
  /fitt?ing/i,
  /\bpending\b/i,
  /\bnew\b/i,
  /await/i,
  /confirm/i,
];

export const bucketFulfillmentStatus = (status: string): FulfillmentStageKey | null => {
  const value = (status ?? '').trim().toLowerCase();
  if (!value) return null;

  if (matchesAny(value, [/refund/i, /cancel/i, /reject/i, /\bcomplete(d)?\b/i])) return null;
  if (matchesAny(value, DELIVERED_PATTERNS)) return 'delivered';
  if (matchesAny(value, DISPATCH_PATTERNS)) return 'dispatch';
  if (matchesAny(value, PROCESSING_PATTERNS)) return 'processing';

  // Unknown statuses should stay in early workflow, not dispatch.
  return 'processing';
};
