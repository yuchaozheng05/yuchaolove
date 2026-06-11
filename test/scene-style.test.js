import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GENERIC_REPLY_TEMPLATE_PATTERN,
  REFLECTIVE_INTELLIGENCE_NOTE,
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

// ---------- Reflective Intelligence ----------

test('REFLECTIVE_INTELLIGENCE_NOTE 包含触发条件、回复公式和质量检查', () => {
  assert.ok(typeof REFLECTIVE_INTELLIGENCE_NOTE === 'string');
  assert.match(REFLECTIVE_INTELLIGENCE_NOTE, /触发条件/);
  assert.match(REFLECTIVE_INTELLIGENCE_NOTE, /问题背后的情绪需求/);
  assert.match(REFLECTIVE_INTELLIGENCE_NOTE, /回复公式/);
  assert.match(REFLECTIVE_INTELLIGENCE_NOTE, /质量检查/);
  assert.match(REFLECTIVE_INTELLIGENCE_NOTE, /不要照抄/);
  assert.match(REFLECTIVE_INTELLIGENCE_NOTE, /INTELLECTUAL/);
});

test('REFLECTIVE_INTELLIGENCE_NOTE 限定触发场景且禁止泛用', () => {
  assert.match(REFLECTIVE_INTELLIGENCE_NOTE, /其他场景不要使用/);
  assert.match(REFLECTIVE_INTELLIGENCE_NOTE, /不要直接回答表层问题/);
  assert.match(REFLECTIVE_INTELLIGENCE_NOTE, /不像金句，不像鸡汤，不像AI/);
});

test('REFLECTIVE_INTELLIGENCE_NOTE 包含核心参考案例', () => {
  assert.match(REFLECTIVE_INTELLIGENCE_NOTE, /不是一道证明题/);
  assert.match(REFLECTIVE_INTELLIGENCE_NOTE, /认真和偏爱，通常只会给少数人/);
  assert.match(REFLECTIVE_INTELLIGENCE_NOTE, /第一个想到的是谁/);
});

test('REPLY_COACH_SYSTEM_PROMPT 引用 Reflective Intelligence 触发规则', () => {
  assert.match(REPLY_COACH_SYSTEM_PROMPT, /Reflective Intelligence/);
  assert.match(REPLY_COACH_SYSTEM_PROMPT, /情感试探提问/);
});

test('Reflective 案例回复不会被 AI 味兜底正则误杀', () => {
  const reflectiveReplies = [
    '爱好像本来就不是一道证明题\n如果非要证明的话，一个人愿意把时间留给谁，答案其实已经很明显了',
    '善良可以给很多人\n但认真和偏爱，通常只会给少数人',
    '会在意\n因为人在乎的从来不是输赢，而是自己在对方心里的位置',
    '一个人重不重要，不是看聊天记录有多长\n而是看发生事情的时候，第一个想到的是谁',
    '信任这种东西太贵了\n我宁愿少说一点，也不想用谎言换一时的好感',
  ];
  for (const text of reflectiveReplies) {
    assert.ok(!GENERIC_REPLY_TEMPLATE_PATTERN.test(text), `不应误杀：${text}`);
  }
});

test('情感试探"你为什么喜欢我"不触发撤回修复分支，保留思考型回复', () => {
  const mk = (t, d) => ({ text: t, messages: t.split('\n'), style_dimension: d });
  const advice = {
    dialogue: [{ speaker: '对方', text: '你为什么喜欢我' }],
    analysis: { scene: '表白试探' },
    replies: [
      mk('我觉得喜欢很少是因为某一个优点\n更多是因为和你聊天的时候，我会变成自己喜欢的样子', 'INTELLECTUAL'),
      mk('这个问题我想了一下\n大概是你偶尔会让我想了解你', 'SINCERE'),
      mk('真要说原因的话\n是你上次接住我那个冷笑话的时候', 'LIGHTHEARTED'),
    ],
  };
  const repaired = repairReplyCandidates(advice);
  assert.equal(repaired.replies, advice.replies, '思考型回复不应被替换成撤回模板');
});

test('追问判断依据"怎么就确定了"仍走撤回修复分支', () => {
  const mk = (t) => ({ text: t, messages: [t], style_dimension: 'SINCERE' });
  const advice = {
    dialogue: [{ speaker: '对方', text: '你不是说我很难懂吗，那你怎么就确定了呢' }],
    analysis: { scene: '轻松追问' },
    replies: [
      mk('让我观察你这个难懂的秘密'),
      mk('以后再告诉你'),
      mk('你猜猜看'),
    ],
  };
  const repaired = repairReplyCandidates(advice);
  const joined = repaired.replies.map((r) => r.text).join(' ');
  assert.ok(/瞎猜|撤回|判断错|下结论太早/.test(joined), `应替换为认错短句：${joined}`);
});

test('normalizeReplyCandidate 把非法维度回落为 SINCERE', () => {
  const candidate = normalizeReplyCandidate({
    messages: ['随便写点'],
    style_dimension: 'PHILOSOPHER',
  });
  assert.equal(candidate.style_dimension, 'SINCERE');
});
