const FREE_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];
const ALLOWED_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_COUNT = 6;
const MAX_TOTAL_IMAGE_BASE64_LENGTH = 4_000_000;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: '分析服务尚未配置，请联系管理员。' });
  }

  try {
    const { imageParts, textPart } = getRequestParts(req.body);
    let lastError;

    for (const model of FREE_MODELS) {
      try {
        const rawText = await requestGeminiAdvice({
          apiKey,
          model,
          imageParts,
          prompt: textPart.text,
        });
        const advice = parseAdvice(rawText);

        return res.status(200).json({
          content: [{ type: 'text', text: JSON.stringify(advice) }],
          model,
        });
      } catch (error) {
        lastError = error;
        console.warn(`Gemini model ${model} failed: ${summarizeError(error)}`);
        if (!isRetryableModelError(error)) break;
      }
    }

    if (isRetryableModelError(lastError)) {
      const advice = buildFreeTierFallbackAdvice();
      return res.status(200).json({
        content: [{ type: 'text', text: JSON.stringify(advice) }],
        degraded: true,
        reason: 'free-tier-unavailable',
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

async function requestGeminiAdvice({ apiKey, model, imageParts, prompt }) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            ...imageParts.flatMap((imagePart, index) => [
              { text: `聊天截图 ${index + 1}/${imageParts.length}，顺序从旧到新。` },
              {
                inline_data: {
                  mime_type: imagePart.source.media_type,
                  data: imagePart.source.data,
                },
              },
            ]),
            { text: prompt },
          ],
        }],
        generationConfig: {
          temperature: 0.45,
          maxOutputTokens: 1000,
          responseMimeType: 'application/json',
        },
      }),
    },
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    const providerError = new Error(data.error?.message || `Gemini request failed with ${response.status}`);
    providerError.providerStatus = response.status;
    providerError.providerCode = data.error?.status || '';
    throw providerError;
  }

  const text = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || '')
    .join('')
    .trim();
  if (!text) {
    const emptyError = new Error('Gemini returned an empty response');
    emptyError.providerStatus = 503;
    throw emptyError;
  }

  return text;
}

function parseAdvice(rawText) {
  const value = JSON.parse(extractFirstJsonObject(rawText));
  const replies = Array.isArray(value.replies)
    ? value.replies
        .map((reply) => ({
          tag: cleanText(reply?.tag, 12),
          text: cleanText(reply?.text, 80),
        }))
        .filter((reply) => reply.text)
        .slice(0, 3)
    : [];
  const needsRetry = Boolean(value.needs_retry);
  const dialogue = normalizeDialogue(value.dialogue);
  const chatEvidence = normalizeChatEvidence(value.chat_evidence);
  const isChatScreenshot = isVerifiedChatScreenshot(value, dialogue, chatEvidence);
  const verifiedDialogue = isChatScreenshot ? dialogue : [];

  if (isChatScreenshot && !needsRetry && replies.length < 3) {
    const incompleteError = new Error('Gemini returned fewer than three replies');
    incompleteError.providerStatus = 503;
    throw incompleteError;
  }

  return {
    attitude_label: isChatScreenshot
      ? cleanText(value.attitude_label, 12) || (needsRetry ? '截图不够清晰' : '态度待判断')
      : '这不是聊天截图',
    attitude_desc:
      (isChatScreenshot ? cleanText(value.attitude_desc, 180) : '')
      || (isChatScreenshot
        ? needsRetry
          ? '这张截图暂时无法可靠读取，请换一张更清晰的截图后重试。'
          : '请结合对方后续行动继续观察。'
        : '我还没看到可以分析的聊天内容。'),
    is_chat_screenshot: isChatScreenshot,
    non_chat_reply: cleanText(value.non_chat_reply, 120) || (!isChatScreenshot ? getDefaultNonChatReply() : ''),
    chat_evidence: chatEvidence,
    conversation_summary: isChatScreenshot
      ? buildDialogueSummary(verifiedDialogue) || cleanText(value.conversation_summary, 260)
      : '',
    dialogue: verifiedDialogue,
    suggest_stop: isChatScreenshot && Boolean(value.suggest_stop),
    needs_retry: isChatScreenshot && needsRetry,
    replies: isChatScreenshot ? replies : [],
  };
}

function extractFirstJsonObject(rawText) {
  const cleaned = rawText.replace(/```json|```/gi, '').trim();
  const start = cleaned.indexOf('{');
  if (start < 0) throw new Error('Gemini returned invalid JSON');

  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let index = start; index < cleaned.length; index += 1) {
    const character = cleaned[index];
    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (character === '\\') {
        isEscaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
      if (depth === 0) return cleaned.slice(start, index + 1);
    }
  }

  throw new Error('Gemini returned invalid JSON');
}

function buildFreeTierFallbackAdvice() {
  return {
    attitude_label: '免费通道繁忙',
    attitude_desc: '当前免费分析额度暂时不可用。为了避免给你不准确的建议，本次不会猜测截图内容，请稍后点击“重新分析”。',
    is_chat_screenshot: true,
    non_chat_reply: '',
    chat_evidence: {},
    conversation_summary: '',
    dialogue: [],
    suggest_stop: false,
    needs_retry: true,
    degraded: true,
    replies: [],
  };
}

function isRetryableModelError(error) {
  if (!error) return false;
  if ([408, 429, 500, 502, 503, 504].includes(error.providerStatus)) return true;
  return /quota|rate limit|resource exhausted|temporarily|overload|invalid json|empty response|fewer than three/i.test(
    error.message || '',
  );
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

  return messages
    .map((message) => {
      const side = message?.side === 'left' || message?.side === 'right' ? message.side : '';
      const text = cleanText(message?.text, 100);
      if (!side || !text || isHelperText(text)) return null;
      return { side, speaker: side === 'left' ? '对方' : '我', text };
    })
    .filter(Boolean)
    .slice(-20);
}

function buildDialogueSummary(dialogue) {
  return dialogue
    .slice(-8)
    .map((message) => `${message.speaker}：${message.text}`)
    .join('；')
    .slice(0, 260);
}

function normalizeChatEvidence(evidence) {
  return {
    image_kind: cleanText(evidence?.image_kind, 24),
    has_message_bubbles: evidence?.has_message_bubbles === true,
    has_chat_ui: evidence?.has_chat_ui === true,
    has_two_sided_layout: evidence?.has_two_sided_layout === true,
  };
}

function isVerifiedChatScreenshot(value, dialogue, evidence) {
  if (value.is_chat_screenshot === false) return false;
  if (!evidence.has_message_bubbles && !evidence.has_chat_ui) return false;
  return dialogue.length >= 2;
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

export {
  FREE_MODELS,
  buildFreeTierFallbackAdvice,
  extractFirstJsonObject,
  getRequestParts,
  isRetryableModelError,
  isVerifiedChatScreenshot,
  normalizeDialogue,
  normalizeChatEvidence,
  parseAdvice,
  requestGeminiAdvice,
};
