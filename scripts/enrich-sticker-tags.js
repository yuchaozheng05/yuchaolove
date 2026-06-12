/**
 * 给现有 assets/stickers/catalog.v1.json 批量回填 usage_role / negative_tags。
 * 用法：node scripts/enrich-sticker-tags.js [--dry-run]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { enrichStickerItem } from './sticker-tag-rules.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const catalogPath = join(root, 'assets', 'stickers', 'catalog.v1.json');
const dryRun = process.argv.includes('--dry-run');

const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
const items = Array.isArray(catalog.items) ? catalog.items : [];
const enriched = items.map(enrichStickerItem);

const withRole = enriched.filter((item) => item.usage_role?.length).length;
const withNegative = enriched.filter((item) => item.negative_tags?.length).length;
console.log(`items: ${items.length}, usage_role: ${withRole}, negative_tags: ${withNegative}`);

if (dryRun) {
  console.log(JSON.stringify(enriched.slice(0, 3), null, 2));
} else {
  writeFileSync(catalogPath, `${JSON.stringify({ ...catalog, items: enriched }, null, 2)}\n`);
  console.log(`written: ${catalogPath}`);
}
