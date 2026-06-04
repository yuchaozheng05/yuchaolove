import assert from 'node:assert/strict';
import test from 'node:test';

import {
  detectScene,
  extractConcreteFacts,
  getReplyGroundingReport,
  needsReplyRefinement,
  normalizeDialogue,
  parseAdvice,
  repairReplyCandidates,
} from '../api/analyze.js';

const GENERIC_REPLIES = [
  { text: '我先认真听你说' },
  { text: '你继续说' },
  { text: '这句我接住了\n我在' },
];

const GENERIC_FORBIDDEN_PATTERN = /我先认真听你说|你继续说|这句我接住了|^我在$|有哪里不舒服吗|多喝热水|注意身体/;

function buildAdviceValue(dialogueTexts, replies = GENERIC_REPLIES) {
  return {
    attitude_label: '愿意回球',
    attitude_desc: '对方愿意继续表达，需要围绕截图事实回复。',
    interest_score: 55,
    interest_level: '愿意接话',
    interest_signals: ['主动补充信息'],
    conversation_mode: '情绪倾诉',
    conversation_stage: '情绪陪伴',
    reply_strategy: '围绕对方刚刚说的具体事实回复。',
    flirt_level: '先别暧昧',
    is_chat_screenshot: true,
    non_chat_reply: '',
    chat_evidence: {
      image_kind: 'chat',
      has_message_bubbles: true,
      has_chat_ui: true,
      has_two_sided_layout: true,
    },
    conversation_summary: '',
    chat_guide: {
      current_move: '',
      next_steps: [],
      avoid: '',
    },
    dialogue: dialogueTexts.map((text) => ({ side: 'left', speaker: '对方', text })),
    suggest_stop: false,
    needs_retry: false,
    replies,
    sticker_suggestions: [],
  };
}

function runGroundedCase(dialogueTexts) {
  const advice = parseAdvice(JSON.stringify(buildAdviceValue(dialogueTexts)));
  return needsReplyRefinement(advice) ? repairReplyCandidates(advice) : advice;
}

function flattenReplies(advice) {
  return advice.replies.map((reply) => reply.messages?.join('\n') || reply.text).join('\n');
}

function flattenStickers(advice) {
  return (advice.sticker_suggestions || [])
    .map((sticker) => [
      sticker.id,
      sticker.text,
      sticker.emotion?.primary,
      ...(sticker.scenario || []),
      ...(sticker.tags || []),
    ].join(' '))
    .join(' ');
}

const CASES = [
  {
    name: 'Case 1 body discomfort',
    input: ['我头好痛', '今天一天都很难受', '可能感冒了'],
    scene: /身体不舒服/,
    must: /头痛|难受|量体温|感冒|喝点水|躺/,
    next: /半小时|量体温|吃药|好一点/,
    stickers: /抱抱|摸头|盖被子|我在呢|喝水|热饮|comfort/,
    forbidden: /你继续说|我先认真听/,
  },
  {
    name: 'Case 2 exam pressure',
    input: ['midterm快到了', '我什么都不会', '第一题做不出来'],
    scene: /学习压力/,
    must: /midterm|第一题|做不出来|卡住|换一题|别硬撑/,
    next: /第一题|换一题|卡在哪/,
    stickers: /加油|别硬撑|摸头|你超棒|陪|encourage|comfort/,
  },
  {
    name: 'Case 3 work stress',
    input: ['老板今天一直骂我', '我真的不想干了'],
    scene: /工作压力/,
    must: /老板|骂|不想干|先缓一下/,
    next: /老板|工作|骂|冷静/,
    stickers: /抱抱|辛苦啦|别硬撑|comfort|压力大/,
    forbidden: /多喝热水/,
  },
  {
    name: 'Case 4 overtime',
    input: ['还在公司', '今天估计又得十二点'],
    scene: /加班/,
    must: /还在公司|十二点|吃点东西|别熬|公司/,
    next: /到家|补觉|吃饭/,
    stickers: /辛苦啦|别硬撑|抱抱|comfort/,
  },
  {
    name: 'Case 5 insomnia',
    input: ['已经三点了', '还是睡不着'],
    scene: /失眠/,
    must: /三点|睡不着|别继续刷手机|闭眼休息/,
    next: /睡着|深夜|昨晚/,
    stickers: /晚安|盖被子|抱抱|goodnight|comfort/,
  },
  {
    name: 'Case 6 low mood',
    input: ['最近什么都不想做'],
    scene: /情绪低落/,
    must: /什么都不想做|发生什么|不用逼自己|很小的事/,
    next: /发生|很小/,
    stickers: /抱抱|我在呢|摸头|comfort/,
  },
  {
    name: 'Case 7 family conflict',
    input: ['我跟我妈又吵架了'],
    scene: /家庭冲突/,
    must: /你妈|吵架|发生什么|不乱站队|慢慢讲/,
    next: /吵架|沟通/,
    stickers: /抱抱|我在呢|摸头|comfort/,
  },
  {
    name: 'Case 8 breakup rejection',
    input: ['她把我删了'],
    scene: /失恋|被删/,
    must: /删了|难受|别急着|复合晚点|情绪稳住/,
    next: /过程|联系|冲动/,
    stickers: /抱抱|不哭|我在呢|comfort|cry/,
  },
  {
    name: 'Case 9 resale explanation',
    input: [
      '我准备直接去回收了',
      '省时省心',
      '去哪儿回收啊？',
      '爱回收，就平时收手机那个，包也收',
      '主要是它那个竞价模式我挺喜欢',
      '我只需要把包挂上去，就会有一堆二手商同时出价',
      '谁高我卖谁，不用我一家家跑去比',
    ],
    scene: /二手回收解释/,
    must: /爱回收|包|二手商|出价|谁价高|省得|一家家跑/,
    next: /报价|验货|平台/,
    stickers: /收到|想想|啊这|thinking|happy|awkward/,
  },
  {
    name: 'Case 10 car decision',
    input: ['RX350h和RX500h纠结', '感觉差价有点大'],
    scene: /买车决策/,
    must: /RX350h|RX500h|差价|预算|需求/,
    next: /动力|预算|用车/,
    stickers: /想想|收到|啊这|thinking|awkward|happy/,
    forbidden: /抱抱|摸摸头/,
  },
  {
    name: 'Case 11 moving stress',
    input: ['东西太多了', '搬家快累死了'],
    scene: /搬家压力/,
    must: /搬家|东西太多|累|帮你|最重/,
    next: /几箱|叫车|搬重物/,
    stickers: /加油|别硬撑|抱抱|comfort|encourage/,
  },
  {
    name: 'Case 12 travel planning',
    input: ['下周去日本', '还没做攻略'],
    scene: /旅行规划/,
    must: /日本|攻略|行程|美食|东京|大阪/,
    next: /东京|大阪|每天/,
    stickers: /开心|收到|加油|happy|encourage/,
    forbidden: /身体|头痛|喝点水/,
  },
  {
    name: 'Case 13 anger',
    input: ['我真的气死了'],
    scene: /生气/,
    must: /气死|发生什么|谁惹你|慢慢骂/,
    next: /惹|讲完|怎么回/,
    stickers: /哄|抱抱|别气|comfort|angry/,
  },
  {
    name: 'Case 14 celebration',
    input: ['我今天拿A了'],
    scene: /成绩庆祝/,
    must: /拿 A|拿A|厉害|恭喜|成绩|开心/,
    next: /庆祝|努力/,
    stickers: /开心|你超棒|加油|happy|encourage/,
  },
  {
    name: 'Case 15 daily food',
    input: ['刚吃完火锅', '撑死了'],
    scene: /日常美食/,
    must: /火锅|撑|好不好吃|锅底|快乐过载/,
    next: /锅底|一起吃/,
    stickers: /开心|吃饭|哈哈|happy|eat/,
    forbidden: /生病|头痛|感冒/,
  },
  {
    name: 'Case 16 cold replies',
    input: ['嗯', '哦', '哈哈'],
    scene: /冷淡回复/,
    must: /嗯哦哈哈|不继续追问|接话兴致不高|放轻/,
    next: /暂停|晚点|轻松/,
    stickers: /收到|啊这|尴尬|awkward/,
  },
  {
    name: 'Case 17 compliment photo',
    input: ['今天新买的裙子', '好看吗'],
    scene: /夸照片/,
    must: /裙子|好看|颜色|适合你|多看两眼/,
    next: /搭|颜色|气质/,
    stickers: /开心|害羞|夸|happy|shy/,
  },
  {
    name: 'Case 18 clingy attention',
    input: ['没人陪我'],
    scene: /撒娇求陪/,
    must: /没人陪|陪你|陪我|申请上岗|立刻出现/,
    next: /陪她|陪你|做什么/,
    stickers: /抱抱|我在呢|陪|comfort/,
  },
  {
    name: 'Case 19 jealousy',
    input: ['你最近跟她聊挺多'],
    scene: /吃醋/,
    must: /跟她聊|解释|安全感|分寸|不舒服/,
    next: /追问|说明|不安/,
    stickers: /抱抱|哄|我在呢|comfort|jealous/,
  },
  {
    name: 'Case 20 confession hint',
    input: ['我有点喜欢一个人'],
    scene: /表白试探/,
    must: /喜欢一个人|那个人|知道吗|猜是谁|心动/,
    next: /喜欢|猜|哪一点/,
    stickers: /害羞|喜欢|偷看|shy|love/,
  },
];

test('reply grounding checker extracts concrete facts from screenshot text', () => {
  const dialogue = normalizeDialogue([
    { side: 'left', text: '爱回收，就平时收手机那个，包也收' },
    { side: 'left', text: '竞价模式我挺喜欢，谁高我卖谁' },
  ]);
  const facts = extractConcreteFacts(dialogue);

  assert.ok(facts.some((fact) => fact.id === 'resale'));
  assert.match(facts.map((fact) => fact.terms.join(' ')).join(' '), /爱回收/);
  assert.match(facts.map((fact) => fact.terms.join(' ')).join(' '), /谁高/);
});

test('20 core reply grounding regression cases stay tied to screenshot facts', () => {
  const seenReplyBodies = new Set();

  for (const fixture of CASES) {
    const advice = runGroundedCase(fixture.input);
    const replyText = flattenReplies(advice);
    const stickerText = flattenStickers(advice);
    const nextTopicText = (advice.next_topics || []).join('\n');
    const grounding = getReplyGroundingReport(advice);

    assert.match(advice.analysis.scene, fixture.scene, `${fixture.name}: scene`);
    assert.match(replyText, fixture.must, `${fixture.name}: replies should mention concrete facts/actions`);
    assert.match(nextTopicText, fixture.next, `${fixture.name}: next topics should stay contextual`);
    assert.doesNotMatch(replyText, GENERIC_FORBIDDEN_PATTERN, `${fixture.name}: generic template leaked`);
    if (fixture.forbidden) assert.doesNotMatch(replyText, fixture.forbidden, `${fixture.name}: forbidden reply content`);
    assert.equal(grounding.needs_repair, false, `${fixture.name}: repaired output should pass grounding`);
    assert.equal(grounding.ungrounded_count, 0, `${fixture.name}: every reply should hit a concrete fact or synonym`);
    assert.equal(advice.sticker_suggestions.length, 6, `${fixture.name}: should return 6 stickers`);
    assert.match(stickerText, fixture.stickers, `${fixture.name}: sticker tags/text should match scene`);
    assert.equal(seenReplyBodies.has(replyText), false, `${fixture.name}: replies should not duplicate another scene`);
    seenReplyBodies.add(replyText);
  }
});
