const MODELS = ['gpt-4.1-mini'];
const ALLOWED_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_COUNT = 6;
const MAX_TOTAL_IMAGE_BASE64_LENGTH = 4_000_000;
const EMOTIONAL_DISCLOSURE_PATTERN = /困死|好困|太困|困了|很困|累死|好累|太累|累了|很累|疼|痛|难受|不舒服|烦|焦虑|压力|不想上学|不想去|没写完|睡不着|崩溃|想哭|生病|发烧|胃疼|肚子疼|头疼/;
const PHYSICAL_DISCOMFORT_PATTERN = /疼|痛|难受|不舒服|生病|发烧|胃疼|肚子疼|头疼/;
const REPLY_COACH_SYSTEM_PROMPT = `你是中文聊天回复顾问。你的目标不是替用户表白，也不是输出礼貌客服话术，而是根据整段对话判断对方真实意愿，再给出自然、可发送、容易接住的回复。

生成回复时遵守这些规则：
- 先判断对方是否在主动回球：主动提问、连续发多条、延伸话题、接梗、使用表情包、回看前文、关心用户、轻微调侃，都是积极信号。单纯回复不等于有好感。
- 区分“连续敷衍”和“连续倾诉”。对方连发多条，说困、累、疼、不舒服、压力、烦躁或学习状态，并补充表情包时，是在释放情绪和信任，不是冷淡短回，也不等于已经暧昧。
- 回复延迟只能作为弱信号，不要因为晚回一次就下结论。
- 暧昧必须有依据。对方只是礼貌回应时保持轻松；对方愿意接话时可以轻微暧昧；对方主动回球时可以自然升温；对方连续敷衍时停止加码。
- 回复像真人发微信：短、具体、有一点个性。优先接住对方最后一句，同时借用整段聊天里的共同梗、昵称、细节或情绪。
- 候选回复永远是用户准备发送给对方的话。严格站在“我”的视角，不要把谁关心谁、谁哄谁、谁问谁理解反。
- 一条回复只放一个重点。避免采访式连环提问、空泛关心、突然邀约、过度承诺、强行自恋和油腻土味情话。
- 生成 3 到 5 条候选，最多一条使用问号。至少两条是可以直接发送的自然陈述。不要把对方原句重复一遍再反问。
- flirt_level 是暧昧上限，不是必须完成的任务。对方只是认真提问、澄清或解释时，先正常回答，不要为了暧昧而绕开问题。
- 如果对方最后一句在问“为什么”“怎么知道”“怎么确定”或类似澄清问题，至少两条候选要真正回应问题，不要全部改成调情、卖关子或反问。
- 轻松聊天里的追问，不要写成长解释、情感分析或辩解。优先简短承认误判，再自然接住对方。不要编造截图里没有出现的“回复慢”“不积极”等依据。
- 对方在倾诉难受时，先像朋友一样接住情绪。不要说教，不要连续叮嘱，不要强行暧昧，也不要写成客服式关怀或健康提醒作文。
- 除了回复候选，还要给用户一条可以照着走的聊天路线：现在先做什么、后续怎么展开、什么不要做。每一步不是让用户一次发完，而是根据对方回应逐步推进。
- 少用“听起来”“感觉你”“那你平时”“有需要告诉我”“调整好状态”“看来”这类模板句。
- 候选要自然、有变化，但不要给每条回复套风格标签。`;

const REPLY_PERSPECTIVE_EXAMPLES = `【视角示例，只学习尺度和方向，不要照抄】
- 对方说“那你要我怎么哄”，是对方问应该如何哄我。可以回“先夸我两句，我看看诚意”，不要回“哄你？”
- 对方说“你感受到我的了吗”，可以回“感受到一点，再表现两集看看”。
- 对方说“我一直都在关心你啊”，可以回“那我先给你记一分”。
- 对方说“你不是说我很难懂吗，那你怎么就确定了呢”，是在追问判断依据。可以回“我瞎猜的，撤回刚刚那句”或“那我判断错了，你还是愿意理我的”。不要回“让我观察你这个难懂的秘密”。
- 对方连续说“困死了”“肚子疼头也疼”“不想上学”并发了表情包，是在倾诉，不是敷衍。可以回“肚子和头一起疼也太难顶了”或“先躺会儿吧，作业晚点再说”。不要触发止损，也不要教育她不要熬夜。
- 对方连续只回“嗯”“不知道”“玩手机”，不要硬撩，建议先停一下。`;
const CHAT_ADVICE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    attitude_label: { type: 'string' },
    attitude_desc: { type: 'string' },
    interest_score: { type: 'integer', minimum: 0, maximum: 100 },
    interest_level: {
      type: 'string',
      enum: ['低意愿', '礼貌回应', '愿意接话', '轻微好感', '主动升温'],
    },
    interest_signals: {
      type: 'array',
      items: { type: 'string' },
    },
    conversation_mode: {
      type: 'string',
      enum: ['冷淡敷衍', '礼貌回应', '愿意接话', '主动了解', '情绪倾诉', '轻松暧昧'],
    },
    reply_strategy: { type: 'string' },
    flirt_level: {
      type: 'string',
      enum: ['先别暧昧', '轻松接话', '轻微暧昧', '自然升温'],
    },
    is_chat_screenshot: { type: 'boolean' },
    non_chat_reply: { type: 'string' },
    chat_evidence: {
      type: 'object',
      additionalProperties: false,
      properties: {
        image_kind: { type: 'string' },
        has_message_bubbles: { type: 'boolean' },
        has_chat_ui: { type: 'boolean' },
        has_two_sided_layout: { type: 'boolean' },
      },
      required: ['image_kind', 'has_message_bubbles', 'has_chat_ui', 'has_two_sided_layout'],
    },
    conversation_summary: { type: 'string' },
    chat_guide: {
      type: 'object',
      additionalProperties: false,
      properties: {
        current_move: { type: 'string' },
        next_steps: {
          type: 'array',
          items: { type: 'string' },
        },
        avoid: { type: 'string' },
      },
      required: ['current_move', 'next_steps', 'avoid'],
    },
    dialogue: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
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
        additionalProperties: false,
        properties: {
          text: { type: 'string' },
        },
        required: ['text'],
      },
    },
  },
  required: [
    'attitude_label',
    'attitude_desc',
    'interest_score',
    'interest_level',
    'interest_signals',
    'conversation_mode',
    'reply_strategy',
    'flirt_level',
    'is_chat_screenshot',
    'non_chat_reply',
    'chat_evidence',
    'conversation_summary',
    'chat_guide',
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
        let advice = parseAdvice(rawText);

        if (needsReplyRefinement(advice)) {
          try {
            const refinedText = await requestOpenAIAdvice({
              apiKey,
              model,
              imageParts,
              prompt: buildReplyRefinementPrompt(textPart.text, advice),
            });
            const refinedAdvice = parseAdvice(refinedText);
            advice = needsReplyRefinement(refinedAdvice)
              ? repairReplyCandidates(refinedAdvice)
              : refinedAdvice;
          } catch (error) {
            console.warn(`OpenAI reply refinement failed: ${summarizeError(error)}`);
            advice = repairReplyCandidates(advice);
          }
        }

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
      messages: [
        { role: 'system', content: `${REPLY_COACH_SYSTEM_PROMPT}\n\n${REPLY_PERSPECTIVE_EXAMPLES}` },
        { role: 'user', content: [...imageMessages, { type: 'text', text: prompt }] },
      ],
      temperature: 0.55,
      max_tokens: 2200,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'chat_advice',
          strict: true,
          schema: CHAT_ADVICE_SCHEMA,
        },
      },
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
    ? value.replies
        .map((reply) => ({
          text: cleanText(reply?.text, 80),
        }))
        .filter((reply) => reply.text)
        .slice(0, 5)
    : [];
  const needsRetry = Boolean(value.needs_retry);
  const dialogue = normalizeDialogue(value.dialogue);
  const chatEvidence = normalizeChatEvidence(value.chat_evidence);
  const isChatScreenshot = isVerifiedChatScreenshot(value, dialogue, chatEvidence);
  const verifiedDialogue = isChatScreenshot ? dialogue : [];
  const emotionalDisclosure = isChatScreenshot && hasRecentEmotionalDisclosure(verifiedDialogue);

  if (isChatScreenshot && !needsRetry && replies.length < 3 && !emotionalDisclosure) {
    const incompleteError = new Error('OpenAI returned fewer than three replies');
    incompleteError.providerStatus = 503;
    throw incompleteError;
  }

  return {
    attitude_label: isChatScreenshot ? (emotionalDisclosure ? '愿意倾诉' : cleanText(value.attitude_label, 12) || (needsRetry ? '截图不够清晰' : '态度待判断')) : '这不是聊天截图',
    attitude_desc: emotionalDisclosure
      ? '对方在连续表达自己的疲惫、不舒服或压力，也愿意补充细节。这是在向你倾诉，不是敷衍，但目前更适合先接住情绪，不急着升温。'
      : (isChatScreenshot ? cleanText(value.attitude_desc, 180) : '') || (isChatScreenshot ? (needsRetry ? '这张截图暂时无法可靠读取，请换一张更清晰的截图后重试。' : '请结合对方后续行动继续观察。') : '我还没看到可以分析的聊天内容。'),
    interest_score: isChatScreenshot ? (emotionalDisclosure ? Math.max(52, clampScore(value.interest_score)) : clampScore(value.interest_score)) : 0,
    interest_level: isChatScreenshot ? (emotionalDisclosure ? '愿意接话' : normalizeInterestLevel(value.interest_level)) : '低意愿',
    interest_signals: isChatScreenshot ? (emotionalDisclosure ? buildEmotionalDisclosureSignals(verifiedDialogue) : normalizeSignals(value.interest_signals)) : [],
    conversation_mode: isChatScreenshot ? (emotionalDisclosure ? '情绪倾诉' : normalizeConversationMode(value.conversation_mode)) : '礼貌回应',
    reply_strategy: isChatScreenshot ? (emotionalDisclosure ? '先回应她现在的不舒服，给她一点喘息空间，等她愿意继续说再慢慢接话。' : cleanText(value.reply_strategy, 100)) : '',
    flirt_level: isChatScreenshot ? (emotionalDisclosure ? '先别暧昧' : normalizeFlirtLevel(value.flirt_level)) : '先别暧昧',
    is_chat_screenshot: isChatScreenshot,
    non_chat_reply: cleanText(value.non_chat_reply, 120) || (!isChatScreenshot ? getDefaultNonChatReply() : ''),
    chat_evidence: chatEvidence,
    conversation_summary: isChatScreenshot ? buildDialogueSummary(verifiedDialogue) || cleanText(value.conversation_summary, 260) : '',
    chat_guide: isChatScreenshot ? (emotionalDisclosure ? buildEmotionalDisclosureGuide() : normalizeChatGuide(value.chat_guide)) : buildDefaultChatGuide(),
    dialogue: verifiedDialogue,
    suggest_stop: isChatScreenshot && !emotionalDisclosure && (Boolean(value.suggest_stop) || hasRepeatedColdReplies(verifiedDialogue)),
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
  return { attitude_label: '服务暂时繁忙', attitude_desc: '当前分析服务暂时不可用。为了避免给你不准确的建议，本次不会猜测截图内容，请稍后点击"重新分析"。', interest_score: 0, interest_level: '低意愿', interest_signals: [], conversation_mode: '礼貌回应', reply_strategy: '', flirt_level: '先别暧昧', is_chat_screenshot: true, non_chat_reply: '', chat_evidence: {}, conversation_summary: '', chat_guide: buildDefaultChatGuide(), dialogue: [], suggest_stop: false, needs_retry: true, degraded: true, replies: [] };
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

function clampScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeInterestLevel(value) {
  return ['低意愿', '礼貌回应', '愿意接话', '轻微好感', '主动升温'].includes(value) ? value : '愿意接话';
}

function normalizeFlirtLevel(value) {
  return ['先别暧昧', '轻松接话', '轻微暧昧', '自然升温'].includes(value) ? value : '轻松接话';
}

function normalizeConversationMode(value) {
  return ['冷淡敷衍', '礼貌回应', '愿意接话', '主动了解', '情绪倾诉', '轻松暧昧'].includes(value) ? value : '愿意接话';
}

function normalizeSignals(signals) {
  if (!Array.isArray(signals)) return [];
  return signals.map((signal) => cleanText(signal, 28)).filter(Boolean).slice(0, 4);
}

function normalizeChatGuide(guide) {
  const normalized = {
    current_move: cleanText(guide?.current_move, 80),
    next_steps: Array.isArray(guide?.next_steps)
      ? guide.next_steps.map((step) => cleanText(step, 80)).filter(Boolean).slice(0, 4)
      : [],
    avoid: cleanText(guide?.avoid, 80),
  };
  const fallback = buildDefaultChatGuide();
  return {
    current_move: normalized.current_move || fallback.current_move,
    next_steps: normalized.next_steps.length ? normalized.next_steps : fallback.next_steps,
    avoid: normalized.avoid || fallback.avoid,
  };
}

function buildDefaultChatGuide() {
  return {
    current_move: '先接住对方最后一句，再顺着一个细节展开。',
    next_steps: [
      '一次只聊一个点，等对方回应再往下走。',
      '对方愿意回问时，再从兴趣自然延伸到更具体的话题。',
      '互动顺畅后，再考虑轻松邀约。',
    ],
    avoid: '不要连续发问，也不要突然硬撩。',
  };
}

function buildEmotionalDisclosureGuide() {
  return {
    current_move: '先回应她现在的不舒服，不急着讲道理或换话题。',
    next_steps: [
      '先发一句短关心，让她感觉被接住。',
      '她愿意继续说时，再问一句她现在更想休息、吐槽还是有人陪聊。',
      '等她状态缓一点，再自然聊轻松的话题。',
    ],
    avoid: '别连续教育她早点睡，也别这时候硬撩或马上邀约。',
  };
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

function hasRecentEmotionalDisclosure(dialogue) {
  const recentReplies = dialogue.filter((message) => message.speaker === '对方').slice(-6);
  if (recentReplies.length < 2) return false;
  const disclosureCount = recentReplies.filter((message) => EMOTIONAL_DISCLOSURE_PATTERN.test(message.text)).length;
  return disclosureCount >= 2 || recentReplies.some((message) => PHYSICAL_DISCOMFORT_PATTERN.test(message.text));
}

function hasPhysicalDiscomfort(dialogue) {
  return dialogue.filter((message) => message.speaker === '对方').slice(-6).some((message) => PHYSICAL_DISCOMFORT_PATTERN.test(message.text));
}

function buildEmotionalDisclosureSignals(dialogue) {
  const opponentMessages = dialogue.filter((message) => message.speaker === '对方').slice(-6);
  const signals = ['连续补充自己的状态', '愿意表达真实情绪'];
  if (hasPhysicalDiscomfort(dialogue)) signals.push('主动说身体不舒服');
  if (opponentMessages.some((message) => /表情包|贴图|sticker/i.test(message.text))) signals.push('用表情包继续表达情绪');
  return signals.slice(0, 4);
}

function hasRepeatedColdReplies(dialogue) {
  if (hasRecentEmotionalDisclosure(dialogue)) return false;
  const recentReplies = dialogue.filter((message) => message.speaker === '对方').slice(-3);
  return recentReplies.length === 3 && recentReplies.every((message) => (
    message.text.length <= 6
    && !/[?？！!，,。]|哈哈|嘿嘿|表情|困|累|疼|痛|难受|不舒服|压力|烦/.test(message.text)
  ));
}

function needsReplyRefinement(advice) {
  if (!advice?.is_chat_screenshot || advice.needs_retry || advice.suggest_stop) return false;

  const replies = Array.isArray(advice.replies) ? advice.replies : [];
  const latestOpponentText = [...(advice.dialogue || [])]
    .reverse()
    .find((message) => message.speaker === '对方')
    ?.text || '';
  const questionCount = replies.filter((reply) => /[?？]/.test(reply.text)).length;
  const hasTemplateLanguage = replies.some((reply) => (
    /听起来|感觉你|那你平时|有需要.{0,6}告诉我|调整好状态|看来/.test(reply.text)
  ));
  const inventsUnsupportedColdEvidence = replies.some((reply) => (
    /回复.{0,6}(慢|少|不.{0,3}积极)|疏远|没那么主动|不太主动|比较冷淡/.test(reply.text)
  ));
  const hasReversedComfortPerspective = /哄/.test(latestOpponentText)
    && replies.some((reply) => /^哄你[?？：:]?/.test(reply.text));
  const hasOverlongReplies = replies.some((reply) => reply.text.length > 24);
  const asksForExplanation = /为什么|怎么(?:知道|确定|就确定|看出来)|如何|凭什么|哪里猜错|你不是.{0,12}吗/.test(latestOpponentText);
  const evasiveReplyCount = replies.filter((reply) => (
    /观察|秘密|吊人胃口|慢慢了解|慢慢发现|你说说|哪里猜错|猜猜|以后再告诉你/.test(reply.text)
  )).length;
  const evadesDirectQuestion = asksForExplanation && evasiveReplyCount >= 2;
  const hasTooFewReplies = replies.length < 3;
  const mishandlesDisclosure = (advice.conversation_mode === '情绪倾诉' || hasRecentEmotionalDisclosure(advice.dialogue || []))
    && replies.some((reply) => (
      /早点睡|早点休息|先休息一下|优先休息|不要熬夜|别熬夜|多喝.{0,2}热水|身体.{0,2}重要|照顾好自己|别太勉强|别逼自己|放松一下|别太焦虑|太辛苦|有需要.{0,6}告诉我|调整好状态|宝宝|乖|想你|抱抱|我照顾你/.test(reply.text)
    ));

  return hasTooFewReplies
    || questionCount > 1
    || hasTemplateLanguage
    || inventsUnsupportedColdEvidence
    || hasReversedComfortPerspective
    || hasOverlongReplies
    || evadesDirectQuestion
    || mishandlesDisclosure;
}

function buildReplyRefinementPrompt(originalPrompt, advice) {
  const latestOpponentText = [...(advice.dialogue || [])]
    .reverse()
    .find((message) => message.speaker === '对方')
    ?.text || '';

  return `${originalPrompt}

【上一轮候选需要重写】
上一轮回复仍有视角错位、问号过多或模板腔。请重新输出完整 JSON，并重点重写 replies。
- 候选必须是“我”准备发送给“对方”的话。
- 对方最后一句是：“${latestOpponentText}”
- 严格确认谁在哄谁、谁在关心谁。不要出现“哄你？”这种把方向说反的话。
- 输出 3 到 5 条候选，最多一条带问号；至少两条是可以直接发送的短陈述句。
	- 如果对方最后是在认真追问原因或澄清，至少两条直接回应问题。暧昧尺度是上限，不是任务；不要用调情、卖关子或反问躲开问题。
	- 如果对方在连续倾诉困、疼、压力或不舒服，先接住情绪。不要说教、不要硬撩，不要写“早点休息”“不要熬夜”“身体重要”“照顾好自己”“别太勉强”“放松一下”“有需要告诉我”。
	- 每条尽量控制在 8 到 24 个字，不要重复对方原句，不要像客服，不要解释策略。
- 不要编造截图里没有出现的“回复慢”“不积极”等依据。轻松追问可以短句承认误判，例如“我瞎猜的，那我撤回”。`;
}

function repairReplyCandidates(advice) {
  const latestOpponentText = [...(advice.dialogue || [])]
    .reverse()
    .find((message) => message.speaker === '对方')
    ?.text || '';

  if (hasRecentEmotionalDisclosure(advice.dialogue || [])) {
    return {
      ...advice,
      replies: hasPhysicalDiscomfort(advice.dialogue || [])
        ? [
            { text: '肚子和头一起疼也太难顶了' },
            { text: '先躺会儿吧，作业晚点再说' },
            { text: '今天先别硬撑了，缓过来再写' },
            { text: '要是还一直疼，记得去看看' },
          ]
        : [
            { text: '今天确实有点难熬' },
            { text: '先缓一会儿，别急着硬撑' },
            { text: '作业晚点再说，先放过自己一下' },
            { text: '想吐槽的话我听着' },
          ],
    };
  }

  if (/为什么|怎么(?:知道|确定|就确定|看出来)|如何|凭什么|哪里猜错|你不是.{0,12}吗/.test(latestOpponentText)) {
    return {
      ...advice,
      replies: [
        { text: '我瞎猜的，那我撤回' },
        { text: '那我判断错了，你还是愿意理我的' },
        { text: '好吧，是我下结论太早了' },
        { text: '我先收回刚刚那句，是我想多了' },
      ],
    };
  }

  if (/哄/.test(latestOpponentText)) {
    return {
      ...advice,
      replies: [
        { text: '先夸我两句，我看看诚意' },
        { text: '先哄两句，我听听水平' },
        { text: '给你个机会，先表现一下' },
      ],
    };
  }

  return advice;
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

export { CHAT_ADVICE_SCHEMA, MODELS, REPLY_COACH_SYSTEM_PROMPT, REPLY_PERSPECTIVE_EXAMPLES, buildEmotionalDisclosureGuide, buildFreeTierFallbackAdvice, buildReplyRefinementPrompt, extractFirstJsonObject, getRequestParts, hasRecentEmotionalDisclosure, hasRepeatedColdReplies, isRetryableModelError, isVerifiedChatScreenshot, logUsage, needsReplyRefinement, normalizeChatGuide, normalizeConversationMode, normalizeDialogue, normalizeChatEvidence, parseAdvice, repairReplyCandidates, requestOpenAIAdvice };
