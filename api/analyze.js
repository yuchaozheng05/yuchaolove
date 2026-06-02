const MODELS = ['gpt-4.1-mini'];
const ALLOWED_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_COUNT = 6;
const MAX_TOTAL_IMAGE_BASE64_LENGTH = 4_000_000;
const CHAT_ADVICE_SCHEMA = {
  type: 'object',
  properties: {
    attitude_label: { type: 'string' },
    attitude_desc: { type: 'string' },
    is_chat_screenshot: { type: 'boolean' },
    non_chat_reply: { type: 'string' },
    chat_evidence: {
      type: 'object',
      properties: {
        image_kind: { type: 'string' },
        has_message_bubbles: { type: 'boolean' },
        has_chat_ui: { type: 'boolean' },
        has_two_sided_layout: { type: 'boolean' },
      },
      required: ['image_kind', 'has_message_bubbles', 'has_chat_ui', 'has_two_sided_layout'],
    },
    conversation_summary: { type: 'string' },
    dialogue: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          side: { type: 'string', enum: ['left', 'right', 'feed'] },
          speaker: { type: 'string' },
          text: { type: 'string' },
        },
        required: ['side', 'speaker', 'text'],
      },
    },
    suggest_stop: { type: 'boolean' },
    needs_retry: { type: 'boolean' },
    replies: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tag: { type: 'string' },
          text: { type: 'string' },
        },
        required: ['tag', 'text'],
      },
    },
  },
  required: [
    'attitude_label',
    'attitude_desc',
    'is_chat_screenshot',
    'non_chat_reply',
    'chat_evidence',
    'conversation_summary',
    'dialogue',
    'suggest_stop',
    'needs_retry',
    'replies',
  ],
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: '分析服务尚未配置，请联系管理员。' });
  }

  try {
    const { imageParts, textPart } = getRequestParts(req.body);
    let lastError;

    for (const model of MODELS) {
      try {
        const rawText = await requestOpenAIAdvice({
          apiKey,
          model,
          imageParts,
          prompt: textPart.text,
        });
        const advice = parseAdvice(rawText);

        // Log usage asynchronously (don't block response)
        logUsage({ req, advice, imageParts, model }).catch(() => {});

        return res.status(200).json({
          content: [{ type: 'text', text: JSON.stringify(advice) }],
          model,
        });
      } catch (error) {
        lastError = error;
        console.warn(`OpenAI model ${model} failed: ${summarizeError(error)}`);
        if (!isRetryableModelError(error)) break;
      }
    }

    if (isRetryableModelError(lastError)) {
      const advice = buildFreeTierFallbackAdvice();
      return res.status(200).json({
        content: [{ type: 'text', text: JSON.stringify(advice) }],
        degraded: true,
        reason: 'service-unavailable',
      });
    }

    return res.status(502).json({ error: '分析服务暂时不可用，请稍后再试。' });
  } catch (error) {
    const status = error.statusCode || 400;
    return res.status(status).json({ error: error.publicMessage || '截图格式有问题，请重新上传后再试。' });
  }
}

function getRequestParts(body) {
  const payload = typeof body === 'string' ? JSON.parse(body) : body;
  const content = payload?.messages?.[0]?.content;
  if (!Array.isArray(content)) {
    throw createPublicError(400, '请求格式不正确，请重新上传截图。');
  }

  const imageParts = content.filter((part) => part.type === 'image');
  const textPart = content.find((part) => part.type === 'text');

  if (!imageParts.length || imageParts.length > MAX_IMAGE_COUNT) {
    throw createPublicError(400, `请上传 1 到 ${MAX_IMAGE_COUNT} 张聊天截图。`);
  }
  if (imageParts.some((part) => !ALLOWED_MEDIA_TYPES.has(part?.source?.media_type))) {
    throw createPublicError(400, '请上传 JPG、PNG 或 WEBP 格式的聊天截图。');
  }
  if (imageParts.some((part) => typeof part?.source?.data !== 'string' || !part.source.data)) {
    throw createPublicError(400, '截图内容无法读取，请重新上传。');
  }
  const totalImageLength = imageParts.reduce((sum, part) => sum + part.source.data.length, 0);
  if (totalImageLength > MAX_TOTAL_IMAGE_BASE64_LENGTH) {
    throw createPublicError(413, '截图总量较大，请减少张数或裁剪后再上传。');
  }
  if (!textPart?.text || typeof textPart.text !== 'string') {
    throw createPublicError(400, '分析说明缺失，请刷新页面后重试。');
  }

  return { imageParts, textPart };
}

async function requestOpenAIAdvice({ apiKey, model, imageParts, prompt }) {
  const imageMessages = imageParts.flatMap((imagePart, index) => [
    {
      type: 'text',
      text: `上传图片 ${index + 1}/${imageParts.length}。先判断它是否为聊天截图；多张有效聊天截图按此顺序从旧到新排列。`,
    },
    {
      type: 'image_url',
      image_url: {
        url: `data:${imagePart.source.media_type};base64,${imagePart.source.data}`,
        detail: 'high',
      },
    },
  ]);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: [...imageMessages, { type: 'text', text: prompt }] }],
      temperature: 0.35,
      max_tokens: 1600,
      response_format: { type: 'json_object' },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    const providerError = new Error(data.error?.message || `OpenAI request failed with ${response.status}`);
    providerError.providerStatus = response.status;
    providerError.providerCode = data.error?.code || '';
    throw providerError;
  }

  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    const emptyError = new Error('OpenAI returned an empty response');
    emptyError.providerStatus = 503;
    throw emptyError;
  }

  return text;
}

function parseAdvice(rawText) {
  const value = JSON.parse(extractFirstJsonObject(rawText));
  const replies = Array.isArray(value.replies)
    ? value.replies.map((reply) => ({ tag: cleanText(reply?.tag, 12), text: cleanText(reply?.text, 80) })).filter((reply) => reply.text).slice(0, 3)
    : [];
  const needsRetry = Boolean(value.needs_retry);
  const dialogue = normalizeDialogue(value.dialogue);
  const chatEvidence = normalizeChatEvidence(value.chat_evidence);
  const isChatScreenshot = isVerifiedChatScreenshot(value, dialogue, chatEvidence);
  const verifiedDialogue = isChatScreenshot ? dialogue : [];

  if (isChatScreenshot && !needsRetry && replies.length < 3) {
    const incompleteError = new Error('OpenAI returned fewer than three replies');
    incompleteError.providerStatus = 503;
    throw incompleteError;
  }

  return {
    attitude_label: isChatScreenshot ? cleanText(value.attitude_label, 12) || (needsRetry ? '截图不够清晰' : '态度待判断') : '这不是聊天截图',
    attitude_desc: (isChatScreenshot ? cleanText(value.attitude_desc, 180) : '') || (isChatScreenshot ? (needsRetry ? '这张截图暂时无法可靠读取，请换一张更清晰的截图后重试。' : '请结合对方后续行动继续观察。') : '我还没看到可以分析的聊天内容。'),
    is_chat_screenshot: isChatScreenshot,
    non_chat_reply: cleanText(value.non_chat_reply, 120) || (!isChatScreenshot ? getDefaultNonChatReply() : ''),
    chat_evidence: chatEvidence,
    conversation_summary: isChatScreenshot ? buildDialogueSummary(verifiedDialogue) || cleanText(value.conversation_summary, 260) : '',
    dialogue: verifiedDialogue,
    suggest_stop: isChatScreenshot && (Boolean(value.suggest_stop) || hasRepeatedColdReplies(verifiedDialogue)),
    needs_retry: isChatScreenshot && needsRetry,
    replies: isChatScreenshot ? replies : [],
  };
}

function extractFirstJsonObject(rawText) {
  const cleaned = rawText.replace(/```json|```/gi, '').trim();
  const start = cleaned.indexOf('{');
  if (start < 0) throw new Error('OpenAI returned invalid JSON');
  let depth = 0, inString = false, isEscaped = false;
  for (let index = start; index < cleaned.length; index += 1) {
    const character = cleaned[index];
    if (inString) {
      if (isEscaped) { isEscaped = false; } else if (character === '\\') { isEscaped = true; } else if (character === '"') { inString = false; }
      continue;
    }
    if (character === '"') { inString = true; } else if (character === '{') { depth += 1; } else if (character === '}') { depth -= 1; if (depth === 0) return cleaned.slice(start, index + 1); }
  }
  throw new Error('OpenAI returned invalid JSON');
}

function buildFreeTierFallbackAdvice() {
  return { attitude_label: '服务暂时繁忙', attitude_desc: '当前分析服务暂时不可用。为了避免给你不准确的建议，本次不会猜测截图内容，请稍后点击"重新分析"。', is_chat_screenshot: true, non_chat_reply: '', chat_evidence: {}, conversation_summary: '', dialogue: [], suggest_stop: false, needs_retry: true, degraded: true, replies: [] };
}

function isRetryableModelError(error) {
  if (!error) return false;
  if ([408, 429, 500, 502, 503, 504].includes(error.providerStatus)) return true;
  return /quota|rate limit|resource exhausted|temporarily|overload|invalid json|empty response|fewer than three/i.test(error.message || '');
}

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function getDefaultNonChatReply() {
  return '这张图挺有故事，但我还没看到你们聊天。换张聊天截图，我再帮你读空气。';
}

function normalizeDialogue(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.map((message) => {
    const side = ['left', 'right', 'feed'].includes(message?.side) ? message.side : '';
    const text = cleanText(message?.text, 100);
    if (!side || !text || isHelperText(text)) return null;
    if (side === 'feed') {
      const speaker = message?.speaker === '对方' || message?.speaker === '我' ? message.speaker : '';
      return speaker ? { side, speaker, text } : null;
    }
    return { side, speaker: side === 'left' ? '对方' : '我', text };
  }).filter(Boolean).slice(-20);
}

function buildDialogueSummary(dialogue) {
  return dialogue.slice(-8).map((message) => `${message.speaker}：${message.text}`).join('；').slice(0, 260);
}

function hasRepeatedColdReplies(dialogue) {
  const recentReplies = dialogue.filter((message) => message.speaker === '对方').slice(-3);
  return recentReplies.length === 3 && recentReplies.every((message) => message.text.length <= 6 && !/[?？]/.test(message.text));
}

function normalizeChatEvidence(evidence) {
  return { image_kind: cleanText(evidence?.image_kind, 24), has_message_bubbles: evidence?.has_message_bubbles === true, has_chat_ui: evidence?.has_chat_ui === true, has_two_sided_layout: evidence?.has_two_sided_layout === true };
}

function isVerifiedChatScreenshot(value, dialogue, evidence) {
  const hasTwoSidedDialogue = dialogue.some((message) => message.side === 'left') && dialogue.some((message) => message.side === 'right');
  const hasVisualEvidence = evidence.has_message_bubbles || evidence.has_chat_ui || (evidence.has_two_sided_layout && hasTwoSidedDialogue);
  if (!hasVisualEvidence || dialogue.length < 2) return false;
  if (value.is_chat_screenshot === false && !hasTwoSidedDialogue) return false;
  return true;
}

function isHelperText(text) {
  return /左侧气泡|右侧气泡|对方发出|我发出|顺序从旧到新/.test(text);
}

function summarizeError(error) {
  return `${error?.providerStatus || 'unknown'} ${cleanText(error?.message || 'Unknown error', 180)}`;
}

function createPublicError(statusCode, publicMessage) {
  const error = new Error(publicMessage);
  error.statusCode = statusCode;
  error.publicMessage = publicMessage;
  return error;
}

async function logUsage({ req, advice, imageParts }) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) return;

  try {
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    const country = req.headers['x-vercel-ip-country'] || 'unknown';
    const city = decodeURIComponent(req.headers['x-vercel-ip-city'] || 'unknown');
    const userAgent = req.headers['user-agent'] || 'unknown';

    const imageUrls = [];
    for (let i = 0; i < imageParts.length; i++) {
      const part = imageParts[i];
      const ext = part.source.media_type.split('/')[1] || 'jpg';
      const filename = `${Date.now()}-${i}.${ext}`;
      const buffer = Buffer.from(part.source.data, 'base64');
      const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/screenshots/${filename}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': part.source.media_type },
        body: buffer,
      });
      if (uploadRes.ok) {
        imageUrls.push(`${supabaseUrl}/storage/v1/object/authenticated/screenshots/${filename}`);
      }
    }

    await fetch(`${supabaseUrl}/rest/v1/usage_logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey },
      body: JSON.stringify({ ip, country, city, user_agent: userAgent, attitude_label: advice.attitude_label, attitude_desc: advice.attitude_desc, replies: advice.replies, image_urls: imageUrls }),
    });
  } catch (err) {
    console.warn('logUsage failed:', err.message);
  }
}

export { CHAT_ADVICE_SCHEMA, MODELS, buildFreeTierFallbackAdvice, extractFirstJsonObject, getRequestParts, hasRepeatedColdReplies, isRetryableModelError, isVerifiedChatScreenshot, normalizeDialogue, normalizeChatEvidence, parseAdvice, requestOpenAIAdvice };
