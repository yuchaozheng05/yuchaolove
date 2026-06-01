const FREE_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];
const ALLOWED_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BASE64_LENGTH = 14_000_000;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: '分析服务尚未配置，请联系管理员。' });
  }

  try {
    const { imagePart, textPart } = getRequestParts(req.body);
    let lastError;

    for (const model of FREE_MODELS) {
      try {
        const rawText = await requestGeminiAdvice({
          apiKey,
          model,
          imagePart,
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

  const imagePart = content.find((part) => part.type === 'image');
  const textPart = content.find((part) => part.type === 'text');
  const mediaType = imagePart?.source?.media_type;
  const imageData = imagePart?.source?.data;

  if (!ALLOWED_MEDIA_TYPES.has(mediaType) || typeof imageData !== 'string' || !imageData) {
    throw createPublicError(400, '请上传 JPG、PNG 或 WEBP 格式的聊天截图。');
  }
  if (imageData.length > MAX_IMAGE_BASE64_LENGTH) {
    throw createPublicError(413, '截图太大，请上传 10MB 以内的图片。');
  }
  if (!textPart?.text || typeof textPart.text !== 'string') {
    throw createPublicError(400, '分析说明缺失，请刷新页面后重试。');
  }

  return { imagePart, textPart };
}

async function requestGeminiAdvice({ apiKey, model, imagePart, prompt }) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inline_data: {
                mime_type: imagePart.source.media_type,
                data: imagePart.source.data,
              },
            },
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
  const cleaned = rawText.replace(/```json|```/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('Gemini returned invalid JSON');
  }

  const value = JSON.parse(cleaned.slice(start, end + 1));
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

  if (!needsRetry && replies.length < 3) {
    const incompleteError = new Error('Gemini returned fewer than three replies');
    incompleteError.providerStatus = 503;
    throw incompleteError;
  }

  return {
    attitude_label: cleanText(value.attitude_label, 12) || (needsRetry ? '截图不够清晰' : '态度待判断'),
    attitude_desc:
      cleanText(value.attitude_desc, 180)
      || (needsRetry ? '这张截图暂时无法可靠读取，请换一张更清晰的截图后重试。' : '请结合对方后续行动继续观察。'),
    suggest_stop: Boolean(value.suggest_stop),
    needs_retry: needsRetry,
    replies,
  };
}

function buildFreeTierFallbackAdvice() {
  return {
    attitude_label: '免费通道繁忙',
    attitude_desc: '当前免费分析额度暂时不可用。为了避免给你不准确的建议，本次不会猜测截图内容，请稍后点击“重新分析”。',
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
  getRequestParts,
  isRetryableModelError,
  parseAdvice,
  requestGeminiAdvice,
};
