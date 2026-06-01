import assert from 'node:assert/strict';
import test from 'node:test';

import handler, {
  FREE_MODELS,
  buildFreeTierFallbackAdvice,
  getRequestParts,
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
    suggest_stop: false,
    needs_retry: false,
    replies: [
      { tag: '自然真诚', text: '那你更喜欢甜一点还是清爽一点？' },
      { tag: '自然真诚', text: '奶茶先不急，你平时最常点什么？' },
      { tag: '自然真诚', text: '行，那我先记住你喜欢喝奶茶。' },
    ],
  }));

  assert.equal(advice.attitude_label, '愿意接话');
  assert.equal(advice.replies.length, 3);
});

test('validates uploaded screenshot format', () => {
  assert.equal(getRequestParts(requestBody).imagePart.source.media_type, 'image/png');
  assert.throws(
    () => getRequestParts({ messages: [{ content: [] }] }),
    /JPG、PNG 或 WEBP/,
  );
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
