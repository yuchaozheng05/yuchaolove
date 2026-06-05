import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(join(root, file), 'utf8');

function loadAppSandbox() {
  const noop = () => {};
  const element = {
    addEventListener: noop,
    replaceChildren: noop,
    appendChild: noop,
    append: noop,
    scrollIntoView: noop,
    classList: { add: noop, remove: noop, toggle: noop },
    style: {},
    hidden: false,
    value: '',
    textContent: '',
    innerHTML: '',
  };
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    document: {
      getElementById: () => element,
      createElement: () => ({ ...element }),
      body: element,
      execCommand: noop,
    },
    window: {
      screen: { width: 1440, height: 900 },
      location: { pathname: '/' },
      clearTimeout,
      setTimeout,
    },
    navigator: { language: 'zh-CN', clipboard: { writeText: async () => {} } },
    Intl,
  };
  sandbox.globalThis = sandbox;
  runInNewContext(`${read('app.js')}\nglobalThis.__parseAdvice = parseAdvice;`, sandbox);
  return sandbox;
}

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

test('client parser preserves backend repair advice instead of recalculating stop advice', () => {
  const sandbox = loadAppSandbox();
  const data = {
    attitude_label: '主动求关注',
    attitude_desc: '对方不是冷淡，而是在主动找你聊天；我方刚才回复偏冷，需要补救。',
    interest_score: 72,
    interest_level: '主动升温',
    interest_signals: ['对方主动找你聊天', '我方前面回复偏短偏冷'],
    conversation_mode: '轻松暧昧',
    conversation_stage: '暧昧升温',
    analysis: {
      stage: 'push_pull_flirting',
      stage_label: '推拉暧昧期',
      scene: 'playful_complaint / wants_connection',
      scene_id: 'playful_complaint_wants_connection',
      emotion: 'shy',
      reply_intent: 'repair_cold_reply',
      intimacy_score: 72,
    },
    relationship_memory_engine: {
      relationship_stage: 'push_pull_flirting',
      intimacy_score: 72,
      attraction_score: 72,
      investment_balance: 'balanced',
      initiator: 'other_person',
      risk_level: 'too_cold',
      next_best_move: '先承认刚才回得太冷。',
    },
    reply_strategy: '先承认刚才自己回得偏冷，再主动给一个话题。',
    flirt_level: '轻微暧昧',
    is_chat_screenshot: true,
    chat_evidence: { image_kind: 'chat', has_message_bubbles: true, has_chat_ui: true, has_two_sided_layout: true },
    chat_guide: {
      current_move: 'playful_complaint / wants_connection：先补救 → 承认刚才回太冷 → 主动给话题',
      next_steps: ['先承认刚才自己回得太冷。', '主动给一个话题，不要继续只回一个字。'],
      avoid: '避免把这轮误判成对方低兴趣。',
    },
    dialogue: [
      { side: 'right', text: '你要干啥' },
      { side: 'right', text: 'o' },
      { side: 'left', text: '我俩很不熟吗' },
      { side: 'left', text: '好的吧' },
      { side: 'left', text: '行吧' },
      { side: 'left', text: '怎么变熟点' },
    ],
    suggest_stop: false,
    needs_retry: false,
    replies: [
      { messages: ['那先从我不只回一个字开始', '刚刚是我太冷了', '我补回来'] },
      { messages: ['想变熟也简单', '你负责来找我', '我负责好好回你'] },
      { messages: ['先从认真陪你聊开始', '不装死了', '你问我我好好答'] },
    ],
    sticker_suggestions: [],
  };
  const parsed = sandbox.__parseAdvice(JSON.stringify(data));
  const replyText = parsed.replies.map((reply) => reply.text).join('\n');

  assert.equal(parsed.suggest_stop, false);
  assert.equal(parsed.analysis.scene, 'playful_complaint / wants_connection');
  assert.match(parsed.chat_guide.current_move, /先补救|承认刚才/);
  assert.match(replyText, /不只回一个字|太冷了|补回来|好好回你/);
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
