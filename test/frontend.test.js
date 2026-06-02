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
  assert.match(html, /id="stickerPanel"/);
  assert.match(html, /id="stickerGrid"/);
  assert.ok(html.indexOf('<script src="sticker.js"></script>') < html.indexOf('<script src="app.js"></script>'));
});

test('shows contextual stickers only after a usable chat result', () => {
  const app = read('app.js');
  const stickers = read('sticker.js');
  assert.match(app, /showStickerPanel\(data\)/);
  assert.match(app, /data\.is_chat_screenshot && !data\.needs_retry && !data\.degraded/);
  assert.match(stickers, /function showStickerPanel\(advice\)/);
  assert.match(stickers, /STICKER_TEXT_BY_EXPR/);
  assert.doesNotMatch(app, /selectedStyle|chipGroup/);
});

test('removes temporary sticker patch files after integration', () => {
  assert.equal(existsSync(join(root, '_inject_css.js')), false);
  assert.equal(existsSync(join(root, 'sticker-patch.css')), false);
});
