import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(join(root, file), 'utf8');

test('keeps the stable multi-screenshot UI while loading stickers', () => {
  const html = read('index.html');
  assert.match(html, /<input[^>]+id="fileInput"[^>]+multiple/);
  assert.match(html, /id="previewGallery"/);
  assert.match(html, /id="addScreenshotBtn"/);
  assert.match(html, /id="chatGuide"/);
  assert.match(html, /id="conversationMode"/);
  assert.match(html, /id="conversationStage"/);
  assert.match(html, /id="stickerPanel"/);
  assert.match(html, /id="stickerGrid"/);
  assert.doesNotMatch(html, /点击分析后，本次截图、分析结果和基础访问记录会被保存/);
  assert.ok(html.indexOf('<script src="sticker.js"></script>') < html.indexOf('<script src="app.js"></script>'));
});

test('shows contextual stickers only after a usable chat result', () => {
  const app = read('app.js');
  const html = read('index.html');
  const stickers = read('sticker.js');
  assert.doesNotThrow(() => new Function(`${stickers}\n${app}`));
  assert.match(app, /showStickerPanel\(data\)/);
  assert.match(app, /data\.is_chat_screenshot && !data\.needs_retry && !data\.degraded/);
  assert.match(stickers, /function showStickerPanel\(advice\)/);
  assert.match(stickers, /STICKER_CATALOG_URL/);
  assert.match(stickers, /catalog\.v1\.json/);
  assert.match(stickers, /function loadStickerCatalog/);
  assert.match(stickers, /function recommendFromCatalog/);
  assert.match(stickers, /function scoreSticker/);
  assert.match(stickers, /FALLBACK_STICKERS/);
  assert.match(stickers, /makeFallbackCanvas/);
  assert.match(stickers, /STICKER_PANEL_RECOMMENDATION_COUNT = 6/);
  assert.match(stickers, /function createStickerArtElement/);
  assert.match(stickers, /function createStickerTextElement/);
  assert.match(stickers, /sticker-text-label/);
  assert.match(app, /function normalizeReplyCandidate/);
  assert.match(app, /reply-message-bubble/);
  assert.match(read('style.css'), /\.reply-message-bubble/);
  assert.match(read('style.css'), /\.sticker-grid \{[^}]*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(read('style.css'), /\.sticker-art/);
  assert.match(read('style.css'), /\.sticker-text-label/);
  assert.match(stickers, /sticker_suggestions/);
  assert.match(stickers, /sticker_match_intent/);
  assert.doesNotMatch(stickers, /STICKER_TEMPLATES/);
  assert.doesNotMatch(stickers, /ANIMATED_STICKER_SCENES/);
  assert.doesNotMatch(stickers, /sticker-motion-badge/);
  assert.match(html, /本地库存/);
  assert.match(html, /按语境匹配/);
  assert.doesNotMatch(html, /动图\/静态按语境/);
  assert.doesNotMatch(app, /selectedStyle|chipGroup/);
});

test('ships the stock sticker inventory files and scripts', () => {
  const packageJson = JSON.parse(read('package.json'));
  assert.equal(existsSync(join(root, 'assets', 'stickers', 'prompts', 'sticker-prompts.json')), true);
  assert.equal(existsSync(join(root, 'assets', 'stickers', 'packs', 'style-bible-v1', 'images')), true);
  assert.equal(existsSync(join(root, 'assets', 'stickers', 'packs', 'style-bible-v1', 'thumbs')), true);
  assert.equal(existsSync(join(root, 'assets', 'stickers', 'catalog.v1.json')), true);
  assert.equal(existsSync(join(root, 'scripts', 'generate-stickers.js')), true);
  assert.equal(existsSync(join(root, 'scripts', 'build-sticker-catalog.js')), true);
  assert.equal(packageJson.scripts['stickers:dry'], 'node scripts/generate-stickers.js --dry-run');
  assert.equal(packageJson.scripts['stickers:generate'], 'node scripts/generate-stickers.js');
  assert.equal(packageJson.scripts['stickers:build'], 'node scripts/build-sticker-catalog.js');
});

test('removes temporary sticker patch files after integration', () => {
  assert.equal(existsSync(join(root, '_inject_css.js')), false);
  assert.equal(existsSync(join(root, 'sticker-patch.css')), false);
});
