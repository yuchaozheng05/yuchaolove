import assert from 'node:assert/strict';
import test from 'node:test';

import handler, {
  FREE_MODELS,
  buildFreeTierFallbackAdvice,
  getRequestParts,
  normalizeDialogue,
  parseAdvice,
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

test('uses stable free multimodal models in order', () => {
  assert.deepEqual(FREE_MODELS, ['gemini-2.5-flash-lite', 'gemini-2.5-flash']);
});

test('parses a complete advice response', () => {
  const advice = parseAdvice(JSON.stringify({
    attitude_label: '愿意接话',
    attitude_desc: '对方有回应，也留下了新话题。',
    chat_evidence: {
      image_kind: 'chat',
      has_message_bubbles: true,
      has_chat_ui: true,
      has_two_sided_layout: true,
    },
    conversation_summary: '这段摘要会被几何位置覆盖',
    dialogue: [
      { side: 'left', speaker: '我', text: '可以呀' },
      { side: 'right', speaker: '对方', text: '那你更喜欢哪一种？' },
    ],
    suggest_stop: false,
    needs_retry: false,
    replies: [
      { tag: '自然真诚', text: '那你更喜欢甜一点还是清爽一点？' },
      { tag: '自然真诚', text: '奶茶先不急，你平时最常点什么？' },
      { tag: '自然真诚', text: '行，那我先记住你喜欢喝奶茶。' },
    ],
  }));

  assert.equal(advice.attitude_label, '愿意接话');
  assert.equal(advice.conversation_summary, '对方：可以呀；我：那你更喜欢哪一种？');
  assert.deepEqual(advice.dialogue.map((message) => message.speaker), ['对方', '我']);
  assert.equal(advice.replies.length, 3);
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

test('returns a playful redirect for non-chat images without inventing replies', () => {
  const advice = parseAdvice(JSON.stringify({
    attitude_label: '不是聊天截图',
    attitude_desc: '这是一张风景照，没有聊天气泡。',
    is_chat_screenshot: false,
    non_chat_reply: '这张风景很适合发朋友圈，但我还没看到聊天记录。',
    conversation_summary: '',
    dialogue: [{ side: 'left', speaker: '对方', text: '被模型误认成聊天的文字' }],
    suggest_stop: true,
    needs_retry: false,
    replies: [{ tag: '自然真诚', text: '这条虚构回复不应该出现' }],
  }));

  assert.equal(advice.is_chat_screenshot, false);
  assert.equal(advice.non_chat_reply, '这张风景很适合发朋友圈，但我还没看到聊天记录。');
  assert.deepEqual(advice.dialogue, []);
  assert.equal(advice.suggest_stop, false);
  assert.deepEqual(advice.replies, []);
});

test('rejects fake chat results that only contain helper text', () => {
  const advice = parseAdvice(JSON.stringify({
    is_chat_screenshot: true,
    chat_evidence: {
      image_kind: 'document',
      has_message_bubbles: false,
      has_chat_ui: false,
      has_two_sided_layout: false,
    },
    dialogue: [
      { side: 'left', speaker: '对方', text: '左侧气泡 = 对方发出' },
      { side: 'right', speaker: '我', text: '右侧气泡 = 我发出' },
    ],
    replies: [
      { tag: '自然真诚', text: '虚构回复 1' },
      { tag: '自然真诚', text: '虚构回复 2' },
      { tag: '自然真诚', text: '虚构回复 3' },
    ],
  }));

  assert.equal(advice.is_chat_screenshot, false);
  assert.equal(advice.attitude_label, '这不是聊天截图');
  assert.deepEqual(advice.dialogue, []);
  assert.deepEqual(advice.replies, []);
});

test('rejects document text even if the model tries to format it as dialogue', () => {
  const advice = parseAdvice(JSON.stringify({
    attitude_label: '认真求助',
    attitude_desc: '对方正在布置作业。',
    is_chat_screenshot: true,
    chat_evidence: {
      image_kind: 'homework document',
      has_message_bubbles: false,
      has_chat_ui: false,
      has_two_sided_layout: false,
    },
    dialogue: [
      { side: 'left', speaker: '对方', text: 'Image classification using MLP and MNIST Dataset' },
      { side: 'right', speaker: '我', text: 'Write down the loss function' },
    ],
    suggest_stop: false,
    needs_retry: false,
    replies: [
      { tag: '温暖体贴', text: '收到！这个作业看起来很有挑战性。' },
      { tag: '温暖体贴', text: '我会认真完成的。' },
      { tag: '温暖体贴', text: '有什么需要注意的吗？' },
    ],
  }));

  assert.equal(advice.is_chat_screenshot, false);
  assert.equal(advice.attitude_label, '这不是聊天截图');
  assert.equal(advice.attitude_desc, '我还没看到可以分析的聊天内容。');
  assert.deepEqual(advice.dialogue, []);
  assert.deepEqual(advice.replies, []);
});

test('validates uploaded screenshot format', () => {
  assert.equal(getRequestParts(requestBody).imageParts[0].source.media_type, 'image/png');
  assert.throws(
    () => getRequestParts({ messages: [{ content: [] }] }),
    /1 到 6 张/,
  );
  assert.throws(
    () => getRequestParts({
      messages: [{
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/gif', data: 'aGVsbG8=' } },
          { type: 'text', text: 'Analyze this screenshot.' },
        ],
      }],
    }),
    /JPG、PNG 或 WEBP/,
  );
});

test('passes multiple screenshots to Gemini in chronological order', async () => {
  const originalFetch = global.fetch;
  let requestPayload;
  global.fetch = async (_url, options) => {
    requestPayload = JSON.parse(options.body);
    return jsonResponse(200, geminiAdviceResponse());
  };

  try {
    const { requestGeminiAdvice } = await import('../api/analyze.js');
    const imageParts = [
      requestBody.messages[0].content[0],
      {
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: 'd29ybGQ=' },
      },
    ];
    await requestGeminiAdvice({
      apiKey: 'test-key',
      model: 'gemini-2.5-flash-lite',
      imageParts,
      prompt: 'Analyze screenshots.',
    });

    const parts = requestPayload.contents[0].parts;
    assert.equal(parts[0].text, '聊天截图 1/2，顺序从旧到新。');
    assert.equal(parts[1].inline_data.mime_type, 'image/png');
    assert.equal(parts[2].text, '聊天截图 2/2，顺序从旧到新。');
    assert.equal(parts[3].inline_data.mime_type, 'image/jpeg');
    assert.equal(parts[4].text, 'Analyze screenshots.');
  } finally {
    global.fetch = originalFetch;
  }
});

test('falls back to the second free model after a quota error', async () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-key';
  const calledModels = [];
  global.fetch = async (url) => {
    calledModels.push(url);
    if (calledModels.length === 1) {
      return jsonResponse(429, { error: { status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded' } });
    }
    return jsonResponse(200, geminiAdviceResponse());
  };

  try {
    const response = createResponseRecorder();
    await handler({ method: 'POST', body: requestBody }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.model, 'gemini-2.5-flash');
    assert.equal(calledModels.length, 2);
  } finally {
    global.fetch = originalFetch;
    restoreApiKey(originalApiKey);
  }
});

test('returns an honest retry result if every free model is unavailable', async () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-key';
  global.fetch = async () => jsonResponse(429, {
    error: { status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded' },
  });

  try {
    const response = createResponseRecorder();
    await handler({ method: 'POST', body: requestBody }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.degraded, true);
    assert.deepEqual(JSON.parse(response.body.content[0].text), buildFreeTierFallbackAdvice());
  } finally {
    global.fetch = originalFetch;
    restoreApiKey(originalApiKey);
  }
});

function geminiAdviceResponse() {
  return {
    candidates: [{
      content: {
        parts: [{
          text: JSON.stringify({
            attitude_label: '自然互动',
            attitude_desc: '对方仍然愿意交流，可以继续轻松聊。',
            is_chat_screenshot: true,
            non_chat_reply: '',
            chat_evidence: {
              image_kind: 'chat',
              has_message_bubbles: true,
              has_chat_ui: true,
              has_two_sided_layout: true,
            },
            conversation_summary: '对方：最近还好；我：那你平时喜欢做什么？',
            dialogue: [
              { side: 'left', speaker: '对方', text: '最近还好' },
              { side: 'right', speaker: '我', text: '那你平时喜欢做什么？' },
            ],
            suggest_stop: false,
            needs_retry: false,
            replies: [
              { tag: '自然真诚', text: '那你平时最喜欢喝什么？' },
              { tag: '自然真诚', text: '这个话题先留着，下次继续。' },
              { tag: '自然真诚', text: '听起来还不错，你会怎么选？' },
            ],
          }),
        }],
      },
    }],
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

function restoreApiKey(value) {
  if (value === undefined) {
    delete process.env.GEMINI_API_KEY;
  } else {
    process.env.GEMINI_API_KEY = value;
  }
}
