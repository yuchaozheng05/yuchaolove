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
  assert.match(stickers, /STICKER_TEMPLATES/);
  assert.match(stickers, /USE_TEMPLATE_IMAGES = false/);
  assert.match(stickers, /drawTemplateSticker/);
  assert.match(stickers, /STICKER_PANEL_RECOMMENDATION_COUNT=6/);
  assert.match(stickers, /sticker_suggestions/);
  assert.match(stickers, /ANIMATED_STICKER_SCENES/);
  assert.match(stickers, /sticker-motion-badge/);
  assert.match(stickers, /animated\?'block':'none'/);
  assert.match(stickers, /filter\(s=>s\.scene\)/);
  assert.match(stickers, /text\?\`配字：\$\{text\}\`:'无配字'/);
  assert.match(stickers, /assets\/stickers\/comfort-bunny\.png/);
  assert.match(stickers, /assets\/stickers\/study-bunny\.png/);
  assert.doesNotMatch(stickers, /assets\/stickers\/lazy-phone-duck\.png/);
  assert.match(html, /有字\/无字/);
  assert.match(html, /动图\/静态按语境/);
  assert.doesNotMatch(app, /selectedStyle|chipGroup/);
});

test('ships the generated meme sticker templates', () => {
  [
    'comfort-bunny.png',
    'rest-bunny.png',
    'study-bunny.png',
    'listen-hamster.png',
    'happy-bunny.png',
    'cheer-bunny.png',
    'peek-bunny-v2.png',
    'confused-bunny.png',
    'pat-bunnies.png',
  ].forEach((file) => assert.equal(existsSync(join(root, 'assets', 'stickers', file)), true));
});

test('removes temporary sticker patch files after integration', () => {
  assert.equal(existsSync(join(root, '_inject_css.js')), false);
  assert.equal(existsSync(join(root, 'sticker-patch.css')), false);
});
