import assert from 'node:assert/strict';
import test from 'node:test';

import handler, {
  CHAT_ADVICE_SCHEMA,
  IMAGE_READING_RULES,
  MODELS,
  PRIMARY_IMAGE_DETAIL,
  PRIMARY_MAX_COMPLETION_TOKENS,
  REPLY_COACH_SYSTEM_PROMPT,
  REPLY_PERSPECTIVE_EXAMPLES,
  REPLY_REFINEMENT_SCHEMA,
  REFINEMENT_MAX_COMPLETION_TOKENS,
  buildStageChatGuide,
  buildFreeTierFallbackAdvice,
  buildReplyRefinementPrompt,
  buildStickerMatchIntent,
  extractFirstJsonObject,
  getRequestParts,
  hasActiveCuriosity,
  hasRecentEmotionalDisclosure,
  hasRepeatedColdReplies,
  inferConversationStage,
  logUsage,
  mergeRefinedReplies,
  needsReplyRefinement,
  normalizeDialogue,
  normalizeStickerSuggestions,
  parseAdvice,
  repairReplyCandidates,
  requestOpenAIAdvice,
  scoreStockSticker,
} from '../api/analyze.js';

const requestBody = {
  messages: [{
    role: 'user',
    content: [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/png',
          data: 'aGVsbG8=',
        },
      },
      { type: 'text', text: 'Analyze this screenshot.' },
    ],
  }],
};

test('uses the OpenAI vision model', () => {
  assert.deepEqual(MODELS, ['gpt-4.1-mini']);
});

test('defines a strict schema for richer attraction analysis', () => {
  assert.equal(CHAT_ADVICE_SCHEMA.additionalProperties, false);
  assert.ok(CHAT_ADVICE_SCHEMA.required.includes('interest_score'));
  assert.ok(CHAT_ADVICE_SCHEMA.required.includes('interest_signals'));
  assert.ok(CHAT_ADVICE_SCHEMA.required.includes('conversation_mode'));
  assert.ok(CHAT_ADVICE_SCHEMA.required.includes('conversation_stage'));
  assert.ok(CHAT_ADVICE_SCHEMA.required.includes('chat_guide'));
  assert.ok(CHAT_ADVICE_SCHEMA.required.includes('sticker_suggestions'));
  assert.ok(CHAT_ADVICE_SCHEMA.required.includes('flirt_level'));
  assert.equal(CHAT_ADVICE_SCHEMA.properties.chat_guide.additionalProperties, false);
  assert.equal(CHAT_ADVICE_SCHEMA.properties.replies.minItems, 3);
  assert.equal(CHAT_ADVICE_SCHEMA.properties.replies.maxItems, 5);
  assert.equal(CHAT_ADVICE_SCHEMA.properties.replies.items.additionalProperties, false);
  assert.equal(CHAT_ADVICE_SCHEMA.properties.sticker_suggestions.minItems, 3);
  assert.equal(CHAT_ADVICE_SCHEMA.properties.sticker_suggestions.maxItems, 3);
  assert.deepEqual(Object.keys(CHAT_ADVICE_SCHEMA.properties.replies.items.properties), ['text']);
  const stickerIntentSchema = CHAT_ADVICE_SCHEMA.properties.sticker_suggestions.items;
  assert.deepEqual(Object.keys(stickerIntentSchema.properties), ['text', 'emotion', 'scenario', 'relationship_stage', 'keywords']);
  assert.ok(stickerIntentSchema.required.includes('emotion'));
  assert.ok(stickerIntentSchema.required.includes('scenario'));
  assert.ok(stickerIntentSchema.required.includes('relationship_stage'));
  assert.ok(stickerIntentSchema.required.includes('keywords'));
  assert.equal('animated' in stickerIntentSchema.properties, false);
  assert.match(REPLY_COACH_SYSTEM_PROMPT, /主动回球/);
  assert.match(REPLY_COACH_SYSTEM_PROMPT, /暧昧必须有依据/);
  assert.match(REPLY_COACH_SYSTEM_PROMPT, /永远是用户准备发送给对方的话/);
  assert.match(REPLY_COACH_SYSTEM_PROMPT, /暧昧上限，不是必须完成的任务/);
  assert.match(REPLY_COACH_SYSTEM_PROMPT, /连续倾诉/);
  assert.match(REPLY_COACH_SYSTEM_PROMPT, /主动了解/);
  assert.match(REPLY_COACH_SYSTEM_PROMPT, /绝对不要替用户编造/);
  assert.match(REPLY_COACH_SYSTEM_PROMPT, /换行表示用户可以分成几条气泡/);
  assert.match(REPLY_COACH_SYSTEM_PROMPT, /库存检索意图/);
  assert.ok(stickerIntentSchema.properties.emotion.enum.includes('flirt'));
  assert.ok(stickerIntentSchema.properties.scenario.enum.includes('missing_you'));
  assert.ok(stickerIntentSchema.properties.scenario.enum.includes('speechless'));
  assert.match(IMAGE_READING_RULES, /左侧 = 对方，右侧 = 我/);
  assert.match(REPLY_PERSPECTIVE_EXAMPLES, /先夸我两句/);
});

test('parses willingness signals, flirt level, and clean untagged replies', () => {
  const advice = parseAdvice(JSON.stringify(adviceValue()));

  assert.equal(advice.attitude_label, '愿意回球');
  assert.equal(advice.interest_score, 76);
  assert.equal(advice.interest_level, '轻微好感');
  assert.equal(advice.conversation_mode, '轻松暧昧');
  assert.equal(advice.conversation_stage, '暧昧升温');
  assert.equal(advice.flirt_level, '轻微暧昧');
  assert.deepEqual(advice.interest_signals, ['主动回问', '接住共同梗']);
  assert.deepEqual(advice.replies[0], { text: '感受到了，嘴硬但还挺会关心人' });
  assert.equal(advice.sticker_match_intent.reply_intent, 'flirty_continue');
  assert.equal(advice.sticker_match_intent.emotion, 'shy');
  assert.ok(advice.sticker_match_intent.secondary_emotions.includes('love'));
  assert.ok(advice.sticker_match_intent.scenario.includes('flirting'));
  assert.ok(advice.sticker_match_intent.relationship_stage.includes('flirting'));
  assert.ok(advice.sticker_match_intent.keywords.includes('偷看'));
  assert.equal(advice.sticker_suggestions.length, 4);
  assert.equal(advice.sticker_suggestions[0].match.reply_intent, 'flirty_continue');
  assert.equal(advice.conversation_summary, '对方：你感受到我的了吗；我：好像遇到我你才对白由向往');
});

test('merges lightweight text-only reply refinements into the original advice', () => {
  const advice = parseAdvice(JSON.stringify(adviceValue()));
  const merged = mergeRefinedReplies(advice, JSON.stringify({
    replies: [{ text: '回复一' }, { text: '回复二' }, { text: '回复三' }],
  }));

  assert.deepEqual(merged.replies, [{ text: '回复一' }, { text: '回复二' }, { text: '回复三' }]);
  assert.equal(merged.attitude_label, advice.attitude_label);
});

test('preserves multi-bubble reply candidates with line breaks', () => {
  const advice = parseAdvice(JSON.stringify(adviceValue({
    replies: [
      { text: '其实也没想很多\n就是睡前想到你一下\n结果一下有点久' },
      { text: '你这句话有点犯规\n我本来想正常回的' },
      { text: '那我先认真听你说' },
    ],
  })));

  assert.equal(advice.replies[0].text, '其实也没想很多\n就是睡前想到你一下\n结果一下有点久');
  assert.equal(needsReplyRefinement(advice), false);
});

test('maps speaker identity from bubble side instead of model guesses', () => {
  assert.deepEqual(
    normalizeDialogue([
      { side: 'left', speaker: '我', text: '不忙' },
      { side: 'right', speaker: '对方', text: '你空闲喜欢做什么？' },
      { side: 'center', speaker: '对方', text: 'Yesterday 20:56' },
    ]),
    [
      { side: 'left', speaker: '对方', text: '不忙' },
      { side: 'right', speaker: '我', text: '你空闲喜欢做什么？' },
    ],
  );
});

test('accepts a single-column direct-message feed with explicit senders', () => {
  const advice = parseAdvice(JSON.stringify(adviceValue({
    dialogue: [
      { side: 'feed', speaker: '对方', text: '今晚还打球吗' },
      { side: 'feed', speaker: '我', text: '可以啊，还是老地方？' },
      { side: 'feed', speaker: '对方', text: '行，八点见' },
    ],
    conversation_summary: '',
  })));

  assert.equal(advice.is_chat_screenshot, true);
  assert.deepEqual(advice.dialogue.map((message) => message.speaker), ['对方', '我', '对方']);
});

test('drops a single-column message when its sender is not visible', () => {
  assert.deepEqual(
    normalizeDialogue([
      { side: 'feed', speaker: '无法判断', text: '这句话不能猜发送者' },
      { side: 'feed', speaker: '对方', text: '这句话有明确发送者' },
    ]),
    [{ side: 'feed', speaker: '对方', text: '这句话有明确发送者' }],
  );
});

test('returns a playful redirect for non-chat images without inventing replies', () => {
  const advice = parseAdvice(JSON.stringify(adviceValue({
    attitude_label: '不是聊天截图',
    attitude_desc: '这是一张风景照，没有聊天气泡。',
    is_chat_screenshot: false,
    non_chat_reply: '这张风景很适合发朋友圈，但我还没看到聊天记录。',
    chat_evidence: {
      image_kind: 'landscape',
      has_message_bubbles: false,
      has_chat_ui: false,
      has_two_sided_layout: false,
    },
    dialogue: [{ side: 'left', speaker: '对方', text: '被模型误认成聊天的文字' }],
    suggest_stop: true,
  })));

  assert.equal(advice.is_chat_screenshot, false);
  assert.equal(advice.non_chat_reply, '这张风景很适合发朋友圈，但我还没看到聊天记录。');
  assert.deepEqual(advice.dialogue, []);
  assert.deepEqual(advice.replies, []);
});

test('rejects document text even if the model formats it as dialogue', () => {
  const advice = parseAdvice(JSON.stringify(adviceValue({
    is_chat_screenshot: true,
    chat_evidence: {
      image_kind: 'homework document',
      has_message_bubbles: false,
      has_chat_ui: false,
      has_two_sided_layout: false,
    },
    dialogue: [
      { side: 'left', speaker: '对方', text: 'Image classification using MLP' },
      { side: 'right', speaker: '我', text: 'Write down the loss function' },
    ],
  })));

  assert.equal(advice.is_chat_screenshot, false);
  assert.deepEqual(advice.dialogue, []);
  assert.deepEqual(advice.replies, []);
});

test('keeps a real two-sided chat when the model contradicts visual evidence', () => {
  const advice = parseAdvice(JSON.stringify(adviceValue({
    is_chat_screenshot: false,
    chat_evidence: {
      image_kind: 'dark chat screenshot',
      has_message_bubbles: true,
      has_chat_ui: true,
      has_two_sided_layout: true,
    },
    dialogue: [
      { side: 'left', speaker: '对方', text: '不是' },
      { side: 'right', speaker: '我', text: '那你这个专业忙吗' },
      { side: 'left', speaker: '对方', text: '不忙' },
      { side: 'right', speaker: '我', text: '你空闲时间一般喜欢做什么呀' },
      { side: 'left', speaker: '对方', text: '玩手机' },
    ],
  })));

  assert.equal(advice.is_chat_screenshot, true);
  assert.equal(advice.dialogue.length, 5);
  assert.equal(advice.suggest_stop, true);
});

test('detects three consecutive short replies as a cold conversation', () => {
  assert.equal(
    hasRepeatedColdReplies(normalizeDialogue([
      { side: 'left', text: '不是' },
      { side: 'right', text: '那你这个专业忙吗' },
      { side: 'left', text: '不忙' },
      { side: 'right', text: '你空闲时间喜欢做什么呀' },
      { side: 'left', text: '玩手机' },
    ])),
    true,
  );
});

test('does not treat consecutive emotional disclosure as cold replies', () => {
  const dialogue = normalizeDialogue([
    { side: 'right', text: '先去睡觉吧' },
    { side: 'left', text: '我也不想 还没写完' },
    { side: 'left', text: '肚子疼头也疼' },
    { side: 'left', text: '不想上学' },
    { side: 'left', text: '[表情包]' },
  ]);

  assert.equal(hasRecentEmotionalDisclosure(dialogue), true);
  assert.equal(hasRepeatedColdReplies(dialogue), false);
});

test('does not over-classify one mild complaint as emotional disclosure', () => {
  const dialogue = normalizeDialogue([
    { side: 'left', text: '不想去' },
    { side: 'right', text: '那算了' },
    { side: 'left', text: '嗯' },
    { side: 'left', text: '不知道' },
  ]);

  assert.equal(hasRecentEmotionalDisclosure(dialogue), false);
});

test('normalizes emotional disclosure into supportive attitude and guidance', () => {
  const advice = parseAdvice(JSON.stringify(adviceValue({
    attitude_label: '冷淡',
    conversation_mode: '冷淡敷衍',
    flirt_level: '轻微暧昧',
    suggest_stop: true,
    dialogue: [
      { side: 'right', text: '先去睡觉吧' },
      { side: 'left', text: '我也不想 还没写完' },
      { side: 'left', text: '肚子疼头也疼' },
      { side: 'left', text: '不想上学' },
      { side: 'left', text: '[表情包]' },
    ],
    replies: [
      { text: '早点休息吧' },
      { text: '不要熬夜了' },
      { text: '有需要告诉我' },
    ],
  })));

  assert.equal(advice.suggest_stop, false);
  assert.equal(advice.attitude_label, '愿意倾诉');
  assert.equal(advice.conversation_mode, '情绪倾诉');
  assert.equal(advice.interest_level, '愿意倾诉');
  assert.equal(advice.interest_score, 45);
  assert.match(advice.attitude_desc, /不能直接换算成好感分数/);
  assert.equal(advice.flirt_level, '先别暧昧');
  assert.match(advice.chat_guide.current_move, /不舒服/);
});

test('allows an underfilled disclosure response to enter the repair pass', () => {
  const advice = parseAdvice(JSON.stringify(adviceValue({
    interest_score: 12,
    dialogue: [
      { side: 'right', text: '先去睡觉吧' },
      { side: 'left', text: '我也不想 还没写完' },
      { side: 'left', text: '肚子疼头也疼' },
    ],
    replies: [{ text: '早点休息吧' }],
  })));

  assert.equal(advice.interest_score, 12);
  assert.equal(needsReplyRefinement(advice), true);
  assert.equal(repairReplyCandidates(advice).replies.length, 4);
});

test('repairs lecturing support replies with natural short messages', () => {
  const advice = parseAdvice(JSON.stringify(adviceValue({
    dialogue: [
      { side: 'right', text: '先去睡觉吧' },
      { side: 'left', text: '我也不想 还没写完' },
      { side: 'left', text: '肚子疼头也疼' },
      { side: 'left', text: '不想上学' },
    ],
    replies: [
      { text: '早点休息吧' },
      { text: '不要熬夜了' },
      { text: '有需要告诉我' },
    ],
  })));
  const repaired = repairReplyCandidates(advice);

  assert.equal(needsReplyRefinement(advice), true);
  assert.deepEqual(repaired.replies[0], { text: '肚子和头一起疼也太难受了' });
  assert.equal(needsReplyRefinement(repaired), false);
});

test('repairs well-meant but robotic health reminder replies', () => {
  const advice = parseAdvice(JSON.stringify(adviceValue({
    dialogue: [
      { side: 'right', text: '先去睡觉吧' },
      { side: 'left', text: '我也不想 还没写完' },
      { side: 'left', text: '肚子疼头也疼' },
      { side: 'left', text: '不想上学' },
    ],
    replies: [
      { text: '别太勉强自己，身体重要，先照顾好自己吧' },
      { text: '先休息一下，写完再说也不迟' },
      { text: '你这样太辛苦了，先放松一下' },
    ],
  })));

  assert.equal(needsReplyRefinement(advice), true);
  assert.deepEqual(repairReplyCandidates(advice).replies[1], { text: '先躺一会儿缓缓，作业别硬撑了' });
});

test('recognizes consecutive personal questions as active curiosity', () => {
  const dialogue = normalizeDialogue([
    { side: 'left', text: '你是什么专业呀' },
    { side: 'right', text: '计算机' },
    { side: 'left', text: '学习压力大吗' },
    { side: 'right', text: '还行' },
    { side: 'left', text: '那你平时喜欢做什么' },
    { side: 'left', text: '有什么爱好吗' },
  ]);

  assert.equal(hasActiveCuriosity(dialogue), true);
});

test('upgrades active curiosity and repairs invented personal details', () => {
  const advice = parseAdvice(JSON.stringify(adviceValue({
    attitude_label: '礼貌回应',
    interest_score: 45,
    interest_level: '礼貌回应',
    conversation_mode: '礼貌回应',
    dialogue: [
      { side: 'left', text: '你是什么专业呀' },
      { side: 'right', text: '计算机' },
      { side: 'left', text: '学习压力大吗' },
      { side: 'right', text: '还行' },
      { side: 'left', text: '那你平时喜欢做什么' },
      { side: 'left', text: '有什么爱好吗' },
    ],
    replies: [
      { text: '我喜欢看电影和听音乐' },
      { text: '最近在学做饭，挺有趣的' },
      { text: '我平时喜欢运动' },
    ],
  })));
  const repaired = repairReplyCandidates(advice);

  assert.equal(advice.attitude_label, '主动了解');
  assert.equal(advice.conversation_mode, '主动了解');
  assert.equal(advice.interest_level, '愿意接话');
  assert.equal(advice.interest_score, 62);
  assert.match(advice.chat_guide.next_steps[2], /邀约/);
  assert.equal(needsReplyRefinement(advice), true);
  assert.deepEqual(repaired.replies[0], { text: '有，我平时比较喜欢___' });
});

test('flags robotic or perspective-reversed reply candidates for refinement', () => {
  const advice = parseAdvice(JSON.stringify(adviceValue({
    dialogue: [
      { side: 'right', speaker: '我', text: '等你先发现' },
      { side: 'left', speaker: '对方', text: '那你要我怎么哄' },
    ],
    replies: [
      { text: '哄你？先说说你想怎么被哄' },
      { text: '你觉得怎么才算哄到我？' },
      { text: '先夸我两句，我看看诚意' },
    ],
  })));

  assert.equal(needsReplyRefinement(advice), true);
  assert.match(buildReplyRefinementPrompt('Analyze.', advice), /不要出现“哄你？”/);
});

test('keeps a short, varied, correctly oriented reply set', () => {
  assert.equal(needsReplyRefinement(parseAdvice(JSON.stringify(adviceValue()))), false);
});

test('keeps a natural reply that is longer than the old 24-character cap', () => {
  const advice = parseAdvice(JSON.stringify(adviceValue({
    replies: [
      { text: '我刚刚确实有点想多了，不过你愿意认真解释，我还是挺开心的' },
      { text: '那我先收回刚刚那句，重新认识一下你' },
      { text: '好吧，这局算我判断太快了' },
    ],
  })));

  assert.equal(needsReplyRefinement(advice), false);
});

test('infers a stage before building the next conversation route', () => {
  assert.equal(inferConversationStage('暧昧升温'), '暧昧升温');
  assert.equal(inferConversationStage('轻松破冰', { activeCuriosity: true }), '稳定了解');
  assert.equal(inferConversationStage('暧昧升温', { suggestStop: true }), '建议停手');
  assert.match(buildStageChatGuide('稳定了解').current_move, /互相了解/);
});

test('builds stock sticker retrieval intent instead of legacy random templates', () => {
  const stopIntent = buildStickerMatchIntent({
    rawSuggestions: [
      { text: ' 行 你继续 ', emotion: 'awkward', scenario: 'speechless', relationship_stage: 'post_conflict', keywords: ['先撤'] },
    ],
    conversationStage: '建议停手',
    suggestStop: true,
  });
  assert.equal(stopIntent.emotion, 'awkward');
  assert.equal(stopIntent.reply_intent, 'deescalate_gracefully');
  assert.ok(stopIntent.secondary_emotions.includes('apology'));
  assert.ok(stopIntent.scenario.includes('safe_exit'));
  assert.ok(stopIntent.relationship_stage.includes('post_conflict'));
  assert.ok(stopIntent.keywords.includes('先撤'));
  const stopSuggestions = normalizeStickerSuggestions([{ text: ' 行 你继续 ', emotion: 'awkward', scenario: 'speechless', relationship_stage: 'post_conflict', keywords: ['先撤'] }], '建议停手', [], { suggest_stop: true });
  assert.equal(stopSuggestions.length, 4);
  assert.equal(stopSuggestions[0].match.reply_intent, 'deescalate_gracefully');

  const contextualIntent = buildStickerMatchIntent({
    rawSuggestions: [
      { text: ' 有点会聊 ', emotion: 'flirt', scenario: 'flirting', relationship_stage: 'flirting', keywords: ['偷看'] },
      { text: '真的假的', emotion: 'speechless', scenario: 'teasing', relationship_stage: 'talking_stage', keywords: ['真的假的'] },
    ],
    conversationStage: '暧昧升温',
  });
  assert.equal(contextualIntent.reply_intent, 'flirty_continue');
  assert.equal(contextualIntent.emotion, 'shy');
  assert.ok(contextualIntent.secondary_emotions.includes('awkward'));
  assert.ok(contextualIntent.scenario.includes('flirting'));
  assert.ok(contextualIntent.relationship_stage.includes('flirting'));
});

test('maps opponent message to reply intent before sticker emotion', () => {
  const intentFor = (text, options = {}) => buildStickerMatchIntent({
    conversationStage: options.stage || '暧昧升温',
    conversationMode: options.mode || '轻松暧昧',
    flirtLevel: options.flirtLevel || '轻微暧昧',
    dialogue: normalizeDialogue([{ side: 'left', text }]),
    ...options,
  });

  const flirtyConflict = intentFor('我讨厌你');
  assert.equal(flirtyConflict.reply_intent, 'soften_flirty_conflict');
  assert.equal(flirtyConflict.emotion, 'shy');
  assert.deepEqual(flirtyConflict.secondary_emotions.slice(0, 3), ['apology', 'comfort', 'love']);
  assert.equal(flirtyConflict.secondary_emotions.includes('angry'), false);

  const goodnight = intentFor('晚安');
  assert.equal(goodnight.reply_intent, 'say_goodnight_back');
  assert.equal(goodnight.emotion, 'goodnight');
  assert.ok(goodnight.secondary_emotions.includes('love'));

  const laugh = intentFor('哈哈哈');
  assert.equal(laugh.reply_intent, 'playful_continue');
  assert.equal(laugh.emotion, 'laugh');
  assert.ok(laugh.secondary_emotions.includes('awkward'));

  const thanks = intentFor('谢谢');
  assert.equal(thanks.reply_intent, 'accept_thanks');
  assert.equal(thanks.emotion, 'thanks');
  assert.ok(thanks.secondary_emotions.includes('shy'));

  const tired = intentFor('我好累', { emotionalDisclosure: true });
  assert.equal(tired.reply_intent, 'comfort_support');
  assert.equal(tired.emotion, 'comfort');
  assert.ok(tired.secondary_emotions.includes('encourage'));

  const missing = intentFor('想你了');
  assert.equal(missing.reply_intent, 'affectionate_reply');
  assert.equal(missing.emotion, 'miss_you');
  assert.ok(missing.secondary_emotions.includes('love'));
});

test('scores caring stock stickers higher for physical discomfort', () => {
  const dialogue = normalizeDialogue([
    { side: 'right', text: '先去睡觉吧' },
    { side: 'left', text: '肚子疼头也疼' },
    { side: 'left', text: '我也不想 还没写完' },
  ]);
  const intent = buildStickerMatchIntent({ conversationStage: '情绪陪伴', dialogue, emotionalDisclosure: true });
  const caringSticker = {
    id: 'hamster-comfort',
    file: '/assets/stickers/packs/style-bible-v1/images/hamster-comfort.png',
    emotion: 'comforting',
    scenario: 'comfort',
    relationship_stage: 'talking_stage',
    text: '抱抱你',
    tags: ['肚子疼', '难受', '抱抱', '加油'],
    quality_score: 0.9,
    usage_priority: 80,
  };
  const unrelatedSticker = {
    id: 'shiba-angry',
    file: '/assets/stickers/packs/style-bible-v1/images/shiba-angry.png',
    emotion: 'angry',
    scenario: 'angry_complaint',
    relationship_stage: 'post_conflict',
    text: '气死我了',
    tags: ['生气'],
    quality_score: 0.9,
    usage_priority: 80,
  };

  assert.equal(intent.context, 'physical_discomfort');
  assert.equal(intent.reply_intent, 'comfort_support');
  assert.equal(intent.emotion, 'comfort');
  assert.ok(intent.scenario.includes('comfort'));
  assert.ok(scoreStockSticker(caringSticker, intent) > scoreStockSticker(unrelatedSticker, intent));
  const supportSuggestions = normalizeStickerSuggestions([], '情绪陪伴', dialogue, { emotional_disclosure: true });
  assert.equal(supportSuggestions.length, 4);
  assert.equal(supportSuggestions[0].match.reply_intent, 'comfort_support');
});

test('maps study encouragement and happy chats to stock sticker intent', () => {
  const studyIntent = buildStickerMatchIntent({ conversationStage: '轻松破冰', dialogue: normalizeDialogue([
    { side: 'right', text: '明天考完就好了' },
    { side: 'left', text: '考试好难 我还没复习完' },
  ]) });
  const happyIntent = buildStickerMatchIntent({ conversationStage: '轻松破冰', dialogue: normalizeDialogue([
    { side: 'right', text: '你过啦' },
    { side: 'left', text: '好耶 我太开心了' },
  ]) });

  assert.equal(studyIntent.reply_intent, 'encourage_support');
  assert.equal(studyIntent.emotion, 'encourage');
  assert.ok(studyIntent.secondary_emotions.includes('comfort'));
  assert.ok(studyIntent.scenario.includes('studying'));
  assert.ok(studyIntent.scenario.includes('encouragement'));
  assert.equal(happyIntent.reply_intent, 'celebrate_together');
  assert.equal(happyIntent.emotion, 'happy');
  assert.ok(happyIntent.secondary_emotions.includes('laugh'));
  assert.ok(happyIntent.scenario.includes('celebration'));
});

test('flags flirt that evades a direct clarification question', () => {
  const advice = parseAdvice(JSON.stringify(adviceValue({
    dialogue: [
      { side: 'right', speaker: '我', text: '看得出来' },
      { side: 'left', speaker: '对方', text: '你不是说我很难懂吗，那你怎么就确定了呢' },
    ],
    replies: [
      { text: '那就让我多观察观察你这个难懂的秘密吧' },
      { text: '看来你还挺会吊人胃口的嘛' },
      { text: '那你说说，我哪里猜错了？' },
    ],
  })));

  assert.equal(needsReplyRefinement(advice), true);
  assert.match(buildReplyRefinementPrompt('Analyze.', advice), /至少两条直接回应问题/);
});

test('keeps up to five clean reply candidates', () => {
  const advice = parseAdvice(JSON.stringify(adviceValue({
    replies: [
      { text: '回复一' },
      { text: '回复二' },
      { text: '回复三' },
      { text: '回复四' },
      { text: '回复五' },
      { text: '回复六' },
    ],
  })));

  assert.deepEqual(advice.replies.map((reply) => reply.text), ['回复一', '回复二', '回复三', '回复四', '回复五']);
});

test('flags essay-like explanatory replies for a more natural rewrite', () => {
  const advice = parseAdvice(JSON.stringify(adviceValue({
    replies: [
      { text: '因为我刚刚把你前面说的几句话都想得太复杂了，所以一不小心自己脑补了很多，其实我也没有那么确定，确实有点想多了。' },
      { text: '我瞎猜的，那我撤回' },
      { text: '那我判断错了，你还是愿意理我的' },
    ],
  })));

  assert.equal(needsReplyRefinement(advice), true);
  assert.match(buildReplyRefinementPrompt('Analyze.', advice), /不要编造截图里没有出现的/);
});

test('flags invented cold evidence that is not visible in the screenshot', () => {
  const advice = parseAdvice(JSON.stringify(adviceValue({
    replies: [
      { text: '因为你平时回复都不那么积极' },
      { text: '直觉告诉我你有点疏远我' },
      { text: '我瞎猜的，那我撤回' },
    ],
  })));

  assert.equal(needsReplyRefinement(advice), true);
});

test('repairs stubborn clarification replies with sendable short messages', () => {
  const advice = parseAdvice(JSON.stringify(adviceValue({
    dialogue: [
      { side: 'right', speaker: '我', text: '我猜的' },
      { side: 'left', speaker: '对方', text: '那你怎么就确定了呢' },
    ],
    replies: [
      { text: '可能是因为你之前回复比较慢，我就觉得你可能不太想理我。' },
      { text: '我只是根据之前的感觉猜的，没有特别确定的理由。' },
      { text: '说实话我也不是很确定，就是凭感觉觉得你可能不想理我。' },
    ],
  })));
  const repaired = repairReplyCandidates(advice);

  assert.equal(needsReplyRefinement(repaired), false);
  assert.deepEqual(repaired.replies[0], { text: '我瞎猜的，那我撤回' });
  assert.equal(repaired.replies.length, 4);
});

test('parses the first complete JSON object when OpenAI repeats a response', () => {
  const first = adviceValue({ is_chat_screenshot: false, dialogue: [], replies: [] });
  const second = adviceValue({ non_chat_reply: '第二个对象不应影响解析。' });

  assert.equal(
    extractFirstJsonObject(`${JSON.stringify(first)}\n${JSON.stringify(second)}`),
    JSON.stringify(first),
  );
});

test('validates uploaded screenshot format', () => {
  assert.equal(getRequestParts(requestBody).imageParts[0].source.media_type, 'image/png');
  assert.throws(() => getRequestParts({ messages: [{ content: [] }] }), /1 到 6 张/);
});

test('passes multiple screenshots to OpenAI with strict JSON schema', async () => {
  const originalFetch = global.fetch;
  let requestPayload;
  global.fetch = async (_url, options) => {
    requestPayload = JSON.parse(options.body);
    return jsonResponse(200, openAIAdviceResponse());
  };

  try {
    await requestOpenAIAdvice({
      apiKey: 'test-key',
      model: 'gpt-4.1-mini',
      imageParts: [
        requestBody.messages[0].content[0],
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'd29ybGQ=' } },
      ],
      prompt: 'Analyze screenshots.',
    });

    assert.equal(requestPayload.model, 'gpt-4.1-mini');
    assert.equal(requestPayload.messages[0].role, 'system');
    assert.equal(requestPayload.messages[1].role, 'user');
    assert.equal(requestPayload.messages[1].content[1].type, 'image_url');
    assert.match(requestPayload.messages[1].content[1].image_url.url, /^data:image\/png;base64,/);
    assert.equal(requestPayload.messages[1].content[1].image_url.detail, PRIMARY_IMAGE_DETAIL);
    assert.equal(requestPayload.max_completion_tokens, PRIMARY_MAX_COMPLETION_TOKENS);
    assert.equal('max_tokens' in requestPayload, false);
    assert.equal(requestPayload.response_format.type, 'json_schema');
    assert.equal(requestPayload.response_format.json_schema.strict, true);
    assert.deepEqual(requestPayload.response_format.json_schema.schema, CHAT_ADVICE_SCHEMA);
  } finally {
    global.fetch = originalFetch;
  }
});

test('returns an honest retry result if OpenAI is unavailable', async () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-key';
  global.fetch = async () => jsonResponse(429, { error: { code: 'rate_limit_exceeded', message: 'Rate limit exceeded' } });

  try {
    const response = createResponseRecorder();
    await handler({ method: 'POST', body: requestBody, headers: {} }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.degraded, true);
    assert.deepEqual(JSON.parse(response.body.content[0].text), buildFreeTierFallbackAdvice());
  } finally {
    global.fetch = originalFetch;
    restoreEnvironment('OPENAI_API_KEY', originalApiKey);
  }
});

test('asks OpenAI for one refinement pass when initial replies feel robotic', async () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-key';
  const requests = [];
  global.fetch = async (_url, options) => {
    requests.push(JSON.parse(options.body));
    if (requests.length === 1) {
      return jsonResponse(200, openAIAdviceResponse(adviceValue({
        dialogue: [
          { side: 'right', speaker: '我', text: '等你先发现' },
          { side: 'left', speaker: '对方', text: '那你要我怎么哄' },
        ],
        replies: [
          { text: '哄你？你觉得怎样才算哄好？' },
          { text: '那你平时喜欢怎么被哄？' },
          { text: '听起来你挺会哄人' },
        ],
      })));
    }
    return jsonResponse(200, openAIAdviceResponse());
  };

  try {
    const response = createResponseRecorder();
    await handler({ method: 'POST', body: requestBody, headers: {} }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(requests.length, 2);
    assert.match(requests[1].messages[1].content.at(-1).text, /上一轮候选需要重写/);
    assert.equal(requests[1].messages[1].content.some((part) => part.type === 'image_url'), false);
    assert.equal(requests[1].max_completion_tokens, REFINEMENT_MAX_COMPLETION_TOKENS);
    assert.deepEqual(requests[1].response_format.json_schema.schema, REPLY_REFINEMENT_SCHEMA);
  } finally {
    global.fetch = originalFetch;
    restoreEnvironment('OPENAI_API_KEY', originalApiKey);
  }
});

test('uses a safe short fallback when OpenAI refinement stays too long', async () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-key';
  const stubbornAdvice = adviceValue({
    dialogue: [
      { side: 'right', speaker: '我', text: '我猜的' },
      { side: 'left', speaker: '对方', text: '那你怎么就确定了呢' },
    ],
    replies: [
      { text: '可能是因为你之前回复比较慢，我就觉得你可能不太想理我。' },
      { text: '我只是根据之前的感觉猜的，没有特别确定的理由。' },
      { text: '说实话我也不是很确定，就是凭感觉觉得你可能不想理我。' },
    ],
  });
  global.fetch = async () => jsonResponse(200, openAIAdviceResponse(stubbornAdvice));

  try {
    const response = createResponseRecorder();
    await handler({ method: 'POST', body: requestBody, headers: {} }, response);
    const advice = JSON.parse(response.body.content[0].text);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(advice.replies[0], { text: '我瞎猜的，那我撤回' });
    assert.equal(needsReplyRefinement(advice), false);
  } finally {
    global.fetch = originalFetch;
    restoreEnvironment('OPENAI_API_KEY', originalApiKey);
  }
});

test('retains uploaded screenshots in Supabase usage logging', async () => {
  const originalFetch = global.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_KEY;
  const requests = [];
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_KEY = 'service-key';
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    return jsonResponse(200, {});
  };

  try {
    await logUsage({
      req: { headers: { 'x-forwarded-for': '127.0.0.1', 'user-agent': 'test' } },
      advice: parseAdvice(JSON.stringify(adviceValue())),
      imageParts: [requestBody.messages[0].content[0]],
    });

    assert.match(requests[0].url, /storage\/v1\/object\/screenshots\//);
    assert.match(requests[1].url, /rest\/v1\/usage_logs/);
    assert.deepEqual(JSON.parse(requests[1].options.body).image_urls.length, 1);
  } finally {
    global.fetch = originalFetch;
    restoreEnvironment('SUPABASE_URL', originalUrl);
    restoreEnvironment('SUPABASE_SERVICE_KEY', originalKey);
  }
});

function adviceValue(overrides = {}) {
  return {
    attitude_label: '愿意回球',
    attitude_desc: '对方会主动回问，也会顺着共同梗继续聊，可以轻松升一点温。',
    interest_score: 76,
    interest_level: '轻微好感',
    interest_signals: ['主动回问', '接住共同梗'],
    conversation_mode: '轻松暧昧',
    conversation_stage: '暧昧升温',
    reply_strategy: '顺着她的玩笑轻轻接住，留一个容易回复的小钩子。',
    flirt_level: '轻微暧昧',
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
      current_move: '先顺着她的玩笑接一句。',
      next_steps: ['等她回应后，再沿着共同梗聊下去。', '她继续主动时，再轻轻升温。'],
      avoid: '不要连续追问。',
    },
    dialogue: [
      { side: 'left', speaker: '对方', text: '你感受到我的了吗' },
      { side: 'right', speaker: '我', text: '好像遇到我你才对白由向往' },
    ],
    suggest_stop: false,
    needs_retry: false,
    replies: [
      { text: '感受到了，嘴硬但还挺会关心人' },
      { text: '刚感受到一点，再演两集看看' },
      { text: '有一点，但我还在观察' },
    ],
    sticker_suggestions: [
      { text: '有点会聊', emotion: 'flirt', scenario: 'flirting', relationship_stage: 'flirting', keywords: ['偷看', '嘴硬'] },
      { text: '我再观察', emotion: 'speechless', scenario: 'teasing', relationship_stage: 'talking_stage', keywords: ['观察', '真的假的'] },
      { text: '行吧 加一分', emotion: 'happy', scenario: 'teasing', relationship_stage: 'flirting', keywords: ['开心', '加一分'] },
    ],
    ...overrides,
  };
}

function openAIAdviceResponse(advice = adviceValue()) {
  return {
    choices: [{ message: { content: JSON.stringify(advice) } }],
  };
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function createResponseRecorder() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function restoreEnvironment(name, value) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
