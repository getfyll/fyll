import { ProductType } from '@/lib/state/fyll-store';

/**
 * Normalize a product type string or enum to the canonical ProductType.
 * Accepts values like "service", "services", "Service" and falls back to "product".
 */
export const normalizeProductType = (value?: string | ProductType): ProductType => {
  const normalized = (value ?? 'product').toString().toLowerCase().trim();
  if (normalized.startsWith('service')) {
    return 'service';
  }
  return 'product';
};
