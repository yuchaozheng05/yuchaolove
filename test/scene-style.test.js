import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GENERIC_REPLY_TEMPLATE_PATTERN,
  REPLY_COACH_SYSTEM_PROMPT,
  STYLE_DIMENSION_NOTE,
  extractConcreteFacts,
  getReplyGroundingReport,
  normalizeReplyCandidate,
  repairReplyCandidates,
} from '../api/analyze.js';

function makeAdvice({ dialogue, replies, scene = '', emotion = '' }) {
  return {
    dialogue,
    replies: replies.map((text) => ({ text, messages: [text], style_dimension: 'SINCERE' })),
    analysis: { scene, emotion, stage: 'daily_connection', reply_intent: '', intimacy_score: 30 },
  };
}

// ---------- prompt 规则存在性 ----------

test('REPLY_COACH_SYSTEM_PROMPT 包含第一原则：不预设固定人格', () => {
  assert.match(REPLY_COACH_SYSTEM_PROMPT, /不要预设固定人格/);
  assert.match(REPLY_COACH_SYSTEM_PROMPT, /先理解当前聊天场景/);
});

test('REPLY_COACH_SYSTEM_PROMPT 要求先抓截图重点再写回复', () => {
  assert.match(REPLY_COACH_SYSTEM_PROMPT, /抓重点/);
  assert.match(REPLY_COACH_SYSTEM_PROMPT, /对方最后一句/);
  assert.match(REPLY_COACH_SYSTEM_PROMPT, /禁止万能哲学句、万能鸡汤句、万能高情商语录/);
});

test('REPLY_COACH_SYSTEM_PROMPT 定义场景优先级且情绪安慰最高', () => {
  assert.match(REPLY_COACH_SYSTEM_PROMPT, /场景决定风格/);
  assert.match(REPLY_COACH_SYSTEM_PROMPT, /情绪安慰[\s\S]{0,40}永远最高/);
  assert.match(REPLY_COACH_SYSTEM_PROMPT, /禁止智性恋金句/);
});

test('REPLY_COACH_SYSTEM_PROMPT 限定智性恋人格使用边界', () => {
  assert.match(REPLY_COACH_SYSTEM_PROMPT, /智性恋人格的使用边界/);
  assert.match(REPLY_COACH_SYSTEM_PROMPT, /不是每个人都值得我认真对待/);
});

test('REPLY_COACH_SYSTEM_PROMPT 包含上下文测试和AI味检查', () => {
  assert.match(REPLY_COACH_SYSTEM_PROMPT, /上下文测试/);
  assert.match(REPLY_COACH_SYSTEM_PROMPT, /AI味检查/);
  assert.match(REPLY_COACH_SYSTEM_PROMPT, /心理咨询师口吻/);
  assert.match(REPLY_COACH_SYSTEM_PROMPT, /这是AI写的/);
});

test('STYLE_DIMENSION_NOTE 增加 INTELLECTUAL 且限制使用场景', () => {
  assert.ok(STYLE_DIMENSION_NOTE.includes('INTELLECTUAL'));
  assert.match(STYLE_DIMENSION_NOTE, /智性恋/);
  assert.match(STYLE_DIMENSION_NOTE, /禁止使用/);
});

// ---------- AI味模板过滤 ----------

test('GENERIC_REPLY_TEMPLATE_PATTERN 能拦截鸡汤和咨询师口吻', () => {
  const aiFlavored = [
    '我理解你的感受',
    '听起来你今天很累',
    '人生就像一场旅行',
    '有时候身体的疲惫只是灵魂的投影',
    '时间会治愈一切的',
    '加油哦，一切都会好起来的',
    '你要好好照顾自己',
    '人生总会经历离别',
    '猫咪是孤独灵魂的映射',
  ];
  for (const text of aiFlavored) {
    assert.ok(GENERIC_REPLY_TEMPLATE_PATTERN.test(text), `应拦截：${text}`);
  }
});

test('GENERIC_REPLY_TEMPLATE_PATTERN 不误伤真人风格回复', () => {
  const humanReplies = [
    '这张图已经把我看饿了',
    '它一看就是家里地位最高的那个',
    '多少度啊，先把退烧药吃了',
    '不是每个人都值得我认真对待',
    '秤有时候也会情绪化',
    '希望她平安，你也别一个人硬撑',
    '锅底选的什么，看着就香',
  ];
  for (const text of humanReplies) {
    assert.ok(!GENERIC_REPLY_TEMPLATE_PATTERN.test(text), `不应误伤：${text}`);
  }
});

// ---------- 场景测试：生病（情绪安慰优先级最高） ----------

test('生病场景：鸡汤回复触发修复，修复后命中具体事实且无AI味', () => {
  const advice = makeAdvice({
    dialogue: [
      { speaker: '对方', text: '我好像发烧了' },
      { speaker: '对方', text: '头疼 浑身没劲' },
    ],
    replies: [
      '有时候身体的疲惫只是灵魂的投影',
      '我理解你的感受',
      '时间会治愈一切的',
    ],
    scene: '身体不舒服',
  });
  const report = getReplyGroundingReport(advice);
  assert.ok(report.needs_repair, '鸡汤回复应触发修复');

  const repaired = repairReplyCandidates(advice);
  assert.ok(repaired.replies.length >= 3);
  for (const reply of repaired.replies) {
    assert.ok(!GENERIC_REPLY_TEMPLATE_PATTERN.test(reply.text), `修复后不应有AI味：${reply.text}`);
  }
  const facts = extractConcreteFacts(advice.dialogue);
  assert.ok(facts.some((f) => f.id === 'headache' || f.id === 'cold'), '应识别出头痛/发烧事实');
});

// ---------- 场景测试：日常分享（火锅） ----------

test('火锅日常分享：万能升华句触发修复，修复后接住火锅本身', () => {
  const advice = makeAdvice({
    dialogue: [
      { speaker: '对方', text: '刚吃完火锅 撑死我了' },
    ],
    replies: [
      '人生就像火锅，总要趁热',
      '听起来你今天过得很充实',
      '你要好好照顾自己',
    ],
    scene: '日常美食',
  });
  const report = getReplyGroundingReport(advice);
  assert.ok(report.needs_repair, '万能句应触发修复');

  const repaired = repairReplyCandidates(advice);
  const joined = repaired.replies.map((r) => r.text).join(' ');
  assert.ok(/火锅|撑|锅底|消化|快乐/.test(joined), `修复后应接住火锅话题：${joined}`);
  for (const reply of repaired.replies) {
    assert.ok(!GENERIC_REPLY_TEMPLATE_PATTERN.test(reply.text), `修复后不应有AI味：${reply.text}`);
  }
});

// ---------- 场景测试：暧昧信号下保留真人感 ----------

test('吃醋场景：识别事实且不把回复换成通用安慰', () => {
  const dialogue = [
    { speaker: '对方', text: '你最近跟她聊挺多的啊' },
  ];
  const facts = extractConcreteFacts(dialogue);
  assert.ok(facts.some((f) => f.id === 'jealousy'), '应识别出吃醋事实');

  const advice = makeAdvice({
    dialogue,
    replies: [
      '我跟她聊的都是工作的事，你才是我会主动找的人',
      '你这是在意我的意思吗',
      '分寸我有数，不舒服的话我跟你讲清楚',
    ],
    scene: '吃醋',
  });
  const report = getReplyGroundingReport(advice);
  assert.equal(report.needs_repair, false, '已经接住吃醋重点的真人回复不应被替换');
});

// ---------- INTELLECTUAL 维度 ----------

test('normalizeReplyCandidate 保留 INTELLECTUAL 维度', () => {
  const candidate = normalizeReplyCandidate({
    messages: ['不是每个人都值得我认真对待'],
    style_dimension: 'INTELLECTUAL',
  });
  assert.equal(candidate.style_dimension, 'INTELLECTUAL');
});

test('normalizeReplyCandidate 把非法维度回落为 SINCERE', () => {
  const candidate = normalizeReplyCandidate({
    messages: ['随便写点'],
    style_dimension: 'PHILOSOPHER',
  });
  assert.equal(candidate.style_dimension, 'SINCERE');
});
