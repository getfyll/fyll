import type { AuditLog, AuditLogItem, Product } from '@/lib/state/fyll-store';
import type { AuditItem, CategoryAuditSection, ProductAuditGroup } from './types';

export const UNCATEGORIZED_CATEGORY = 'Uncategorized';

export const getVariantName = (variableValues: Record<string, string>): string => {
  const values = Object.values(variableValues ?? {}).filter((value) => value.trim().length > 0);
  if (values.length === 0) return 'Default';
  return values.join(' / ');
};

export const parseCount = (value: string): number | null => {
  if (!value.trim()) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

export const buildAuditItems = (products: Product[]): AuditItem[] => {
  return products.flatMap((product) => {
    const categoryName = product.categories?.[0]?.trim() || UNCATEGORIZED_CATEGORY;

    return product.variants.map((variant) => {
      const variantName = getVariantName(variant.variableValues);
      return {
        productId: product.id,
        productName: product.name,
        categoryName,
        variantId: variant.id,
        variantName,
        combinedName: `${product.name} ${variantName}`,
        expectedStock: variant.stock,
        physicalCount: '',
        sku: variant.sku,
      };
    });
  });
};

export const buildCategorySections = (items: AuditItem[]): CategoryAuditSection[] => {
  const categoryMap = new Map<string, Map<string, ProductAuditGroup>>();

  items.forEach((item) => {
    if (!categoryMap.has(item.categoryName)) {
      categoryMap.set(item.categoryName, new Map<string, ProductAuditGroup>());
    }

    const productMap = categoryMap.get(item.categoryName);
    if (!productMap) return;

    if (!productMap.has(item.productId)) {
      productMap.set(item.productId, {
        productId: item.productId,
        productName: item.productName,
        items: [],
      });
    }

    productMap.get(item.productId)?.items.push(item);
  });

  return Array.from(categoryMap.entries())
    .map(([categoryName, productMap]) => {
      const products = Array.from(productMap.values())
        .map((product) => ({
          ...product,
          items: [...product.items].sort((a, b) => a.variantName.localeCompare(b.variantName)),
        }))
        .sort((a, b) => a.productName.localeCompare(b.productName));

      const totalItems = products.reduce((sum, product) => sum + product.items.length, 0);
      const countedItems = products.reduce(
        (sum, product) =>
          sum + product.items.filter((item) => parseCount(item.physicalCount) !== null).length,
        0
      );

      return {
        categoryName,
        data: products,
        totalItems,
        countedItems,
      };
    })
    .sort((a, b) => a.categoryName.localeCompare(b.categoryName));
};

export const getAuditProgress = (items: AuditItem[]) => {
  const total = items.length;
  const counted = items.filter((item) => parseCount(item.physicalCount) !== null).length;
  const discrepancyCount = items.filter((item) => {
    const actual = parseCount(item.physicalCount);
    return actual !== null && actual !== item.expectedStock;
  }).length;
  const matchCount = items.filter((item) => {
    const actual = parseCount(item.physicalCount);
    return actual !== null && actual === item.expectedStock;
  }).length;

  return {
    total,
    counted,
    discrepancyCount,
    matchCount,
    completionRatio: total > 0 ? counted / total : 0,
  };
};

export const getAccuracyPercentage = (items: AuditLogItem[]): number => {
  if (!items.length) return 100;
  const matched = items.filter((item) => item.actualStock === item.expectedStock).length;
  return Math.round((matched / items.length) * 100);
};

export const getAuditSummary = (log: AuditLog) => {
  const items = log.items ?? [];
  const accuracy = getAccuracyPercentage(items);

  return {
    id: log.id,
    completedAt: log.completedAt,
    dateLabel: new Date(log.completedAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    itemsAudited: log.itemsAudited,
    discrepancies: log.discrepancies,
    performedBy: log.performedBy ?? 'Team',
    accuracy,
  };
};
