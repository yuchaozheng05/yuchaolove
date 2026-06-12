import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifySemanticStickerScene,
  buildStickerMatchIntent,
  recommendStockStickers,
} from '../api/analyze.js';

const GENERIC_TEXTS = /^(收到|好的|OK|OKOK|嗯嗯|对对对|没问题|可以|行吧|明白|了解|懂了|安排|好哒|我在听|然后呢|继续说|展开讲讲|后来呢)/i;

function recommend(lastText, extra = []) {
  const dialogue = [...extra, { speaker: '对方', text: lastText }];
  const intent = buildStickerMatchIntent({ dialogue });
  return { dialogue, picks: recommendStockStickers(intent, 6, dialogue) };
}

// ---------- 场景分类 ----------

test('场景分类：晚安/想念/感谢/安慰/确认各归其位', () => {
  assert.equal(classifySemanticStickerScene([{ speaker: '对方', text: '我先去睡啦 晚安' }])?.id, '晚安');
  assert.equal(classifySemanticStickerScene([{ speaker: '对方', text: '突然有点想你了' }])?.id, '想念');
  assert.equal(classifySemanticStickerScene([{ speaker: '对方', text: '谢谢你今天陪我' }])?.id, '感谢');
  assert.equal(classifySemanticStickerScene([{ speaker: '对方', text: '今天好难过 想哭' }])?.id, '安慰');
  assert.equal(classifySemanticStickerScene([{ speaker: '对方', text: '好的' }])?.id, '确认回应');
  assert.equal(classifySemanticStickerScene([{ speaker: '对方', text: '你是不是对谁都这么好' }])?.id, '暧昧试探');
});

test('场景分类：以对方最后一条为准，而不是整段关键词', () => {
  const scene = classifySemanticStickerScene([
    { speaker: '对方', text: '哈哈哈笑死我了' },
    { speaker: '我', text: '哈哈哈' },
    { speaker: '对方', text: '不说了 我去睡了 晚安' },
  ]);
  assert.equal(scene?.id, '晚安');
});

// ---------- 推荐结果：场景纯度 ----------

test('对方说晚安：推荐全部是晚安/睡觉相关，禁止泛用表情', () => {
  const { picks } = recommend('晚安~');
  assert.ok(picks.length >= 3 && picks.length <= 6, `数量应在3-6：${picks.length}`);
  for (const p of picks) {
    assert.match(p.text, /晚安|好梦|早睡|熬夜|睡/, `与晚安无关：${p.text}`);
    assert.ok(!GENERIC_TEXTS.test(p.text), `晚安场景不该出现泛用表情：${p.text}`);
  }
});

test('对方说想你了：推荐全部是想念/亲密相关', () => {
  const { picks } = recommend('想你了');
  assert.ok(picks.length >= 3, `数量不足：${picks.length}`);
  for (const p of picks) {
    assert.ok((p.scene || []).some((s) => ['想念', '撒娇', '亲密', '暧昧'].includes(s)),
      `与想念场景无关：${p.text} ${JSON.stringify(p.scene)}`);
    assert.ok(!/加油|收到|我在听/.test(p.text), `不相关表情混入：${p.text}`);
  }
});

test('对方说谢谢你：只推荐感谢场景库存，宁缺毋滥', () => {
  const { picks } = recommend('谢谢你呀');
  assert.ok(picks.length >= 1, '至少有感谢表情');
  for (const p of picks) {
    assert.ok((p.scene || []).includes('感谢'), `非感谢场景：${p.text}`);
  }
  // 库存里感谢类有限，不应为凑6个塞别的场景
  assert.ok(picks.length <= 6);
});

test('对方说好难过：推荐全部是安慰/关心相关', () => {
  const { picks } = recommend('今天好难过');
  assert.ok(picks.length >= 3);
  for (const p of picks) {
    assert.ok((p.scene || []).some((s) => ['安慰', '关心'].includes(s)),
      `非安慰场景：${p.text} ${JSON.stringify(p.scene)}`);
    assert.ok(!GENERIC_TEXTS.test(p.text), `安慰场景不该出现泛用表情：${p.text}`);
  }
});

test('确认场景才允许泛用表情：对方说"好的明天见"', () => {
  const { picks } = recommend('好的 明天见');
  assert.ok(picks.length >= 3);
  const hasConfirm = picks.some((p) => (p.scene || []).some((s) => ['确认', '回应', '告别'].includes(s)));
  assert.ok(hasConfirm, '确认/告别场景应有对应表情');
});

test('事实解释场景不被误判成鼓励或庆祝表情', () => {
  const dialogue = [
    { speaker: '对方', text: '爱回收，就平时收手机那个，包也收' },
    { speaker: '对方', text: '主要是它那个竞价模式我挺喜欢' },
    { speaker: '对方', text: '谁高我卖谁，不用我一家家跑去比' },
  ];
  const scene = classifySemanticStickerScene(dialogue);
  const intent = buildStickerMatchIntent({ dialogue });
  const picks = recommendStockStickers(intent, 6, dialogue);

  assert.equal(scene?.id, '事实解释');
  assert.ok(picks.length >= 3 && picks.length <= 6);
  for (const p of picks) {
    const haystack = [p.text, ...(p.scene || []), p.emotion?.primary, ...(p.scenario || [])].join(' ');
    assert.doesNotMatch(haystack, /加油|你很棒|太棒|相信自己|鼓励|庆祝/, `事实解释不应推荐鼓励/庆祝：${haystack}`);
    assert.ok((p.scene || []).some((s) => ['日常接话', '倾听', '无语', '吐槽', '惊叹'].includes(s)),
      `事实解释应从中性接话/思考场景里选：${p.text} ${JSON.stringify(p.scene)}`);
  }
});

test('暧昧试探"你是不是对谁都这么好"：推荐暧昧/心动方向', () => {
  const { picks } = recommend('你是不是对谁都这么好');
  assert.ok(picks.length >= 3);
  for (const p of picks) {
    assert.ok((p.scene || []).some((s) => ['暧昧', '心动', '想念', '亲密', '拉扯'].includes(s)),
      `偏离暧昧场景：${p.text} ${JSON.stringify(p.scene)}`);
  }
});

test('无明确场景时也不推荐泛用确认表情', () => {
  const { picks } = recommend('我家猫今天特别黏人');
  for (const p of picks) {
    assert.ok(!GENERIC_TEXTS.test(p.text) || (p.scene || []).includes('日常接话'),
      `无场景时混入泛用确认：${p.text}`);
  }
});

test('角色可以多样但场景必须一致（晚安）', () => {
  const { picks } = recommend('早点睡哦 晚安');
  const characters = new Set(picks.map((p) => p.character));
  assert.ok(characters.size >= 2, '应跨角色推荐');
  for (const p of picks) {
    assert.match(p.text, /晚安|好梦|早睡|熬夜|睡/);
  }
});
