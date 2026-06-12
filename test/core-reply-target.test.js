import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findCoreReplyTarget,
  classifySemanticStickerScene,
  buildStickerMatchIntent,
  recommendStockStickers,
} from '../api/analyze.js';

const GENERIC_TEXTS = /^(收到|好的|OK|OKOK|嗯嗯|对对对|没问题|可以|行吧|明白|了解|懂了|安排|好哒|我在听|然后呢|继续说|展开讲讲|后来呢)/i;

function recommend(dialogue) {
  const intent = buildStickerMatchIntent({ dialogue });
  return recommendStockStickers(intent, 6, dialogue);
}

// ---------- 核心未回复消息识别 ----------

test('情绪表达优先于收回情绪的补充句：难过 > 不过没事啦', () => {
  const target = findCoreReplyTarget([
    { speaker: '对方', text: '今天真的好难过' },
    { speaker: '对方', text: '不过没事啦' },
  ]);
  assert.equal(target?.text, '今天真的好难过');
  assert.equal(target?.category, 'comfort_seeking');
});

test('关系试探多条未回复时取更晚一条', () => {
  const target = findCoreReplyTarget([
    { speaker: '对方', text: '你真的懂我吗？' },
    { speaker: '对方', text: '你是不是对谁都这么好啊？' },
  ]);
  assert.equal(target?.text, '你是不是对谁都这么好啊？');
  assert.equal(target?.category, 'relationship_probe');
});

test('只看我方最后一条之后的未回复消息', () => {
  const target = findCoreReplyTarget([
    { speaker: '对方', text: '今天真的好难过' },
    { speaker: '我', text: '抱抱你' },
    { speaker: '对方', text: '刚吃完火锅' },
  ]);
  assert.equal(target?.text, '刚吃完火锅');
  assert.equal(target?.category, 'share');
});

test('情绪倾诉优先于结尾的晚安', () => {
  const target = findCoreReplyTarget([
    { speaker: '对方', text: '今天真的好难过' },
    { speaker: '对方', text: '晚安' },
  ]);
  assert.equal(target?.text, '今天真的好难过');
});

test('语气词/哈哈不会成为核心消息，全是语气词时退回最后一条', () => {
  const mixed = findCoreReplyTarget([
    { speaker: '对方', text: '我跟你说我考砸了' },
    { speaker: '对方', text: '哈哈哈哈' },
  ]);
  assert.equal(mixed?.text, '我跟你说我考砸了');

  const fillerOnly = findCoreReplyTarget([
    { speaker: '对方', text: '哈哈哈' },
  ]);
  assert.equal(fillerOnly?.text, '哈哈哈');
  assert.equal(fillerOnly?.category, 'filler');
});

test('没有未回复消息时返回 null', () => {
  assert.equal(findCoreReplyTarget([
    { speaker: '对方', text: '晚安' },
    { speaker: '我', text: '晚安呀' },
  ]), null);
  assert.equal(findCoreReplyTarget([]), null);
});

// ---------- 场景分类基于核心消息而不是最后一句 ----------

test('「好难过 / 不过没事啦」判为安慰场景，不被最后一句带偏', () => {
  const scene = classifySemanticStickerScene([
    { speaker: '对方', text: '今天真的好难过' },
    { speaker: '对方', text: '不过没事啦' },
  ]);
  assert.equal(scene?.id, '安慰');
});

test('「好难过 / 晚安」按核心消息判为安慰，不是晚安', () => {
  const scene = classifySemanticStickerScene([
    { speaker: '对方', text: '今天真的好难过' },
    { speaker: '对方', text: '晚安' },
  ]);
  assert.equal(scene?.id, '安慰');
});

// ---------- 推荐：negative_tags 硬过滤 + 3~6 宁缺毋滥 ----------

test('安慰场景（带收尾补充句）：不出现泛用确认表情，数量 3~6', () => {
  const picks = recommend([
    { speaker: '对方', text: '今天真的好难过' },
    { speaker: '对方', text: '不过没事啦' },
  ]);
  assert.ok(picks.length >= 3 && picks.length <= 6, `数量应在3-6：${picks.length}`);
  for (const p of picks) {
    assert.ok(!GENERIC_TEXTS.test(p.text), `安慰场景不该出现泛用表情：${p.text}`);
    assert.ok(!(p.negative_tags || []).includes('安慰'), `negative_tags 含安慰的库存混入：${p.text}`);
  }
});

test('推荐结果携带 usage_role / negative_tags 字段', () => {
  const picks = recommend([{ speaker: '对方', text: '今天真的好难过' }]);
  assert.ok(picks.length >= 1);
  for (const p of picks) {
    assert.ok(Array.isArray(p.usage_role), 'usage_role 应为数组');
    assert.ok(Array.isArray(p.negative_tags), 'negative_tags 应为数组');
  }
});

test('暧昧试探：泛用确认类（收到/好的）绝不出现', () => {
  const picks = recommend([{ speaker: '对方', text: '你是不是对谁都这么好啊？' }]);
  assert.ok(picks.length >= 3 && picks.length <= 6, `数量应在3-6：${picks.length}`);
  for (const p of picks) {
    assert.ok(!GENERIC_TEXTS.test(p.text), `暧昧试探不该出现泛用表情：${p.text}`);
  }
});

test('推荐数量永不超过 6', () => {
  const cases = ['晚安~', '想你了', '今天真的好难过', '哈哈哈笑死我了', '刚吃完火锅 好幸福'];
  for (const text of cases) {
    const picks = recommend([{ speaker: '对方', text }]);
    assert.ok(picks.length <= 6, `${text} 推荐了 ${picks.length} 个`);
  }
});
