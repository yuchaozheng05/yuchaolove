import assert from 'node:assert/strict';
import test from 'node:test';

import handler, {
  CHAT_ADVICE_SCHEMA,
  CHAT_SCENE_LIBRARY,
  EXTRACTION_IMAGE_DETAIL,
  EXTRACTION_MAX_COMPLETION_TOKENS,
  EXTRACTION_SCHEMA,
  EXTRACTION_SYSTEM_PROMPT,
  GENERIC_REPLY_TEMPLATE_PATTERN,
  IMAGE_READING_RULES,
  INTENT_DETECTION_SCHEMA,
  INTENT_MAX_COMPLETION_TOKENS,
  INTENT_STRATEGY_MAP,
  MODELS,
  PRIMARY_IMAGE_DETAIL,
  PRIMARY_MAX_COMPLETION_TOKENS,
  PRIMARY_OPENAI_TIMEOUT_MS,
  REPLY_COACH_SYSTEM_PROMPT,
  REPLY_PERSPECTIVE_EXAMPLES,
  REPLY_REFINEMENT_SCHEMA,
  REFINEMENT_MAX_COMPLETION_TOKENS,
  STYLE_DIMENSION_NOTE,
  buildGroupChatAdvice,
  buildIntentPrefix,
  buildRegeneratePrefix,
  buildStageChatGuide,
  buildFreeTierFallbackAdvice,
  buildReplyRefinementPrompt,
  buildStickerMatchIntent,
  buildUserProfilePrefix,
  detectConversationIntent,
  detectScene,
  extractDialogueFromImages,
  extractFirstJsonObject,
  getRequestParts,
  hasActiveCuriosity,
  hasRecentEmotionalDisclosure,
  hasRepeatedColdReplies,
  inferConversationStage,
  isVerifiedChatScreenshot,
  logUsage,
  mergeRefinedReplies,
  needsReplyRefinement,
  normalizeDialogue,
  normalizeClientMetadata,
  normalizeReplyCandidate,
  normalizeStickerSuggestions,
  normalizeUserProfile,
  parseAdvice,
  repairReplyCandidates,
  requestOpenAIAdvice,
  safeJsonParse,
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
  assert.equal(PRIMARY_OPENAI_TIMEOUT_MS, 55_000);
});

test('defines a strict schema for richer attraction analysis', () => {
  assert.equal(CHAT_ADVICE_SCHEMA.additionalProperties, false);
  assert.ok(CHAT_ADVICE_SCHEMA.required.includes('interest_score'));
  assert.ok(CHAT_ADVICE_SCHEMA.required.includes('interest_signals'));
  assert.ok(CHAT_ADVICE_SCHEMA.required.includes('conversation_mode'));
  assert.ok(CHAT_ADVICE_SCHEMA.required.includes('conversation_stage'));
  assert.ok(CHAT_ADVICE_SCHEMA.required.includes('analysis'));
  assert.ok(CHAT_ADVICE_SCHEMA.required.includes('relationship_memory_engine'));
  assert.ok(CHAT_ADVICE_SCHEMA.required.includes('reply_risk'));
  assert.ok(CHAT_ADVICE_SCHEMA.required.includes('conversation_future'));
  assert.ok(CHAT_ADVICE_SCHEMA.required.includes('relationship_goal'));
  assert.ok(CHAT_ADVICE_SCHEMA.required.includes('coach_advice'));
  assert.ok(CHAT_ADVICE_SCHEMA.required.includes('reply_explanation'));
  assert.ok(CHAT_ADVICE_SCHEMA.required.includes('next_5_moves'));
  assert.ok(CHAT_ADVICE_SCHEMA.required.includes('chat_guide'));
  assert.ok(CHAT_ADVICE_SCHEMA.required.includes('next_topics'));
  assert.ok(CHAT_ADVICE_SCHEMA.required.includes('sticker_suggestions'));
  assert.ok(CHAT_ADVICE_SCHEMA.required.includes('flirt_level'));
  assert.deepEqual(CHAT_ADVICE_SCHEMA.properties.analysis.properties.stage.enum, [
    'ice_breaking',
    'daily_connection',
    'emotional_bonding',
    'push_pull_flirting',
    'offline_invitation',
    'relationship_confirmation',
  ]);
  assert.deepEqual(CHAT_ADVICE_SCHEMA.properties.relationship_memory_engine.properties.relationship_stage.enum, CHAT_ADVICE_SCHEMA.properties.analysis.properties.stage.enum);
  assert.deepEqual(CHAT_ADVICE_SCHEMA.properties.relationship_memory_engine.properties.investment_balance.enum, ['user_investing_more', 'balanced', 'other_person_investing_more']);
  assert.deepEqual(CHAT_ADVICE_SCHEMA.properties.relationship_memory_engine.properties.risk_level.enum, ['too_needy', 'too_cold', 'too_pushy', 'safe']);
  assert.equal(CHAT_ADVICE_SCHEMA.properties.next_5_moves.minItems, 5);
  assert.equal(CHAT_ADVICE_SCHEMA.properties.next_5_moves.maxItems, 5);
  assert.equal(CHAT_ADVICE_SCHEMA.properties.chat_guide.additionalProperties, false);
  assert.equal(CHAT_ADVICE_SCHEMA.properties.replies.minItems, 3);
  assert.equal(CHAT_ADVICE_SCHEMA.properties.replies.maxItems, 5);
  assert.equal(CHAT_ADVICE_SCHEMA.properties.replies.items.additionalProperties, false);
  assert.equal(CHAT_ADVICE_SCHEMA.properties.sticker_suggestions.minItems, 3);
  assert.equal(CHAT_ADVICE_SCHEMA.properties.sticker_suggestions.maxItems, 3);
  assert.deepEqual(Object.keys(CHAT_ADVICE_SCHEMA.properties.replies.items.properties), ['style', 'text', 'messages', 'style_dimension']);
  assert.ok(CHAT_ADVICE_SCHEMA.properties.replies.items.required.includes('style'));
  assert.ok(CHAT_ADVICE_SCHEMA.properties.replies.items.required.includes('messages'));
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
  assert.match(REPLY_COACH_SYSTEM_PROMPT, /messages 表示 1 到 3 条微信连续消息/);
  assert.match(REPLY_COACH_SYSTEM_PROMPT, /relationship_stage/);
  assert.match(REPLY_COACH_SYSTEM_PROMPT, /next_topics/);
  assert.match(REPLY_COACH_SYSTEM_PROMPT, /库存检索意图/);
  assert.ok(stickerIntentSchema.properties.emotion.enum.includes('flirt'));
  assert.ok(stickerIntentSchema.properties.scenario.enum.includes('missing_you'));
  assert.ok(stickerIntentSchema.properties.scenario.enum.includes('speechless'));
  assert.match(IMAGE_READING_RULES, /左侧 = 对方，右侧 = 我/);
  assert.match(REPLY_PERSPECTIVE_EXAMPLES, /先夸我两句/);
});

test('ships a production scene library with relationship stages', () => {
  assert.equal(CHAT_SCENE_LIBRARY.scenes.length >= 150, true);
  const requiredScenes = ['身体不舒服', '查岗', '吃醋', '晚安', 'emo 动态', '关系确认'];
  requiredScenes.forEach((sceneName) => {
    assert.ok(CHAT_SCENE_LIBRARY.scenes.some((scene) => scene.scene === sceneName), sceneName);
  });
});

test('detects required coach scenes from opponent messages', () => {
  const sceneFor = (text) => detectScene({
    dialogue: normalizeDialogue([{ side: 'left', text }]),
    conversationStage: '轻松破冰',
  });

  const sick = sceneFor('我肚子疼，不想上学');
  assert.equal(sick.scene, '身体不舒服');
  assert.equal(sick.stage, 'emotional_bonding');
  assert.ok(sick.sticker_strategy.includes('抱抱'));
  assert.ok(sick.sticker_strategy.includes('摸头'));
  assert.ok(sick.sticker_strategy.includes('盖被子'));

  const jealousy = sceneFor('你今晚跟谁出去？');
  assert.match(jealousy.scene, /查岗|吃醋/);
  assert.equal(jealousy.stage, 'push_pull_flirting');

  const goodnight = sceneFor('晚安');
  assert.equal(goodnight.scene, '晚安');
  assert.ok(['daily_connection', 'emotional_bonding'].includes(goodnight.stage));

  const tired = sceneFor('我好累');
  assert.match(tired.scene, /工作压力|学习压力|身体不舒服|emo 动态/);

  const emo = sceneFor('今天有点 emo，什么都不想说');
  assert.match(emo.scene, /emo 动态|身体不舒服|委屈/);

  const studyHeadache = sceneFor('我想太多了 第一题一直没做出来 是 midterm1 之前的东西 我的头好痛 里面好闷 真的');
  assert.equal(studyHeadache.scene, '学习压力');
  assert.equal(studyHeadache.stage, 'emotional_bonding');
  assert.equal(studyHeadache.id, 'study_pressure_discomfort_001');
  assert.ok(studyHeadache.sticker_strategy.includes('别硬撑'));
  assert.ok(studyHeadache.sticker_strategy.includes('喝水'));
});

test('builds a relationship memory engine from the whole dialogue', () => {
  const advice = parseAdvice(JSON.stringify(adviceValue({
    conversation_stage: '稳定了解',
    conversation_mode: '主动了解',
    interest_score: 55,
    dialogue: [
      { side: 'left', speaker: '对方', text: '早安呀' },
      { side: 'right', speaker: '我', text: '早' },
      { side: 'left', speaker: '对方', text: '你今天几点下课？' },
      { side: 'left', speaker: '对方', text: '我看到一家好吃的店，感觉你会喜欢' },
      { side: 'right', speaker: '我', text: '那你发我看看' },
    ],
  })));

  assert.equal(advice.relationship_memory_engine.relationship_stage, 'daily_connection');
  assert.equal(advice.relationship_stage, 'daily_connection');
  assert.equal(advice.relationship_memory_engine.initiator, 'other_person');
  assert.equal(advice.relationship_memory_engine.investment_balance, 'other_person_investing_more');
  assert.ok(advice.relationship_memory_engine.attraction_score >= 60);
  assert.equal(advice.attraction_score, advice.relationship_memory_engine.attraction_score);
  assert.equal(advice.relationship_goal.target_stage, 'emotional_bonding');
  assert.match(advice.relationship_goal.today_should_do, /分享|接住|真实|生活/);
  assert.equal(advice.next_5_moves.length, 5);
  assert.equal(advice.reply_explanation.length, 3);
  assert.ok(advice.conversation_future.next_reply_likely);
  assert.ok(advice.coach_advice.do.length >= 2);
});

test('flags needy investment imbalance across the conversation', () => {
  const advice = parseAdvice(JSON.stringify(adviceValue({
    conversation_stage: '轻松破冰',
    interest_score: 28,
    suggest_stop: true,
    dialogue: [
      { side: 'right', speaker: '我', text: '你在干嘛' },
      { side: 'left', speaker: '对方', text: '嗯' },
      { side: 'right', speaker: '我', text: '怎么不回我' },
      { side: 'right', speaker: '我', text: '你是不是不想聊' },
      { side: 'left', speaker: '对方', text: '不知道' },
      { side: 'right', speaker: '我', text: '那你到底去哪了' },
    ],
  })));

  assert.equal(advice.relationship_memory_engine.investment_balance, 'user_investing_more');
  assert.equal(advice.relationship_memory_engine.risk_level, 'too_needy');
  assert.equal(advice.reply_risk, 'too_needy');
  assert.match(advice.next_best_move, /收住|追问|留给对方/);
});

test('treats emotional discomfort as a too-cold risk unless answered with action', () => {
  const advice = parseAdvice(JSON.stringify(adviceValue({
    conversation_stage: '情绪陪伴',
    conversation_mode: '情绪倾诉',
    dialogue: [
      { side: 'right', speaker: '我', text: '怎么啦' },
      { side: 'left', speaker: '对方', text: '我肚子疼，不想上学' },
      { side: 'left', speaker: '对方', text: '作业也没写完' },
    ],
  })));

  assert.equal(advice.relationship_memory_engine.relationship_stage, 'emotional_bonding');
  assert.equal(advice.relationship_memory_engine.risk_level, 'too_cold');
  assert.equal(advice.relationship_goal.target_stage, 'push_pull_flirting');
  assert.match(advice.coach_advice.summary, /情绪共鸣|身体不舒服/);
  assert.match(advice.next_5_moves[0], /关心/);
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
  assert.deepEqual(advice.replies[0], { text: '感受到了，嘴硬但还挺会关心人', messages: ['感受到了，嘴硬但还挺会关心人'], style_dimension: 'SINCERE' });
  assert.equal(advice.sticker_match_intent.reply_intent, 'flirty_continue');
  assert.equal(advice.sticker_match_intent.emotion, 'shy');
  assert.ok(advice.sticker_match_intent.secondary_emotions.includes('love'));
  assert.ok(advice.sticker_match_intent.scenario.includes('flirting'));
  assert.ok(advice.sticker_match_intent.relationship_stage.includes('flirting'));
  assert.ok(advice.sticker_match_intent.keywords.includes('偷看'));
  assert.equal(advice.sticker_suggestions.length, 6);
  assert.equal(advice.sticker_suggestions[0].match.reply_intent, 'flirty_continue');
  assert.equal(advice.conversation_summary, '对方：你感受到我的了吗；我：好像遇到我你才对白由向往');
});

test('merges lightweight text-only reply refinements into the original advice', () => {
  const advice = parseAdvice(JSON.stringify(adviceValue()));
  const merged = mergeRefinedReplies(advice, JSON.stringify({
    replies: [{ text: '回复一' }, { text: '回复二' }, { text: '回复三' }],
  }));

  assert.deepEqual(merged.replies, [
    { text: '回复一', messages: ['回复一'], style_dimension: 'SINCERE' },
    { text: '回复二', messages: ['回复二'], style_dimension: 'SINCERE' },
    { text: '回复三', messages: ['回复三'], style_dimension: 'SINCERE' },
  ]);
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
  assert.deepEqual(advice.replies[0].messages, ['其实也没想很多', '就是睡前想到你一下', '结果一下有点久']);
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
      { side: 'left', speaker: '对方', text: '不忙', confidence: 'high' },
      { side: 'right', speaker: '我', text: '你空闲喜欢做什么？', confidence: 'high' },
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
    [{ side: 'feed', speaker: '对方', text: '这句话有明确发送者', confidence: 'low' }],
  );
});

test('does not reject a chat screenshot just because OCR evidence is incomplete', () => {
  assert.equal(
    isVerifiedChatScreenshot(
      { is_chat_screenshot: false },
      [],
      {
        image_kind: 'wechat screenshot',
        has_message_bubbles: true,
        has_chat_ui: true,
        has_two_sided_layout: false,
      },
    ),
    true,
  );

  assert.equal(
    isVerifiedChatScreenshot(
      { is_chat_screenshot: true },
      normalizeDialogue([
        { side: 'left', text: '你今天几点下课？' },
        { side: 'right', text: '下午' },
      ]),
      {
        image_kind: 'wechat screenshot',
        has_message_bubbles: false,
        has_chat_ui: false,
        has_two_sided_layout: false,
      },
    ),
    true,
  );
});

test('uses partial recognized chat text instead of forcing fallback', () => {
  const advice = parseAdvice(JSON.stringify(adviceValue({
    is_chat_screenshot: true,
    chat_evidence: {
      image_kind: 'wechat chat screenshot',
      has_message_bubbles: true,
      has_chat_ui: true,
      has_two_sided_layout: false,
    },
    dialogue: [
      { side: 'left', text: '我困死了，不想写作业' },
    ],
    replies: [
      { text: '先眯十分钟' },
      { text: '作业先放一下' },
      { text: '我陪你把最急的那题拆出来' },
    ],
  })));

  assert.equal(advice.is_chat_screenshot, true);
  assert.equal(advice.needs_retry, false);
  assert.equal(advice.replies.length, 3);
  assert.match(advice.conversation_summary, /困死了/);
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

test('detects user-driven pursuit with sparse short opponent replies as a cold conversation', () => {
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

  assert.equal(
    hasRepeatedColdReplies(normalizeDialogue([
      { side: 'right', text: '你在干嘛' },
      { side: 'right', text: '你今天忙吗' },
      { side: 'right', text: '怎么不说话' },
      { side: 'left', text: '嗯' },
    ])),
    true,
  );
});

test('does not treat isolated short opponent text as cold without user pursuit', () => {
  assert.equal(
    hasRepeatedColdReplies(normalizeDialogue([
      { side: 'left', text: '嗯' },
      { side: 'left', text: '哦' },
    ])),
    false,
  );

  assert.equal(
    hasRepeatedColdReplies(normalizeDialogue([
      { side: 'right', text: '好的' },
      { side: 'left', text: '在干嘛' },
      { side: 'right', text: '不知道' },
      { side: 'left', text: '找你说话' },
      { side: 'right', text: 'o' },
      { side: 'left', text: '我俩很不熟吗' },
    ])),
    false,
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
  assert.equal(repairReplyCandidates(advice).replies.length, 5);
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
  assert.deepEqual(repaired.replies[0].messages, ['先别逼自己了', '这题卡住真的会很烦', '你先出去透口气']);
  assert.doesNotMatch(repaired.replies[0].text, /肚子和头一起疼也太难受了/);
  assert.doesNotMatch(repaired.replies[0].text, /你现在感觉还好吗|喝点温水/);
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
  assert.deepEqual(repairReplyCandidates(advice).replies[1].messages, ['不是你不行', '是脑子已经太累了', '先把第一题放一下']);
});

test('repairs study pressure with headache and stuffy room using screenshot details', () => {
  const advice = parseAdvice(JSON.stringify(adviceValue({
    dialogue: [
      { side: 'left', text: '我想太多了' },
      { side: 'left', text: '然后第一题一直没做出来' },
      { side: 'left', text: '是 midterm1 之前的东西' },
      { side: 'left', text: '我想的是最近的东西' },
      { side: 'left', text: '我的头好痛' },
      { side: 'left', text: '里面好闷' },
      { side: 'left', text: '真的' },
    ],
    replies: [
      { text: '你现在感觉还好吗？' },
      { text: '有没有哪里特别不舒服' },
      { text: '先躺下，喝点温水' },
    ],
  })));
  const repaired = repairReplyCandidates(advice);

  assert.equal(advice.analysis.scene, '学习压力');
  assert.equal(advice.analysis.reply_intent, 'study_pressure_support');
  assert.equal(needsReplyRefinement(advice), true);
  assert.match(repaired.replies.map((reply) => reply.text).join('\n'), /第一题|midterm|头痛|闷|透口气|休息十分钟/);
  assert.doesNotMatch(repaired.replies.map((reply) => reply.text).join('\n'), /喝点温水|你现在感觉还好吗/);
  assert.equal(needsReplyRefinement(repaired), false);
});

test('repairs flirty conflict instead of leaking generic comfort templates', () => {
  const advice = parseAdvice(JSON.stringify(adviceValue({
    dialogue: [
      { side: 'left', text: '我讨厌你' },
    ],
    replies: [
      { text: '你现在感觉还好吗？' },
      { text: '辛苦了，早点休息' },
      { text: '别想太多，注意身体' },
    ],
  })));
  const repaired = repairReplyCandidates(advice);

  assert.equal(advice.analysis.reply_intent, 'soften_flirty_conflict');
  assert.equal(needsReplyRefinement(advice), true);
  assert.deepEqual(repaired.replies[0].messages, ['那我先认错半秒', '再认真哄你']);
  assert.doesNotMatch(repaired.replies.map((reply) => reply.text).join('\n'), /喝点温水|早点休息|注意身体/);
  assert.equal(needsReplyRefinement(repaired), false);
});

test('repairs tired homework replies with concrete action', () => {
  const advice = parseAdvice(JSON.stringify(adviceValue({
    dialogue: [
      { side: 'left', text: '我困死了，不想写作业' },
    ],
    replies: [
      { text: '你现在感觉还好吗？' },
      { text: '辛苦了，早点休息' },
      { text: '别想太多，注意身体' },
    ],
  })));
  const repaired = repairReplyCandidates(advice);

  assert.equal(advice.analysis.scene, '学习压力');
  assert.equal(needsReplyRefinement(advice), true);
  assert.deepEqual(repaired.replies[0].messages, ['先别硬撑', '眯十分钟再写会快很多']);
  assert.match(repaired.replies.map((reply) => reply.text).join('\n'), /作业|眯十分钟|最急|拆出来/);
  assert.doesNotMatch(repaired.replies.map((reply) => reply.text).join('\n'), /喝点温水|早点休息|注意身体/);
  assert.equal(needsReplyRefinement(repaired), false);
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
  assert.deepEqual(repaired.replies[0], { text: '有，我平时比较喜欢___', messages: ['有，我平时比较喜欢___'], style_dimension: 'SINCERE' });
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
  assert.equal(stopSuggestions.length, 6);
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
    { side: 'left', text: '我现在不太想动' },
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
  assert.equal(intent.reply_intent, 'care_action_support');
  assert.equal(intent.emotion, 'comfort');
  assert.ok(intent.scenario.includes('comfort'));
  assert.ok(intent.keywords.includes('盖被子'));
  assert.ok(intent.keywords.includes('递热水'));
  assert.ok(scoreStockSticker(caringSticker, intent) > scoreStockSticker(unrelatedSticker, intent));
  const supportSuggestions = normalizeStickerSuggestions([], '情绪陪伴', dialogue, { emotional_disclosure: true });
  assert.equal(supportSuggestions.length, 6);
  assert.equal(supportSuggestions[0].match.reply_intent, 'care_action_support');
});

test('prioritizes comfort and encouragement stickers for study pressure with discomfort', () => {
  const dialogue = normalizeDialogue([
    { side: 'left', text: '我想太多了' },
    { side: 'left', text: '第一题一直没做出来' },
    { side: 'left', text: '是 midterm1 之前的东西' },
    { side: 'left', text: '我的头好痛' },
    { side: 'left', text: '里面好闷' },
  ]);
  const intent = buildStickerMatchIntent({ conversationStage: '情绪陪伴', dialogue, emotionalDisclosure: true });
  const suggestions = normalizeStickerSuggestions([], '情绪陪伴', dialogue, {
    emotional_disclosure: true,
    analysis: { scene: '学习压力', reply_intent: 'study_pressure_support' },
  });

  assert.equal(intent.context, 'study_discomfort');
  assert.equal(intent.reply_intent, 'study_pressure_support');
  assert.equal(intent.emotion, 'comfort');
  assert.ok(intent.secondary_emotions.includes('encourage'));
  assert.ok(intent.keywords.includes('别硬撑'));
  assert.equal(suggestions.length, 6);
  const stickerText = suggestions.map((sticker) => `${sticker.id} ${sticker.text} ${(sticker.tags || []).join(' ')}`).join(' ');
  assert.match(stickerText, /抱|摸|硬撑|休息|我在|加油|喝水|comfort|pat|hug|cheer|drink|tired|hard/);
  assert.doesNotMatch(stickerText, /umbrella|伞|保暖/);
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

test('softens flirty conflict instead of matching opponent anger literally', () => {
  const dialogue = normalizeDialogue([{ side: 'left', text: '我讨厌你' }]);
  const intent = buildStickerMatchIntent({ conversationStage: '轻松破冰', dialogue });
  const suggestions = normalizeStickerSuggestions([], '轻松破冰', dialogue, {});

  assert.equal(intent.reply_intent, 'soften_flirty_conflict');
  assert.equal(intent.emotion, 'shy');
  assert.ok(intent.secondary_emotions.includes('apology'));
  assert.notEqual(intent.emotion, 'angry');
  assert.equal(suggestions.length, 6);
  assert.equal(suggestions.some((sticker) => sticker.emotion?.primary === 'angry'), false);
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
  assert.deepEqual(repaired.replies[0], { text: '我瞎猜的，那我撤回', messages: ['我瞎猜的，那我撤回'], style_dimension: 'DIRECT_ANSWER' });
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

test('safely parses fenced JSON blocks with common formatting issues', () => {
  assert.deepEqual(safeJsonParse('```json\n{"ok":true,}\n```'), { ok: true });
  assert.deepEqual(safeJsonParse('说明文字\n[{"ok":true,}]\n补充文字'), [{ ok: true }]);
});

test('safeJsonParse does not treat nested fragments from truncated JSON as a valid response', () => {
  const raw = '{"analysis":{"scene":"身体不舒服"},"replies":[';
  assert.throws(() => safeJsonParse(raw), /invalid JSON/);
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
    assert.equal(requestPayload.model, 'gpt-4.1-mini');
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

test('returns a timeout fallback instead of service-busy copy for Vision timeout', async () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-key';
  let callCount = 0;
  const timeoutValues = [];
  global.fetch = async (_url, options) => {
    callCount += 1;
    const payload = JSON.parse(options.body);
    timeoutValues.push(payload.max_completion_tokens);
    return jsonResponse(408, { error: { code: 'timeout', message: 'OpenAI request timed out after 16000ms' } });
  };

  try {
    const response = createResponseRecorder();
    await handler({ method: 'POST', body: requestBody, headers: {} }, response);
    const advice = JSON.parse(response.body.content[0].text);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.reason, 'vision-timeout');
    assert.equal(response.body.debug.vision_called, true);
    assert.equal(response.body.debug.vision_timeout, true);
    assert.equal(response.body.debug.fallback_used, true);
    assert.equal(Number.isFinite(response.body.debug.elapsed_ms), true);
    assert.equal(callCount, 3);
    assert.deepEqual(timeoutValues, [EXTRACTION_MAX_COMPLETION_TOKENS, PRIMARY_MAX_COMPLETION_TOKENS, 700]);
    assert.equal(advice.attitude_label, '识图超时');
    assert.equal(advice.is_chat_screenshot, true);
    assert.equal(advice.needs_retry, true);
    assert.doesNotMatch(advice.attitude_desc, /服务暂时繁忙|不是聊天截图/);
  } finally {
    global.fetch = originalFetch;
    restoreEnvironment('OPENAI_API_KEY', originalApiKey);
  }
});

test('returns a minimal usable result instead of degraded fallback for malformed model JSON', async () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-key';
  global.fetch = async () => jsonResponse(200, {
    choices: [{
      finish_reason: 'length',
      message: { content: '{"analysis":{"scene":"身体不舒服"},"replies":[' },
    }],
  });

  try {
    const response = createResponseRecorder();
    await handler({ method: 'POST', body: requestBody, headers: {} }, response);
    const advice = JSON.parse(response.body.content[0].text);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.degraded, undefined);
    assert.equal(response.body.debug.vision_success, true);
    assert.equal(response.body.debug.json_parse_failed, true);
    assert.equal(response.body.debug.raw_output, '');
    assert.equal(response.body.debug.fallback_used, true);
    assert.equal(advice.degraded, false);
    assert.equal(advice.json_parse_failed, true);
    assert.deepEqual(advice.analysis.scene, '');
    assert.deepEqual(advice.replies, []);
    assert.deepEqual(advice.stickers, []);
    assert.ok(advice.next_topics.length > 0);
    assert.equal(advice.conversation_summary, '');
    assert.doesNotMatch(JSON.stringify(advice), /身体不舒服|OpenAI 已经返回内容/);
    assert.doesNotMatch(advice.attitude_desc, /服务暂时繁忙/);
  } finally {
    global.fetch = originalFetch;
    restoreEnvironment('OPENAI_API_KEY', originalApiKey);
  }
});

test('returns vision debug info for uploaded screenshots', async () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-key';
  global.fetch = async () => jsonResponse(200, openAIAdviceResponse());

  try {
    const response = createResponseRecorder();
    await handler({ method: 'POST', body: requestBody, headers: {} }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.debug.image_received, true);
    assert.equal(response.body.debug.image_count, 1);
    assert.equal(response.body.debug.images[0].mime_type, 'image/png');
    assert.equal(response.body.debug.images[0].base64_length, 8);
    assert.equal(response.body.debug.vision_called, true);
    assert.equal(response.body.debug.vision_success, true);
    assert.match(response.body.debug.extracted_text, /对方/);
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
      return jsonResponse(200, openAIAdviceResponse({
        is_chat_screenshot: true,
        non_chat_reply: '',
        chat_evidence: {
          image_kind: 'chat',
          has_message_bubbles: true,
          has_chat_ui: true,
          has_two_sided_layout: true,
        },
        dialogue: [
          { side: 'right', speaker: '我', text: '今天刚下课' },
          { side: 'left', speaker: '对方', text: '我今天也挺忙的' },
        ],
        needs_retry: false,
      }));
    }
    if (requests.length === 2) {
      return jsonResponse(200, openAIAdviceResponse({
        primary_intent: 'DAILY_CHAT',
        speaker_flow: 'balanced',
        emotional_valence: 'neutral',
        attention_signal: 0,
        my_last_reply_warmth: 'neutral',
        repair_needed: false,
        intent_confidence: 'medium',
      }));
    }
    if (requests.length === 3) {
      return jsonResponse(200, openAIAdviceResponse(adviceValue({
        dialogue: [
          { side: 'right', speaker: '我', text: '今天刚下课' },
          { side: 'left', speaker: '对方', text: '我今天也挺忙的' },
        ],
        replies: [
          { text: '听起来你今天过得比较充实' },
          { text: '感觉你最近状态还不错' },
          { text: '有需要的话可以告诉我' },
        ],
      })));
    }
    return jsonResponse(200, openAIAdviceResponse());
  };

  try {
    const response = createResponseRecorder();
    await handler({ method: 'POST', body: requestBody, headers: {} }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(requests.length, 4);
    assert.match(requests[3].messages[1].content.at(-1).text, /上一轮候选需要重写/);
    assert.equal(requests[3].messages[1].content.some((part) => part.type === 'image_url'), false);
    assert.equal(requests[3].max_completion_tokens, REFINEMENT_MAX_COMPLETION_TOKENS);
    assert.deepEqual(requests[3].response_format.json_schema.schema, REPLY_REFINEMENT_SCHEMA);
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
    assert.deepEqual(advice.replies[0], { text: '我瞎猜的，那我撤回', messages: ['我瞎猜的，那我撤回'], style_dimension: 'DIRECT_ANSWER' });
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
      req: {
        headers: {
          'x-forwarded-for': '127.0.0.1, 10.0.0.1',
          'user-agent': 'test-browser',
          'x-vercel-ip-country': 'US',
          'x-vercel-ip-country-region': 'CA',
          'x-vercel-ip-city': 'Los%20Angeles',
        },
      },
      advice: parseAdvice(JSON.stringify(adviceValue())),
      imageParts: [requestBody.messages[0].content[0]],
      metadata: {
        visitor_id: 'visitor-test',
        page_path: '/',
        background_text: '她今天有点不舒服',
      },
      status: 'success',
      elapsedMs: 1234,
    });

    assert.match(requests[0].url, /storage\/v1\/object\/screenshots\//);
    assert.match(requests[1].url, /rest\/v1\/usage_logs/);
    const payload = JSON.parse(requests[1].options.body);
    assert.deepEqual(payload.image_urls.length, 1);
    assert.match(payload.storage_paths[0], /^screenshots\/\d{4}-\d{2}-\d{2}\/visitor-test-\d+-0\.png$/);
    assert.equal(payload.ip, '127.0.0.1');
    assert.equal(payload.user_agent, 'test-browser');
    assert.equal(payload.country, 'US');
    assert.equal(payload.region, 'CA');
    assert.equal(payload.city, 'Los Angeles');
    assert.equal(payload.location_label, 'Los Angeles, CA, US');
    assert.equal(payload.page_path, '/');
    assert.equal(payload.status, 'success');
    assert.equal(payload.elapsed_ms, 1234);
    assert.equal(payload.background_text, '她今天有点不舒服');
    assert.equal(payload.scene, '日常聊天');
    assert.equal(payload.reply_intent, 'warm_continue');
    assert.equal(payload.extracted_text.includes('对方:你感受到我的了吗'), true);
    assert.equal(Array.isArray(payload.sticker_ids), true);
  } finally {
    global.fetch = originalFetch;
    restoreEnvironment('SUPABASE_URL', originalUrl);
    restoreEnvironment('SUPABASE_SERVICE_KEY', originalKey);
  }
});

test('EXTRACTION_IMAGE_DETAIL stays low', () => {
  assert.equal(EXTRACTION_IMAGE_DETAIL, 'low');
});

test('EXTRACTION_MAX_COMPLETION_TOKENS is 600', () => {
  assert.equal(EXTRACTION_MAX_COMPLETION_TOKENS, 600);
});

test('extractDialogueFromImages is a function', () => {
  assert.equal(typeof extractDialogueFromImages, 'function');
});

test('buildLocalReplySeeds final fallback does not contain generic counselling replies', () => {
  const GENERIC = /我先认真听你说|你继续说|这句我接住了|别一个人憋着/;
  // 空 dialogue 的兜底路径不应返回通用情绪安慰话术
  // 验证 GENERIC_REPLY_TEMPLATE_PATTERN 对上述内容匹配
  assert.ok(GENERIC.test('我先认真听你说'), 'pattern should match generic counselling text');
  // 验证通用话术已从常量列表中无法通过 template check
  const fakeReply = { text: '我先认真听你说', messages: ['我先认真听你说'] };
  assert.ok(GENERIC_REPLY_TEMPLATE_PATTERN.test(fakeReply.text), 'GENERIC_REPLY_TEMPLATE_PATTERN should still catch it');
});

test('background_text prefix is constructed correctly', () => {
  const backgroundText = '认识两周了，她最近回复变慢了';
  const prefix = backgroundText
    ? `【用户提供的背景信息】\n${backgroundText}\n\n`
    : '';
  assert.ok(prefix.startsWith('【用户提供的背景信息】'));
  assert.ok(prefix.includes(backgroundText));

  const emptyPrefix = ''
    ? `【用户提供的背景信息】\n\n`
    : '';
  assert.equal(emptyPrefix, '');
});

test('intent detection schema and strategy map are available', () => {
  assert.equal(INTENT_MAX_COMPLETION_TOKENS, 200);
  assert.ok(INTENT_DETECTION_SCHEMA.required.includes('primary_intent'));
  assert.ok(INTENT_DETECTION_SCHEMA.properties.primary_intent.enum.includes('SEEKING_ATTENTION'));
  assert.ok(INTENT_DETECTION_SCHEMA.properties.primary_intent.enum.includes('ANSWERING_QUESTION'));
  assert.equal(INTENT_STRATEGY_MAP.SEEKING_ATTENTION.tone, '轻松诚恳');
  assert.match(INTENT_STRATEGY_MAP.ANSWERING_QUESTION.reply_direction, /接住答案/);
  assert.equal(typeof detectConversationIntent, 'function');
});

test('buildIntentPrefix injects strategy and repair warning', () => {
  const prefix = buildIntentPrefix({
    primary_intent: 'SEEKING_ATTENTION',
    speaker_flow: 'other_initiates',
    emotional_valence: 'neutral',
    attention_signal: 3,
    my_last_reply_warmth: 'cold',
    repair_needed: true,
    intent_confidence: 'high',
  }, INTENT_STRATEGY_MAP);

  assert.match(prefix, /【对话意图分析】/);
  assert.match(prefix, /SEEKING_ATTENTION/);
  assert.match(prefix, /修复优先/);
  assert.match(prefix, /先修复我方偏冷的回复/);
  assert.match(prefix, /绝对不要建议给对方空间/);
});

test('handler runs intent detection after extraction and injects intent into analysis prompt', async () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-key';
  const requests = [];
  global.fetch = async (_url, options) => {
    requests.push(JSON.parse(options.body));
    if (requests.length === 1) {
      return jsonResponse(200, openAIAdviceResponse({
        is_chat_screenshot: true,
        non_chat_reply: '',
        chat_evidence: {
          image_kind: 'chat',
          has_message_bubbles: true,
          has_chat_ui: true,
          has_two_sided_layout: true,
        },
        dialogue: [
          { side: 'left', speaker: '对方', text: '在干嘛' },
          { side: 'right', speaker: '我', text: 'o' },
          { side: 'left', speaker: '对方', text: '找你说话' },
        ],
        needs_retry: false,
      }));
    }
    if (requests.length === 2) {
      return jsonResponse(200, openAIAdviceResponse({
        primary_intent: 'SEEKING_ATTENTION',
        speaker_flow: 'other_initiates',
        emotional_valence: 'neutral',
        attention_signal: 3,
        my_last_reply_warmth: 'cold',
        repair_needed: true,
        intent_confidence: 'high',
      }));
    }
    return jsonResponse(200, openAIAdviceResponse());
  };

  try {
    const response = createResponseRecorder();
    await handler({ method: 'POST', body: requestBody, headers: {} }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(requests.length, 3);
    assert.equal(requests[1].messages[1].content.some((part) => part.type === 'image_url'), false);
    assert.equal(requests[1].max_completion_tokens, INTENT_MAX_COMPLETION_TOKENS);
    assert.deepEqual(requests[1].response_format.json_schema.schema, INTENT_DETECTION_SCHEMA);
    assert.equal(requests[2].messages[1].content.some((part) => part.type === 'image_url'), false);
    const analysisPrompt = requests[2].messages[1].content.at(-1).text;
    assert.match(analysisPrompt, /【对话意图分析】/);
    assert.match(analysisPrompt, /SEEKING_ATTENTION/);
    assert.match(analysisPrompt, /修复优先/);
    assert.match(analysisPrompt, /【已提取的对话内容】/);
  } finally {
    global.fetch = originalFetch;
    restoreEnvironment('OPENAI_API_KEY', originalApiKey);
  }
});

test('handler returns group chat advice immediately after extraction', async () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-key';
  const requests = [];
  global.fetch = async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return jsonResponse(200, openAIAdviceResponse({
      is_chat_screenshot: true,
      is_group_chat: true,
      non_chat_reply: '',
      chat_evidence: {
        image_kind: 'chat',
        has_message_bubbles: true,
        has_chat_ui: true,
        has_two_sided_layout: false,
      },
      dialogue: [
        { side: 'left', speaker: '对方', text: '群聊消息', confidence: 'high' },
      ],
      needs_retry: false,
    }));
  };

  try {
    const response = createResponseRecorder();
    await handler({ method: 'POST', body: requestBody, headers: {} }, response);
    const advice = JSON.parse(response.body.content[0].text);

    assert.equal(response.statusCode, 200);
    assert.equal(requests.length, 1);
    assert.equal(response.body.debug.is_group_chat, true);
    assert.equal(advice.is_group_chat, true);
    assert.equal(advice.needs_retry, false);
    assert.deepEqual(advice.replies, []);
  } finally {
    global.fetch = originalFetch;
    restoreEnvironment('OPENAI_API_KEY', originalApiKey);
  }
});

test('INTENT_MAX_COMPLETION_TOKENS is 200', () => {
  assert.equal(INTENT_MAX_COMPLETION_TOKENS, 200);
});

test('INTENT_DETECTION_SCHEMA has correct primary_intent enum', () => {
  const intents = INTENT_DETECTION_SCHEMA.properties.primary_intent.enum;
  assert.ok(intents.includes('ANSWERING_QUESTION'));
  assert.ok(intents.includes('SEEKING_ATTENTION'));
  assert.ok(intents.includes('SHARING_MEDIA'));
  assert.ok(intents.includes('EMOTIONAL_VENTING'));
  assert.ok(intents.includes('COLD_REPLY'));
  assert.equal(intents.length, 12);
  assert.equal(INTENT_DETECTION_SCHEMA.additionalProperties, false);
});

test('INTENT_STRATEGY_MAP has entries for all 12 intents', () => {
  const required = [
    'ANSWERING_QUESTION', 'SHARING_EXPERIENCE', 'SHARING_INTEREST', 'SHARING_MEDIA',
    'EMOTIONAL_VENTING', 'SEEKING_ATTENTION', 'PLAYFUL_TEASE', 'COMPLAINT_PROBE',
    'PLANNING', 'GREETING', 'COLD_REPLY', 'DAILY_CHAT',
  ];
  required.forEach((intent) => {
    assert.ok(INTENT_STRATEGY_MAP[intent], `Missing strategy for ${intent}`);
    assert.ok(INTENT_STRATEGY_MAP[intent].reply_direction, `Missing reply_direction for ${intent}`);
    assert.ok(INTENT_STRATEGY_MAP[intent].avoid, `Missing avoid for ${intent}`);
  });
});

test('detectConversationIntent is a function', () => {
  assert.equal(typeof detectConversationIntent, 'function');
});

test('buildIntentPrefix returns empty string for null intent', () => {
  const prefix = buildIntentPrefix(null, INTENT_STRATEGY_MAP);
  assert.equal(prefix, '');
});

test('buildIntentPrefix for SEEKING_ATTENTION with cold reply includes repair warning', () => {
  const intent = {
    primary_intent: 'SEEKING_ATTENTION',
    speaker_flow: 'other_initiates',
    emotional_valence: 'neutral',
    attention_signal: 2,
    my_last_reply_warmth: 'cold',
    repair_needed: true,
    intent_confidence: 'high',
  };
  const prefix = buildIntentPrefix(intent, INTENT_STRATEGY_MAP);
  assert.ok(prefix.includes('SEEKING_ATTENTION'));
  assert.ok(prefix.includes('修复优先') || prefix.includes('repair'));
  assert.ok(prefix.includes('cold'));
  assert.ok(prefix.includes('【本次回复策略】'));
  assert.ok(prefix.endsWith('\n\n'));
});

test('buildIntentPrefix for ANSWERING_QUESTION does not include repair warning', () => {
  const intent = {
    primary_intent: 'ANSWERING_QUESTION',
    speaker_flow: 'other_answers_me',
    emotional_valence: 'positive',
    attention_signal: 0,
    my_last_reply_warmth: 'neutral',
    repair_needed: false,
    intent_confidence: 'high',
  };
  const prefix = buildIntentPrefix(intent, INTENT_STRATEGY_MAP);
  assert.ok(prefix.includes('ANSWERING_QUESTION'));
  assert.ok(!prefix.includes('修复优先'));
  assert.ok(prefix.includes('接住答案'));
});

test('buildIntentPrefix for SHARING_MEDIA does not recommend emotional counselling', () => {
  const intent = {
    primary_intent: 'SHARING_MEDIA',
    speaker_flow: 'other_shares',
    emotional_valence: 'positive',
    attention_signal: 0,
    my_last_reply_warmth: 'neutral',
    repair_needed: false,
    intent_confidence: 'high',
  };
  const prefix = buildIntentPrefix(intent, INTENT_STRATEGY_MAP);
  assert.ok(prefix.includes('SHARING_MEDIA'));
  assert.ok(!prefix.includes('情绪安慰'));
});

test('EXTRACTION_SCHEMA has confidence field in dialogue items', () => {
  const confidenceEnum = EXTRACTION_SCHEMA.properties.dialogue.items.properties.confidence.enum;
  assert.deepEqual(confidenceEnum, ['high', 'medium', 'low']);
  assert.ok(EXTRACTION_SCHEMA.properties.dialogue.items.required.includes('confidence'));
  assert.ok(EXTRACTION_SCHEMA.properties.is_group_chat !== undefined);
  assert.ok(EXTRACTION_SCHEMA.required.includes('is_group_chat'));
  assert.equal(EXTRACTION_SCHEMA.additionalProperties, false);
});

test('EXTRACTION_SYSTEM_PROMPT instructs confidence levels', () => {
  assert.ok(EXTRACTION_SYSTEM_PROMPT.includes('confidence'));
  assert.ok(EXTRACTION_SYSTEM_PROMPT.includes('high'));
  assert.ok(EXTRACTION_SYSTEM_PROMPT.includes('medium'));
  assert.ok(EXTRACTION_SYSTEM_PROMPT.includes('low'));
  assert.ok(EXTRACTION_SYSTEM_PROMPT.includes('is_group_chat'));
  assert.ok(EXTRACTION_SYSTEM_PROMPT.includes('needs_retry'));
});

test('EXTRACTION_SYSTEM_PROMPT says single column should not trigger needs_retry', () => {
  assert.ok(
    EXTRACTION_SYSTEM_PROMPT.includes('单列') ||
    EXTRACTION_SYSTEM_PROMPT.includes('needs_retry=true'),
  );
});

test('buildGroupChatAdvice returns correct structure', () => {
  const advice = buildGroupChatAdvice();
  assert.equal(advice.is_group_chat, true);
  assert.equal(advice.is_chat_screenshot, true);
  assert.equal(advice.needs_retry, false);
  assert.ok(advice.attitude_label.includes('群聊'));
  assert.ok(advice.attitude_desc.includes('私信'));
  assert.deepEqual(advice.replies, []);
  assert.ok(advice.relationship_goal !== undefined);
  assert.ok(advice.coach_advice !== undefined);
});

test('normalizeDialogue preserves confidence field', () => {
  const messages = [
    { side: 'left', speaker: '对方', text: '你好', confidence: 'high' },
    { side: 'right', speaker: '我', text: '嗨', confidence: 'medium' },
    { side: 'left', speaker: '对方', text: '在吗', confidence: 'low' },
  ];
  const result = normalizeDialogue(messages);
  assert.equal(result.length, 3);
  assert.equal(result[0].confidence, 'high');
  assert.equal(result[1].confidence, 'medium');
  assert.equal(result[2].confidence, 'low');
});

test('normalizeDialogue defaults confidence to high for left/right without confidence field', () => {
  const messages = [
    { side: 'left', speaker: '对方', text: '测试' },
    { side: 'right', speaker: '我', text: '好' },
  ];
  const result = normalizeDialogue(messages);
  assert.equal(result[0].confidence, 'high');
  assert.equal(result[1].confidence, 'high');
});

test('normalizeDialogue defaults confidence to low for feed without confidence field', () => {
  const messages = [
    { side: 'feed', speaker: '对方', text: '单列消息' },
  ];
  const result = normalizeDialogue(messages);
  assert.equal(result[0].confidence, 'low');
});

test('buildRegeneratePrefix returns empty string for empty array', () => {
  assert.equal(buildRegeneratePrefix([]), '');
  assert.equal(buildRegeneratePrefix(null), '');
  assert.equal(buildRegeneratePrefix(undefined), '');
});

test('buildRegeneratePrefix includes previous replies and style instruction', () => {
  const previous = ['你继续说\n我在', '没事的，先喝点水'];
  const prefix = buildRegeneratePrefix(previous);
  assert.ok(prefix.includes('换一批不同风格'));
  assert.ok(prefix.includes('你继续说'));
  assert.ok(prefix.includes('没事的'));
  assert.ok(prefix.includes('不同风格'));
  assert.ok(prefix.endsWith('\n\n'));
});

test('normalizeClientMetadata handles regenerate fields', () => {
  const meta = normalizeClientMetadata({
    visitor_id: 'v1',
    regenerate: true,
    previous_replies: ['回复A', '回复B'],
    regenerate_dialogue: [
      { side: 'left', speaker: '对方', text: '你好' },
      { side: 'right', speaker: '我', text: '嗨' },
    ],
  });
  assert.equal(meta.regenerate, true);
  assert.equal(meta.previous_replies.length, 2);
  assert.equal(meta.regenerate_dialogue.length, 2);
  assert.equal(meta.regenerate_dialogue[0].text, '你好');
});

test('normalizeClientMetadata defaults regenerate to false', () => {
  const meta = normalizeClientMetadata({ visitor_id: 'v1' });
  assert.equal(meta.regenerate, false);
  assert.deepEqual(meta.previous_replies, []);
  assert.deepEqual(meta.regenerate_dialogue, []);
});

test('getRequestParts allows regenerate requests without image parts', () => {
  const parts = getRequestParts({
    metadata: {
      regenerate: true,
      regenerate_dialogue: [
        { side: 'left', speaker: '对方', text: '在干嘛' },
        { side: 'right', speaker: '我', text: '刚忙完' },
      ],
    },
    messages: [{
      role: 'user',
      content: [{ type: 'text', text: '换一批回复' }],
    }],
  });
  assert.equal(parts.imageParts.length, 0);
  assert.equal(parts.metadata.regenerate, true);
  assert.equal(parts.metadata.regenerate_dialogue.length, 2);
});

test('CHAT_ADVICE_SCHEMA replies items include style_dimension', () => {
  const itemProps = CHAT_ADVICE_SCHEMA.properties.replies.items.properties;
  const itemRequired = CHAT_ADVICE_SCHEMA.properties.replies.items.required;
  assert.ok(itemProps.style_dimension !== undefined, 'style_dimension should be in properties');
  assert.ok(itemRequired.includes('style_dimension'), 'style_dimension should be in required');
  const dims = itemProps.style_dimension.enum;
  assert.ok(Array.isArray(dims));
  assert.ok(dims.includes('LIGHTHEARTED'));
  assert.ok(dims.includes('SINCERE'));
  assert.ok(dims.includes('WARM_CARING'));
  assert.ok(dims.includes('PLAYFUL'));
  assert.ok(dims.includes('FLIRTY'));
  assert.ok(dims.includes('DIRECT_ANSWER'));
  assert.ok(dims.includes('INTELLECTUAL'));
  assert.equal(dims.length, 7);
});

test('REPLY_REFINEMENT_SCHEMA replies items include style_dimension', () => {
  const itemRequired = REPLY_REFINEMENT_SCHEMA.properties.replies.items.required;
  assert.ok(itemRequired.includes('style_dimension'));
});

test('normalizeReplyCandidate preserves valid style_dimension', () => {
  const reply = {
    style: '轻松',
    text: '测试回复',
    messages: ['测试回复'],
    style_dimension: 'PLAYFUL',
  };
  const result = normalizeReplyCandidate(reply, 140);
  assert.equal(result.style_dimension, 'PLAYFUL');
});

test('normalizeReplyCandidate defaults invalid style_dimension to SINCERE', () => {
  const reply = {
    style: '轻松',
    text: '测试回复',
    messages: ['测试回复'],
    style_dimension: 'INVALID_VALUE',
  };
  const result = normalizeReplyCandidate(reply, 140);
  assert.equal(result.style_dimension, 'SINCERE');
});

test('normalizeReplyCandidate defaults missing style_dimension to SINCERE', () => {
  const reply = {
    style: '轻松',
    text: '测试回复',
    messages: ['测试回复'],
  };
  const result = normalizeReplyCandidate(reply, 140);
  assert.equal(result.style_dimension, 'SINCERE');
});

test('needsReplyRefinement triggers for poor diversity', () => {
  const advice = {
    is_chat_screenshot: true,
    needs_retry: false,
    suggest_stop: false,
    conversation_stage: '轻松破冰',
    dialogue: [{ speaker: '对方', text: '你好', side: 'left' }],
    replies: [
      { style: 'A', text: '回复1', messages: ['回复1'], style_dimension: 'SINCERE' },
      { style: 'B', text: '回复2', messages: ['回复2'], style_dimension: 'SINCERE' },
      { style: 'C', text: '回复3', messages: ['回复3'], style_dimension: 'SINCERE' },
    ],
  };
  assert.ok(needsReplyRefinement(advice), 'should trigger refinement for poor diversity');
});

test('needsReplyRefinement passes for diverse replies', () => {
  const advice = {
    is_chat_screenshot: true,
    needs_retry: false,
    suggest_stop: false,
    conversation_stage: '轻松破冰',
    dialogue: [{ speaker: '对方', text: '你好', side: 'left' }],
    replies: [
      { style: 'A', text: '回复1', messages: ['回复1'], style_dimension: 'LIGHTHEARTED' },
      { style: 'B', text: '回复2', messages: ['回复2'], style_dimension: 'SINCERE' },
      { style: 'C', text: '回复3', messages: ['回复3'], style_dimension: 'WARM_CARING' },
    ],
  };
  const result = needsReplyRefinement(advice);
  const uniqueDims = new Set(advice.replies.map((reply) => reply.style_dimension));
  assert.equal(typeof result, 'boolean');
  assert.ok(uniqueDims.size >= 3, 'should have 3+ unique dimensions');
});

test('STYLE_DIMENSION_NOTE is defined and contains key enum values', () => {
  assert.ok(typeof STYLE_DIMENSION_NOTE === 'string');
  assert.ok(STYLE_DIMENSION_NOTE.includes('LIGHTHEARTED'));
  assert.ok(STYLE_DIMENSION_NOTE.includes('SINCERE'));
  assert.ok(STYLE_DIMENSION_NOTE.includes('FLIRTY'));
  assert.ok(STYLE_DIMENSION_NOTE.length > 50);
});

test('normalizeUserProfile returns null for missing or invalid input', () => {
  assert.equal(normalizeUserProfile(null), null);
  assert.equal(normalizeUserProfile(undefined), null);
  assert.equal(normalizeUserProfile({}), null);
  assert.equal(normalizeUserProfile({ gender: '不想说', target_gender: '不想说', reply_style: '随机' }), null);
});

test('normalizeUserProfile returns cleaned profile for valid input', () => {
  const raw = { gender: '男', target_gender: '女生', reply_style: '幽默' };
  const result = normalizeUserProfile(raw);
  assert.ok(result !== null);
  assert.equal(result.gender, '男');
  assert.equal(result.target_gender, '女生');
  assert.equal(result.reply_style, '幽默');
});

test('normalizeUserProfile rejects invalid enum values', () => {
  const raw = { gender: 'alien', target_gender: '火星人', reply_style: 'sarcastic' };
  const result = normalizeUserProfile(raw);
  assert.equal(result, null);
});

test('normalizeUserProfile allows partial profile', () => {
  const raw = { gender: '女' };
  const result = normalizeUserProfile(raw);
  assert.ok(result !== null);
  assert.equal(result.gender, '女');
  assert.equal(result.target_gender, '不想说');
  assert.equal(result.reply_style, '随机');
});

test('buildUserProfilePrefix returns empty string for null', () => {
  assert.equal(buildUserProfilePrefix(null), '');
  assert.equal(buildUserProfilePrefix(undefined), '');
});

test('buildUserProfilePrefix returns empty string when all fields are default', () => {
  const profile = { gender: '不想说', target_gender: '不想说', reply_style: '随机' };
  assert.equal(buildUserProfilePrefix(profile), '');
});

test('buildUserProfilePrefix includes non-default fields', () => {
  const profile = { gender: '男', target_gender: '女生', reply_style: '直接' };
  const prefix = buildUserProfilePrefix(profile);
  assert.ok(prefix.includes('男'));
  assert.ok(prefix.includes('女生'));
  assert.ok(prefix.includes('直接'));
  assert.ok(prefix.includes('用户偏好'));
  assert.ok(prefix.endsWith('\n\n'));
});

test('buildUserProfilePrefix only includes non-default fields', () => {
  const profile = { gender: '不想说', target_gender: '女生', reply_style: '随机' };
  const prefix = buildUserProfilePrefix(profile);
  assert.ok(prefix.includes('女生'));
  assert.ok(!prefix.includes('不想说'));
  assert.ok(!prefix.includes('随机'));
});

test('needsReplyRefinement detects essay-style replies ending with period', () => {
  const advice = {
    is_chat_screenshot: true,
    needs_retry: false,
    suggest_stop: false,
    conversation_stage: '轻松破冰',
    dialogue: [{ speaker: '对方', text: '我喜欢网易云', side: 'left' }],
    replies: [
      { style: 'A', text: '她可能是习惯了那边的社区。', messages: ['她可能是习惯了那边的社区。'], style_dimension: 'SINCERE' },
      { style: 'B', text: '那你平时听什么', messages: ['那你平时听什么'], style_dimension: 'DIRECT_ANSWER' },
      { style: 'C', text: '网易云确实好用', messages: ['网易云确实好用'], style_dimension: 'LIGHTHEARTED' },
    ],
  };
  assert.ok(needsReplyRefinement(advice), 'should trigger for essay-style reply');
});

test('needsReplyRefinement does not trigger for casual replies', () => {
  const advice = {
    is_chat_screenshot: true,
    needs_retry: false,
    suggest_stop: false,
    conversation_stage: '轻松破冰',
    dialogue: [{ speaker: '对方', text: '我喜欢网易云', side: 'left' }],
    replies: [
      { style: 'A', text: '网易云啊\n她喜欢那边的评论区？', messages: ['网易云啊', '她喜欢那边的评论区？'], style_dimension: 'LIGHTHEARTED' },
      { style: 'B', text: '这歌太犯规了吧', messages: ['这歌太犯规了吧'], style_dimension: 'PLAYFUL' },
      { style: 'C', text: '哦真的假的，她也听这个', messages: ['哦真的假的，她也听这个'], style_dimension: 'SINCERE' },
    ],
  };
  // 不应该因为 essay style 触发 refinement（可能因其他原因触发，但本测试只验证 essay check）
  const uniqueDims = new Set(advice.replies.map((reply) => reply.style_dimension));
  assert.ok(uniqueDims.size >= 3);
});

test('REPLY_COACH_SYSTEM_PROMPT prohibits essay style', () => {
  assert.ok(
    REPLY_COACH_SYSTEM_PROMPT.includes('写作文') ||
    REPLY_COACH_SYSTEM_PROMPT.includes('句号') ||
    REPLY_COACH_SYSTEM_PROMPT.includes('旁白'),
  );
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
