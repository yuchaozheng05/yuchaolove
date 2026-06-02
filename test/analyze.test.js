import assert from 'node:assert/strict';
import test from 'node:test';

import handler, {
  CHAT_ADVICE_SCHEMA,
  MODELS,
  REPLY_COACH_SYSTEM_PROMPT,
  REPLY_PERSPECTIVE_EXAMPLES,
  buildFreeTierFallbackAdvice,
  buildReplyRefinementPrompt,
  extractFirstJsonObject,
  getRequestParts,
  hasRecentEmotionalDisclosure,
  hasRepeatedColdReplies,
  logUsage,
  needsReplyRefinement,
  normalizeDialogue,
  parseAdvice,
  repairReplyCandidates,
  requestOpenAIAdvice,
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
  assert.ok(CHAT_ADVICE_SCHEMA.required.includes('chat_guide'));
  assert.ok(CHAT_ADVICE_SCHEMA.required.includes('flirt_level'));
  assert.equal(CHAT_ADVICE_SCHEMA.properties.chat_guide.additionalProperties, false);
  assert.equal(CHAT_ADVICE_SCHEMA.properties.replies.items.additionalProperties, false);
  assert.deepEqual(Object.keys(CHAT_ADVICE_SCHEMA.properties.replies.items.properties), ['text']);
  assert.match(REPLY_COACH_SYSTEM_PROMPT, /主动回球/);
  assert.match(REPLY_COACH_SYSTEM_PROMPT, /暧昧必须有依据/);
  assert.match(REPLY_COACH_SYSTEM_PROMPT, /永远是用户准备发送给对方的话/);
  assert.match(REPLY_COACH_SYSTEM_PROMPT, /暧昧上限，不是必须完成的任务/);
  assert.match(REPLY_COACH_SYSTEM_PROMPT, /连续倾诉/);
  assert.match(REPLY_PERSPECTIVE_EXAMPLES, /先夸我两句/);
});

test('parses willingness signals, flirt level, and clean untagged replies', () => {
  const advice = parseAdvice(JSON.stringify(adviceValue()));

  assert.equal(advice.attitude_label, '愿意回球');
  assert.equal(advice.interest_score, 76);
  assert.equal(advice.interest_level, '轻微好感');
  assert.equal(advice.conversation_mode, '轻松暧昧');
  assert.equal(advice.flirt_level, '轻微暧昧');
  assert.deepEqual(advice.interest_signals, ['主动回问', '接住共同梗']);
  assert.deepEqual(advice.replies[0], { text: '感受到了，嘴硬但还挺会关心人' });
  assert.equal(advice.conversation_summary, '对方：你感受到我的了吗；我：好像遇到我你才对白由向往');
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
  assert.equal(advice.interest_level, '愿意接话');
  assert.equal(advice.interest_score, 76);
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

  assert.equal(advice.interest_score, 52);
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
  assert.deepEqual(repaired.replies[0], { text: '肚子和头一起疼也太难顶了' });
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
  assert.deepEqual(repairReplyCandidates(advice).replies[1], { text: '先躺会儿吧，作业晚点再说' });
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

test('flags long explanatory replies for a shorter human rewrite', () => {
  const advice = parseAdvice(JSON.stringify(adviceValue({
    replies: [
      { text: '因为你平时回我也不太积极，我就觉得你可能不想理我。' },
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
