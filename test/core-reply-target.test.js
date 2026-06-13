import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findCoreReplyTarget,
  classifySemanticStickerScene,
  buildStickerMatchIntent,
  dropCustomerServiceReplies,
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

// ---------- 模型语义场景信号 ----------

test('模型场景提示优先：没有关键词的情绪句也能进安慰场景', () => {
  const dialogue = [{ speaker: '对方', text: '心里堵得慌' }];
  assert.equal(classifySemanticStickerScene(dialogue), null, '纯正则应判不出场景');
  assert.equal(classifySemanticStickerScene(dialogue, '情绪低落')?.id, '安慰');
  assert.equal(classifySemanticStickerScene(dialogue, '吃醋查岗')?.id, '吃醋哄人');
  assert.equal(classifySemanticStickerScene(dialogue, '表白试探')?.id, '暧昧试探');
});

test('模型场景提示参与推荐：道歉/感谢库存可被命中', () => {
  const dialogue = [{ speaker: '对方', text: '你今天帮了我大忙' }];
  const intent = buildStickerMatchIntent({ dialogue });
  const picks = recommendStockStickers(intent, 6, dialogue, '感谢');
  assert.ok(picks.length >= 3, `感谢场景应有足够库存：${picks.length}`);
  for (const p of picks) {
    assert.ok((p.scene || []).some((s) => ['感谢', '亲密'].includes(s)), `与感谢无关：${p.text}`);
  }
});

test('对方生我的气 → 道歉表情；对方吐槽气死了 → 哄/安慰，不道歉', () => {
  assert.equal(classifySemanticStickerScene([{ speaker: '对方', text: '你还在生我气吗' }])?.id, '哄人道歉');
  assert.equal(classifySemanticStickerScene([{ speaker: '对方', text: '我真的气死了' }])?.id, '吃醋哄人');

  const apologyDialogue = [{ speaker: '对方', text: '你还在生我气吗' }];
  const apology = recommendStockStickers(buildStickerMatchIntent({ dialogue: apologyDialogue }), 6, apologyDialogue);
  assert.ok(apology.some((p) => /对不起|我错|抱歉|惹你生气/.test(p.text)),
    `对方生我气时应出现道歉表情：${apology.map((p) => p.text).join('、')}`);

  const ventDialogue = [{ speaker: '对方', text: '我真的气死了' }];
  const vent = recommendStockStickers(buildStickerMatchIntent({ dialogue: ventDialogue }), 6, ventDialogue);
  assert.ok(vent.every((p) => !/对不起|我错啦|抱歉|都是我的错/.test(p.text)),
    `对方吐槽别人时不该道歉：${vent.map((p) => p.text).join('、')}`);
});

test('无效的模型提示回退正则判断', () => {
  const scene = classifySemanticStickerScene([{ speaker: '对方', text: '晚安~' }], '不存在的场景');
  assert.equal(scene?.id, '晚安');
});

// ---------- 客服味候选硬过滤 ----------

test('客服味候选被过滤，正常候选保留', () => {
  const advice = {
    replies: [
      { text: '听起来你今天很累', messages: ['听起来你今天很累'] },
      { text: '先躺一会儿，我给你点杯热的', messages: ['先躺一会儿', '我给你点杯热的'] },
      { text: '你的感受是正常的', messages: ['你的感受是正常的'] },
      { text: '这题卡住真的会烦死', messages: ['这题卡住真的会烦死'] },
      { text: '抱抱，今天辛苦你了还想着我', messages: ['抱抱，今天辛苦你了还想着我'] },
    ],
  };
  const result = dropCustomerServiceReplies(advice);
  assert.equal(result.replies.length, 3);
  assert.ok(result.replies.every((r) => !/^听起来|感受是正常/.test(r.text)));
});

test('过滤后不足 3 条则保持原样（保底优先）', () => {
  const advice = {
    replies: [
      { text: '听起来你很难过', messages: [] },
      { text: '我理解你的感受', messages: [] },
      { text: '你可以尝试深呼吸', messages: [] },
      { text: '先睡吧', messages: [] },
    ],
  };
  const result = dropCustomerServiceReplies(advice);
  assert.equal(result.replies.length, 4, '只剩1条合格时不动原数组');
});

test('恰好 3 条时不过滤', () => {
  const advice = { replies: [{ text: '听起来不错' }, { text: 'a' }, { text: 'b' }] };
  assert.equal(dropCustomerServiceReplies(advice).replies.length, 3);
});

test('推荐数量永不超过 6', () => {
  const cases = ['晚安~', '想你了', '今天真的好难过', '哈哈哈笑死我了', '刚吃完火锅 好幸福'];
  for (const text of cases) {
    const picks = recommend([{ speaker: '对方', text }]);
    assert.ok(picks.length <= 6, `${text} 推荐了 ${picks.length} 个`);
  }
});
