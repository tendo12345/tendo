import productsData from '../data/products.json';
import type { Row } from '../engine/types';

const products = productsData as Row[];

/** The real, unique `Product Type` values from products.json (161 rows), sorted A→Z. */
export const PRODUCT_TYPES: string[] = Array.from(
  new Set(products.map((p) => p['Product Type']).filter((v): v is string => Boolean(v))),
).sort((a, b) => a.localeCompare(b));

/** Case-insensitive substring match, capped, for the product type combobox. */
export function matchProductTypes(query: string, limit = 8): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return PRODUCT_TYPES.slice(0, limit);
  return PRODUCT_TYPES.filter((t) => t.toLowerCase().includes(q)).slice(0, limit);
}
