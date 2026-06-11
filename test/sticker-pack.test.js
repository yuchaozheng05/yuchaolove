import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHAT_ADVICE_SCHEMA } from '../api/analyze.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pack = JSON.parse(
  readFileSync(join(root, 'assets/stickers/prompts/screenshot-pack-prompts.json'), 'utf8'),
);

const stickerProps = CHAT_ADVICE_SCHEMA.properties.sticker_suggestions.items.properties;
const EMOTIONS = new Set(stickerProps.emotion.enum);
const SCENARIOS = new Set(stickerProps.scenario.enum);
const CHARACTERS = new Set(['white_mochi', 'hamster', 'cat', 'shiba']);

test('截图扩展包：88 个表情且文件名唯一', () => {
  assert.equal(pack.length, 88);
  const names = new Set(pack.map((i) => i.filename));
  assert.equal(names.size, pack.length, '文件名不能重复');
});

test('截图扩展包：四个角色齐全且含柴犬', () => {
  const counts = {};
  for (const item of pack) {
    assert.ok(CHARACTERS.has(item.character), `非法角色：${item.character}`);
    counts[item.character] = (counts[item.character] || 0) + 1;
  }
  assert.ok(counts.shiba >= 20, `柴犬数量不足：${counts.shiba}`);
  assert.equal(Object.keys(counts).length, 4);
});

test('截图扩展包：每张都有准确的中文文字（修复文字不匹配）', () => {
  for (const item of pack) {
    assert.ok(item.text && item.text.trim().length > 0, `${item.filename} 缺文字`);
    assert.ok(item.text.length <= 8, `${item.filename} 文字过长：${item.text}`);
  }
});

test('截图扩展包：emotion/scenario 都在 analyze.js 枚举内', () => {
  for (const item of pack) {
    assert.ok(EMOTIONS.has(item.emotion), `${item.filename} emotion 非法：${item.emotion}`);
    assert.ok(SCENARIOS.has(item.scenario), `${item.filename} scenario 非法：${item.scenario}`);
  }
});

test('截图扩展包：完整覆盖截图六行的关键文字', () => {
  const texts = new Set(pack.map((i) => i.text));
  const required = ['早安呀~', '晚安好梦', '想你啦~', '来抱抱~', '好开心！', '气死我了！',
    '没事的~', '加油鸭！', '你是最棒的！', '哈哈哈', '哇塞！', '厉害了！', '生日快乐！', '新年快乐！'];
  for (const t of required) {
    assert.ok(texts.has(t), `缺少截图文字：${t}`);
  }
});

test('截图扩展包：每项都有 action 描述（保证全身完整构图）', () => {
  for (const item of pack) {
    assert.ok(item.action && item.action.length > 20, `${item.filename} 缺 action`);
    assert.ok(!item.prompt, `${item.filename} 不应带自定义 prompt（会绕过风格圣经）`);
  }
});
