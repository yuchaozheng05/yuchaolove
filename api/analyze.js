import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MODELS = ['gpt-4.1-mini'];
const ALLOWED_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_COUNT = 6;
const MAX_TOTAL_IMAGE_BASE64_LENGTH = 4_000_000;
const PRIMARY_IMAGE_DETAIL = 'auto';
const PRIMARY_MAX_COMPLETION_TOKENS = 1600;
const REFINEMENT_MAX_COMPLETION_TOKENS = 560;
const EMOTIONAL_DISCLOSURE_PATTERN = /困死|好困|太困|困了|很困|累死|好累|太累|累了|很累|疼|痛|难受|不舒服|烦|焦虑|压力|不想上学|不想去|没写完|睡不着|崩溃|想哭|生病|发烧|胃疼|肚子疼|头疼/;
const PHYSICAL_DISCOMFORT_PATTERN = /疼|痛|难受|不舒服|生病|发烧|胃疼|肚子疼|头疼/;
const STUDY_STRESS_PATTERN = /考试|考完|考砸|复习|作业|没写完|论文|ddl|期中|期末|测验|quiz|midterm|final/i;
const HAPPY_EMOTION_PATTERN = /哈哈|开心|好耶|太好了|笑死|嘿嘿|嘻嘻|期待|成功|过了|收到|喜欢|可以呀|行呀|耶/;
const LATE_NIGHT_MISS_PATTERN = /睡了吗|睡了|睡醒|刚醒|醒了|晚安|熬夜|想你|等你|梦里|白睡|困但想聊|在等/;
const PLAYFUL_FLIRT_PATTERN = /想你|喜欢你|喜欢我|心动|见面|想我|等我|香味|新人|新包|嘴硬|亲亲|钓|上钩|暧昧|犯规|靠近|只想你|在等我|自由向往/;
const QUESTION_TEASE_PATTERN = /你在干嘛|干嘛|为啥|为什么|真的假的|质疑|怀疑|可疑|你问|问你|说了啥|听不懂|看出来|猜/;
const NEW_FRIEND_PATTERN = /好友|friend request|let'?s chat|hi|hello|你好|名字|英文名|备注|摩西|小巧思|认识一下/i;
const IRONIC_INTEREST_DENIAL_PATTERN = /谁想你|谁想你了|谁喜欢你|才没想|才不想|没想你|不想你|哪有想你|别自恋|想多了|才不是/;
const IRONIC_INTEREST_REOPEN_PATTERN = /怕你想我|怕你.{0,4}想|不给你发信息|给你发信息|不发信息|不理你|又说我|免得你|省得你|怕你说|找你|回你|发信息/;
const REPLY_COACH_SYSTEM_PROMPT = `你是中文聊天回复顾问。你的目标不是替用户表白，也不是输出礼貌客服话术，而是根据整段对话判断对方真实意愿，再给出自然、可发送、容易接住的回复。

生成回复时遵守这些规则：
- 先判断对方是否在主动回球：主动提问、连续发多条、延伸话题、接梗、使用表情包、回看前文、关心用户、轻微调侃，都是积极信号。单纯回复不等于有好感。
- 区分“连续敷衍”和“连续倾诉”。对方连发多条，说困、累、疼、不舒服、压力、烦躁或学习状态，并补充表情包时，是在释放情绪和信任，不是冷淡短回，也不等于已经暧昧。
- 对方连续主动询问用户的专业、课程、爱好、日常、食物或周末安排时，属于“主动了解”。回复应先认真回答，再顺着其中一个细节聊天，不要立刻硬撩或邀约。
- 对方嘴上否认“谁想你了”“才没有”，但随后连续补充“怕你想我”“等下又说我不给你发信息”、继续解释或发表情包，这是反话式主动回球，通常是在接梗和给台阶，不要误判成礼貌冷淡。
- 回复延迟只能作为弱信号，不要因为晚回一次就下结论。
- 暧昧必须有依据。对方只是礼貌回应时保持轻松；对方愿意接话时可以轻微暧昧；对方主动回球时可以自然升温；对方连续敷衍时停止加码。
- 回复像真人发微信：短、具体、有一点个性。优先接住对方最后一句，同时借用整段聊天里的共同梗、昵称、细节或情绪。
- 先判断这条回复最适合的动作：安慰、共情、撒娇、调情、幽默、关心、推进聊天。回复要优先解决对方当前情绪，而不是把对方原话换一种说法复述一遍。
- 每次输出 3 到 5 组候选回复；每组候选回复用 messages 表示 1 到 3 条微信连续消息，具体写 1、2 还是 3 条，要根据截图里的关系阶段、情绪和最后一句决定。text 字段等于 messages 用换行拼起来，作为兼容字段。每条消息都要短，不要写成作文。
- 学习这些样本节奏：先接住对方的话，再补一句自己的情绪或轻轻拉扯。例如 messages: ["其实我很少晚睡", "就是刚好，睡前想到你", "就不知不觉想了一会儿"]；messages: ["你这句话有点犯规", "我本来想正常回的", "现在又想多聊两句了"]。不要生硬照抄，要按截图内容改写。
- 候选回复永远是用户准备发送给对方的话。严格站在“我”的视角，不要把谁关心谁、谁哄谁、谁问谁理解反。
- 一条回复只放一个重点。避免采访式连环提问、空泛关心、突然邀约、过度承诺、强行自恋和油腻土味情话。
- 生成 3 到 5 组候选，最多一组候选使用问号。至少两组是可以直接发送的自然陈述。不要把对方原句重复一遍再反问。
- 回复不必刻意压成极短句。需要完整接住情绪、回答问题或延续共同梗时，可以自然写到 12 到 90 个字；重点是像真人，不是机械删字。
- flirt_level 是暧昧上限，不是必须完成的任务。对方只是认真提问、澄清或解释时，先正常回答，不要为了暧昧而绕开问题。
- 如果对方最后一句在问“为什么”“怎么知道”“怎么确定”或类似澄清问题，至少两条候选要真正回应问题，不要全部改成调情、卖关子或反问。
- 轻松聊天里的追问，不要写成长解释、情感分析或辩解。优先简短承认误判，再自然接住对方。不要编造截图里没有出现的“回复慢”“不积极”等依据。
- 对方在倾诉难受时，先像朋友一样接住情绪。不要说教，不要连续叮嘱，不要强行暧昧，也不要写成客服式关怀或健康提醒作文。少用“肚子和头一起疼也太难受了”这种复述型客服句，优先写“先别硬撑了”“作业先替你骂两句”“我在，你先缓一会儿”这种更像真实微信的关心。
- 绝对不要替用户编造截图或补充背景里没有出现的个人信息，例如爱好、经历、课程、行程和家乡。需要用户自己填写时，用“___”保留一个明显空位。
- 除了回复候选，还要给用户一条可以照着走的聊天路线：现在先做什么、后续怎么展开、什么不要做。每一步不是让用户一次发完，而是根据对方回应逐步推进。
- 先判断 conversation_stage。阶段决定下一步，不要把所有聊天都套成“接一句、聊兴趣、马上邀约”。只有对方持续接球，才逐步增加个人化话题或轻松邀约。
- 给 3 条最贴合“我方应该怎么回复”的 sticker_suggestions 作为库存检索意图，不要复读对方表面情绪，也不要编造具体文件名。表情包意图先判断 reply_intent，再选择适合我方发出的 emotion、scenario、relationship_stage、keywords 和可发送短配字 text。比如对方说“我讨厌你”这种暧昧撒娇冲突，不要给 angry，要给 shy / apology / comfort / love 方向来缓和、撒娇、哄对方。后端会从库存 catalog 中按相关性打分选出 6 个真实表情包。
- 少用“听起来”“感觉你”“那你平时”“有需要告诉我”“调整好状态”“看来”这类模板句。
- 候选要自然、有变化，但不要给每条回复套风格标签。`;

const REPLY_PERSPECTIVE_EXAMPLES = `【视角示例，只学习尺度和方向，不要照抄】
- 对方说“那你要我怎么哄”，是对方问应该如何哄我。可以回“先夸我两句，我看看诚意”，不要回“哄你？”
- 对方说“你感受到我的了吗”，可以回“感受到一点，再表现两集看看”。
- 对方说“我一直都在关心你啊”，可以回“那我先给你记一分”。
- 对方说“你不是说我很难懂吗，那你怎么就确定了呢”，是在追问判断依据。可以回“我瞎猜的，撤回刚刚那句”或“那我判断错了，你还是愿意理我的”。不要回“让我观察你这个难懂的秘密”。
- 对方连续说“我也不想 还没写完”“肚子疼头也疼”“不想上学”，是在倾诉，不是敷衍。优先用连续短消息关心和缓和，例如 messages: ["先别硬撑了", "你现在先躺一下", "作业我先替你骂两句"]。不要优先写“肚子和头一起疼也太难受了”这种复述句，不要教育她不要熬夜。
- 对方连续问“什么专业”“压力大吗”“有什么爱好”，是在主动了解。截图里没有用户真实爱好时，不要编造电影、运动或做饭。可以给“有，我平时比较喜欢___，最近也在___”这种待补充回复。
- 对方问“你想我啥”“睡了吗”“你在干嘛”这类轻松来回时，可以用分气泡节奏，例如“其实也没想很多\\n就是睡前想到你一下\\n结果一下有点久”。
- 对方说“别钓我了”“我生气了”“你可真皮”这类轻微拉扯时，可以接梗但别压迫，例如“我哪有钓你\\n只是把真话说得明显了一点”。
- 对方说“谁想你了”“怕你想我”“等下又说我不给你发信息”这类反话时，是在继续这个暧昧梗。可以回“那你还挺会照顾我情绪\\n嘴上说谁想我了\\n结果还怕我没消息”。
- 对方连续只回“嗯”“不知道”“玩手机”，不要硬撩，建议先停一下。`;
const IMAGE_READING_RULES = `【识图规则】
- 按上传顺序从旧到新阅读截图，合并重叠消息并去重。只分析真正的聊天截图，忽略网页、文档、普通照片和无关图片。
- 左右气泡界面必须按几何位置判断双方：左侧 = 对方，右侧 = 我。不要根据句子内容猜发送者。
- 单列消息流只有在昵称、头像或身份标记明确时才使用 side = feed；无法可靠区分时设置 needs_retry = true。
- 忽略时间、日期、系统提示、头像和昵称。截图模糊时不要编造内容。
- dialogue 先还原可见对话，再根据整段聊天判断态度、回复路线和候选回复。`;
const PRIMARY_SYSTEM_PROMPT = `${REPLY_COACH_SYSTEM_PROMPT}

${IMAGE_READING_RULES}

${REPLY_PERSPECTIVE_EXAMPLES}`;
const REPLY_REFINEMENT_SYSTEM_PROMPT = `你是中文聊天回复编辑。你会收到已经识别好的对话和一组不够自然的候选回复。
只重写 replies，不要重新分析图片，不要编造对话里没有出现的信息。
候选必须是“我”准备发给“对方”的话，输出 3 到 5 组自然、简短、可以直接发送的回复。每组用 messages 表示 1 到 3 条微信连续消息，text 等于 messages 用换行拼起来；最多一组候选带问号。`;
const CHAT_ADVICE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    attitude_label: { type: 'string' },
    attitude_desc: { type: 'string' },
    interest_score: { type: 'integer', minimum: 0, maximum: 100 },
    interest_level: {
      type: 'string',
      enum: ['低意愿', '礼貌回应', '愿意接话', '愿意倾诉', '轻微好感', '主动升温'],
    },
    interest_signals: {
      type: 'array',
      items: { type: 'string' },
    },
    conversation_mode: {
      type: 'string',
      enum: ['冷淡敷衍', '礼貌回应', '愿意接话', '主动了解', '情绪倾诉', '轻松暧昧'],
    },
    conversation_stage: {
      type: 'string',
      enum: ['初次认识', '轻松破冰', '稳定了解', '暧昧升温', '情绪陪伴', '建议停手'],
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
      minItems: 3,
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          text: { type: 'string' },
          messages: {
            type: 'array',
            minItems: 1,
            maxItems: 3,
            items: { type: 'string' },
          },
        },
        required: ['text', 'messages'],
      },
    },
    sticker_suggestions: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          text: { type: 'string' },
          emotion: { type: 'string', enum: ['greeting', 'happy', 'laugh', 'shy', 'flirt', 'love', 'missing', 'miss_you', 'sad', 'cry', 'wronged', 'comfort', 'comforting', 'encourage', 'thanks', 'goodnight', 'angry', 'awkward', 'speechless', 'excited', 'proud', 'jealous', 'surprised', 'thinking', 'sleepy', 'apology'] },
          scenario: { type: 'string', enum: ['greeting', 'studying', 'working', 'tired', 'good_morning', 'good_night', 'missing_you', 'apology', 'encouragement', 'celebration', 'teasing', 'flirting', 'confession', 'thanks', 'waiting', 'reply_late', 'asking_attention', 'agree', 'refuse', 'speechless', 'angry_complaint', 'jealousy', 'hug', 'comfort', 'cute_acting', 'bye', 'safe_exit'] },
          relationship_stage: { type: 'string', enum: ['stranger', 'acquaintance', 'talking_stage', 'flirting', 'relationship', 'post_conflict'] },
          keywords: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['text', 'emotion', 'scenario', 'relationship_stage', 'keywords'],
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
    'conversation_stage',
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
    'sticker_suggestions',
  ],
};
const REPLY_REFINEMENT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    replies: {
      type: 'array',
      minItems: 3,
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          text: { type: 'string' },
          messages: {
            type: 'array',
            minItems: 1,
            maxItems: 3,
            items: { type: 'string' },
          },
        },
        required: ['text', 'messages'],
      },
    },
  },
  required: ['replies'],
};

export default async function handler(req, res) {
  const requestId = `analyze-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error(`[${requestId}] /api/analyze missing OPENAI_API_KEY`, {
      nodeEnv: process.env.NODE_ENV || '',
      vercelEnv: process.env.VERCEL_ENV || '',
      hasOpenAIKey: false,
    });
    return res.status(500).json({ error: '分析服务尚未配置，请联系管理员。' });
  }

  try {
    const { imageParts, textPart, metadata } = getRequestParts(req.body);
    console.info(`[${requestId}] /api/analyze request accepted`, {
      hasOpenAIKey: true,
      imageCount: imageParts.length,
      mediaTypes: imageParts.map((part) => part.source.media_type),
      base64Lengths: imageParts.map((part) => part.source.data.length),
      totalBase64Length: imageParts.reduce((sum, part) => sum + part.source.data.length, 0),
      promptLength: textPart.text.length,
      visitorIdPresent: Boolean(metadata.visitor_id),
      pagePath: metadata.page_path || '',
    });
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
            const refinedText = await requestOpenAIReplyRefinement({
              apiKey,
              model,
              advice,
            });
            const refinedAdvice = mergeRefinedReplies(advice, refinedText);
            advice = needsReplyRefinement(refinedAdvice)
              ? repairReplyCandidates(refinedAdvice)
              : refinedAdvice;
          } catch (error) {
            console.warn(`OpenAI reply refinement failed: ${summarizeError(error)}`);
            advice = repairReplyCandidates(advice);
          }
        }

        await logUsage({ req, advice, imageParts, metadata, model });

        return res.status(200).json({
          content: [{ type: 'text', text: JSON.stringify(advice) }],
          model,
        });
      } catch (error) {
        lastError = error;
        console.error(`[${requestId}] OpenAI model ${model} failed`, {
          summary: summarizeError(error),
          providerStatus: error?.providerStatus || null,
          providerCode: error?.providerCode || '',
          retryable: isRetryableModelError(error),
          message: cleanText(error?.message || '', 500),
        });
        if (!isRetryableModelError(error)) break;
      }
    }

    if (isRetryableModelError(lastError)) {
      console.error(`[${requestId}] /api/analyze returning degraded fallback`, {
        reason: 'retryable-openai-error',
        summary: summarizeError(lastError),
        providerStatus: lastError?.providerStatus || null,
        providerCode: lastError?.providerCode || '',
      });
      const advice = buildFreeTierFallbackAdvice();
      await logUsage({ req, advice, imageParts, metadata, model: 'fallback', degraded: true });
      return res.status(200).json({
        content: [{ type: 'text', text: JSON.stringify(advice) }],
        degraded: true,
        reason: 'service-unavailable',
      });
    }

    console.error(`[${requestId}] /api/analyze returning 502`, {
      reason: 'non-retryable-openai-error',
      summary: summarizeError(lastError),
      providerStatus: lastError?.providerStatus || null,
      providerCode: lastError?.providerCode || '',
    });
    return res.status(502).json({ error: '分析服务暂时不可用，请稍后再试。' });
  } catch (error) {
    const status = error.statusCode || 400;
    console.error(`[${requestId}] /api/analyze request failed before OpenAI`, {
      status,
      message: cleanText(error?.message || '', 500),
      publicMessage: error.publicMessage || '',
    });
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

  return { imageParts, textPart, metadata: normalizeClientMetadata(payload?.metadata) };
}

function normalizeClientMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return {};

  return {
    visitor_id: cleanText(metadata.visitor_id, 80),
    client_started_at: cleanText(metadata.client_started_at, 40),
    image_count: Number.isFinite(Number(metadata.image_count)) ? Number(metadata.image_count) : undefined,
    page_path: cleanText(metadata.page_path, 240),
    browser_language: cleanText(metadata.browser_language, 40),
    client_timezone: cleanText(metadata.client_timezone, 80),
    screen_width: Number.isFinite(Number(metadata.screen_width)) ? Number(metadata.screen_width) : undefined,
    screen_height: Number.isFinite(Number(metadata.screen_height)) ? Number(metadata.screen_height) : undefined,
    device_pixel_ratio: Number.isFinite(Number(metadata.device_pixel_ratio)) ? Number(metadata.device_pixel_ratio) : undefined,
  };
}

async function requestOpenAIAdvice({
  apiKey,
  model,
  imageParts = [],
  prompt,
  imageDetail = PRIMARY_IMAGE_DETAIL,
  maxCompletionTokens = PRIMARY_MAX_COMPLETION_TOKENS,
  responseSchema = CHAT_ADVICE_SCHEMA,
  systemPrompt = PRIMARY_SYSTEM_PROMPT,
}) {
  const imageMessages = imageParts.flatMap((imagePart, index) => [
    {
      type: 'text',
      text: `上传图片 ${index + 1}/${imageParts.length}。先判断它是否为聊天截图；多张有效聊天截图按此顺序从旧到新排列。`,
    },
    {
      type: 'image_url',
      image_url: {
        url: `data:${imagePart.source.media_type};base64,${imagePart.source.data}`,
        detail: imageDetail,
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
        { role: 'system', content: systemPrompt },
        { role: 'user', content: [...imageMessages, { type: 'text', text: prompt }] },
      ],
      temperature: 0.55,
      max_completion_tokens: maxCompletionTokens,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'chat_advice',
          strict: true,
          schema: responseSchema,
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

async function requestOpenAIReplyRefinement({ apiKey, model, advice }) {
  return requestOpenAIAdvice({
    apiKey,
    model,
    prompt: buildReplyRefinementPrompt('', advice),
    maxCompletionTokens: REFINEMENT_MAX_COMPLETION_TOKENS,
    responseSchema: REPLY_REFINEMENT_SCHEMA,
    systemPrompt: REPLY_REFINEMENT_SYSTEM_PROMPT,
  });
}

function mergeRefinedReplies(advice, rawText) {
  const value = JSON.parse(extractFirstJsonObject(rawText));
  const replies = Array.isArray(value.replies)
    ? value.replies
        .map((reply) => normalizeReplyCandidate(reply, 140))
        .filter(Boolean)
        .slice(0, 5)
    : [];
  if (replies.length < 3) throw new Error('OpenAI returned fewer than three refined replies');
  return { ...advice, replies };
}

function parseAdvice(rawText) {
  const value = JSON.parse(extractFirstJsonObject(rawText));
  const replies = Array.isArray(value.replies)
    ? value.replies
        .map((reply) => normalizeReplyCandidate(reply, 140))
        .filter(Boolean)
        .slice(0, 5)
    : [];
  const needsRetry = Boolean(value.needs_retry);
  const dialogue = normalizeDialogue(value.dialogue);
  const chatEvidence = normalizeChatEvidence(value.chat_evidence);
  const isChatScreenshot = isVerifiedChatScreenshot(value, dialogue, chatEvidence);
  const verifiedDialogue = isChatScreenshot ? dialogue : [];
  const emotionalDisclosure = isChatScreenshot && hasRecentEmotionalDisclosure(verifiedDialogue);
  const activeCuriosity = isChatScreenshot && !emotionalDisclosure && hasActiveCuriosity(verifiedDialogue);
  const suggestStop = isChatScreenshot && !emotionalDisclosure && (Boolean(value.suggest_stop) || hasRepeatedColdReplies(verifiedDialogue));
  const conversationStage = inferConversationStage(value.conversation_stage, { emotionalDisclosure, activeCuriosity, suggestStop });
  const conversationMode = isChatScreenshot ? (emotionalDisclosure ? '情绪倾诉' : activeCuriosity ? '主动了解' : normalizeConversationMode(value.conversation_mode)) : '礼貌回应';
  const flirtLevel = isChatScreenshot ? (emotionalDisclosure ? '先别暧昧' : normalizeFlirtLevel(value.flirt_level)) : '先别暧昧';
  const stickerMatchIntent = isChatScreenshot ? buildStickerMatchIntent({
    rawSuggestions: value.sticker_suggestions,
    conversationStage,
    conversationMode,
    flirtLevel,
    dialogue: verifiedDialogue,
    suggestStop,
    emotionalDisclosure,
    activeCuriosity,
  }) : null;

  if (isChatScreenshot && !needsRetry && replies.length < 3 && !emotionalDisclosure) {
    const incompleteError = new Error('OpenAI returned fewer than three replies');
    incompleteError.providerStatus = 503;
    throw incompleteError;
  }

  return {
    attitude_label: isChatScreenshot ? (emotionalDisclosure ? '愿意倾诉' : activeCuriosity ? '主动了解' : cleanText(value.attitude_label, 12) || (needsRetry ? '截图不够清晰' : '态度待判断')) : '这不是聊天截图',
    attitude_desc: emotionalDisclosure
      ? '对方在连续表达自己的疲惫、不舒服或压力，也愿意补充细节。这是在向你倾诉，不是敷衍，但不能直接换算成好感分数。目前更适合先接住情绪，不急着升温。'
      : activeCuriosity
        ? '对方连续主动问你的情况，也会顺着前一个答案继续展开。她至少愿意了解你，先认真回答一个具体点，再看她会不会继续接球。'
      : (isChatScreenshot ? cleanText(value.attitude_desc, 180) : '') || (isChatScreenshot ? (needsRetry ? '这张截图暂时无法可靠读取，请换一张更清晰的截图后重试。' : '请结合对方后续行动继续观察。') : '我还没看到可以分析的聊天内容。'),
    interest_score: isChatScreenshot ? (emotionalDisclosure ? Math.min(45, clampScore(value.interest_score)) : activeCuriosity ? Math.max(62, clampScore(value.interest_score)) : clampScore(value.interest_score)) : 0,
    interest_level: isChatScreenshot ? (emotionalDisclosure ? '愿意倾诉' : activeCuriosity ? '愿意接话' : normalizeInterestLevel(value.interest_level)) : '低意愿',
    interest_signals: isChatScreenshot ? (emotionalDisclosure ? buildEmotionalDisclosureSignals(verifiedDialogue) : activeCuriosity ? buildActiveCuriositySignals() : normalizeSignals(value.interest_signals)) : [],
    conversation_mode: conversationMode,
    conversation_stage: isChatScreenshot ? conversationStage : '初次认识',
    reply_strategy: isChatScreenshot ? (emotionalDisclosure ? '先回应她现在的不舒服，给她一点喘息空间，等她愿意继续说再慢慢接话。' : activeCuriosity ? '先认真回答她最后的问题，给一个真实细节，再顺着她的反应慢慢展开。' : cleanText(value.reply_strategy, 100)) : '',
    flirt_level: flirtLevel,
    is_chat_screenshot: isChatScreenshot,
    non_chat_reply: cleanText(value.non_chat_reply, 120) || (!isChatScreenshot ? getDefaultNonChatReply() : ''),
    chat_evidence: chatEvidence,
    conversation_summary: isChatScreenshot ? buildDialogueSummary(verifiedDialogue) || cleanText(value.conversation_summary, 260) : '',
    chat_guide: isChatScreenshot ? (emotionalDisclosure ? buildEmotionalDisclosureGuide() : activeCuriosity ? buildActiveCuriosityGuide() : normalizeChatGuide(value.chat_guide, buildStageChatGuide(conversationStage))) : buildDefaultChatGuide(),
    dialogue: verifiedDialogue,
    suggest_stop: suggestStop,
    needs_retry: isChatScreenshot && needsRetry,
    replies: isChatScreenshot ? replies : [],
    sticker_match_intent: stickerMatchIntent,
    sticker_suggestions: stickerMatchIntent ? recommendStockStickers(stickerMatchIntent) : [],
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
  return { attitude_label: '服务暂时繁忙', attitude_desc: '当前分析服务暂时不可用。为了避免给你不准确的建议，本次不会猜测截图内容，请稍后点击"重新分析"。', interest_score: 0, interest_level: '低意愿', interest_signals: [], conversation_mode: '礼貌回应', conversation_stage: '初次认识', reply_strategy: '', flirt_level: '先别暧昧', is_chat_screenshot: true, non_chat_reply: '', chat_evidence: {}, conversation_summary: '', chat_guide: buildDefaultChatGuide(), dialogue: [], suggest_stop: false, needs_retry: true, degraded: true, replies: [], sticker_suggestions: [] };
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

function cleanReplyText(value, maxLength = 140) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 3)
    .join('\n')
    .slice(0, maxLength)
    .trim();
}

function normalizeReplyMessages(reply, maxLength = 140) {
  const rawMessages = Array.isArray(reply?.messages) && reply.messages.length
    ? reply.messages
    : cleanReplyText(reply?.text, maxLength).split('\n');
  const messages = rawMessages
    .map((message) => cleanText(message, 54))
    .filter(Boolean)
    .slice(0, 3);
  if (!messages.length) return null;

  const shortened = [];
  let usedLength = 0;
  messages.forEach((message) => {
    if (usedLength >= maxLength) return;
    const available = Math.max(0, maxLength - usedLength);
    const next = message.slice(0, available).trim();
    if (!next) return;
    shortened.push(next);
    usedLength += next.length + 1;
  });
  if (!shortened.length) return null;
  return shortened;
}

function normalizeReplyCandidate(reply, maxLength = 140) {
  const messages = normalizeReplyMessages(reply, maxLength);
  if (!messages) return null;
  return {
    text: messages.join('\n'),
    messages,
  };
}

function makeReplyCandidate(messages) {
  return normalizeReplyCandidate({ messages }) || { text: '', messages: [] };
}

function getReplyLines(text) {
  return cleanReplyText(text, 180).split('\n').filter(Boolean);
}

function clampScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeInterestLevel(value) {
  return ['低意愿', '礼貌回应', '愿意接话', '愿意倾诉', '轻微好感', '主动升温'].includes(value) ? value : '愿意接话';
}

function normalizeFlirtLevel(value) {
  return ['先别暧昧', '轻松接话', '轻微暧昧', '自然升温'].includes(value) ? value : '轻松接话';
}

function normalizeConversationMode(value) {
  return ['冷淡敷衍', '礼貌回应', '愿意接话', '主动了解', '情绪倾诉', '轻松暧昧'].includes(value) ? value : '愿意接话';
}

function normalizeConversationStage(value) {
  return ['初次认识', '轻松破冰', '稳定了解', '暧昧升温', '情绪陪伴', '建议停手'].includes(value) ? value : '轻松破冰';
}

function inferConversationStage(value, { emotionalDisclosure = false, activeCuriosity = false, suggestStop = false } = {}) {
  if (suggestStop) return '建议停手';
  if (emotionalDisclosure) return '情绪陪伴';
  if (activeCuriosity) return '稳定了解';
  return normalizeConversationStage(value);
}

function normalizeSignals(signals) {
  if (!Array.isArray(signals)) return [];
  return signals.map((signal) => cleanText(signal, 28)).filter(Boolean).slice(0, 4);
}

function normalizeChatGuide(guide, fallback = buildDefaultChatGuide()) {
  const normalized = {
    current_move: cleanText(guide?.current_move, 120),
    next_steps: Array.isArray(guide?.next_steps)
      ? guide.next_steps.map((step) => cleanText(step, 120)).filter(Boolean).slice(0, 4)
      : [],
    avoid: cleanText(guide?.avoid, 120),
  };
  return {
    current_move: normalized.current_move || fallback.current_move,
    next_steps: normalized.next_steps.length ? normalized.next_steps : fallback.next_steps,
    avoid: normalized.avoid || fallback.avoid,
  };
}

function buildStageChatGuide(stage) {
  const guides = {
    初次认识: {
      current_move: '现在还是初识阶段，先让这轮聊天舒服地继续，不急着证明自己或刻意制造暧昧。',
      next_steps: [
        '先顺着眼前的话题回一个具体点，给对方一个容易接住的入口。',
        '如果对方愿意继续回问，再交换一个日常细节，让聊天有一点真实感。',
        '连续几轮都有来有回后，再找共同兴趣，不急着邀约。',
      ],
      avoid: '别一上来就连问资料，也别突然夸外貌或强行撩。',
    },
    轻松破冰: {
      current_move: '目前在破冰阶段，先接住她最后一句，再加一个有画面的细节，让她容易回。',
      next_steps: [
        '这轮只聊一个点，观察她会不会补充细节或主动回问。',
        '她愿意接球时，再把话题延伸到一个轻松的生活片段。',
        '有共同点后可以留一个小钩子，下次继续聊，不必马上邀约。',
      ],
      avoid: '不要像问卷一样连续发问，也不要每一句都故意暧昧。',
    },
    稳定了解: {
      current_move: '现在已经进入互相了解阶段。先认真回应她正在问的内容，再留一个她愿意继续聊的细节。',
      next_steps: [
        '先给一个真实的小细节，不要只回结论。',
        '她对某一点表现出兴趣时，再顺着这个点交换彼此经历。',
        '如果她持续主动接球，再自然聊到一起能做的活动，合适时再轻松邀约。',
      ],
      avoid: '不要把正常了解误判成告白信号，也别跳过聊天直接约。',
    },
    暧昧升温: {
      current_move: '现在有一点暧昧空间，可以顺着你们已有的梗轻轻回球，但别突然加太重。',
      next_steps: [
        '先沿着现有互动轻轻调侃一句，看看她会不会继续接。',
        '她继续回球时，再加入一点更个人化的关心或共同梗。',
        '氛围稳定后，可以提出低压力、容易拒绝的轻松邀约。',
      ],
      avoid: '不要突然表白，不要用占有欲或过度自恋逼她表态。',
    },
    情绪陪伴: {
      current_move: '现在更重要的是让她觉得被听见。先回应她具体说的不舒服或烦心点，不急着推进关系。',
      next_steps: [
        '先接住她说的具体不舒服或烦心点。',
        '她愿意继续说时，再顺着她的节奏陪她聊一会儿。',
        '等情绪缓下来，再自然换到轻松一点的话题。',
      ],
      avoid: '别说教，别急着给方案，也别趁她脆弱时硬撩。',
    },
    建议停手: {
      current_move: '目前对方没有明显想继续聊的信号。先停一下，把空间留给对方。',
      next_steps: [
        '这轮不要继续补发新问题。',
        '观察对方之后会不会主动回来或自然开启新话题。',
        '如果长期都只有你在推进，就把精力收回来。',
      ],
      avoid: '不要为了挽回聊天继续连发，也不要用情绪施压。',
    },
  };
  return guides[normalizeConversationStage(stage)];
}

function buildDefaultChatGuide() {
  return buildStageChatGuide('轻松破冰');
}

function buildEmotionalDisclosureGuide() {
  return buildStageChatGuide('情绪陪伴');
}

function buildActiveCuriosityGuide() {
  return buildStageChatGuide('稳定了解');
}

const STICKER_CATALOG_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'stickers', 'catalog.v1.json');
const STOCK_STICKER_CATALOG = loadStickerCatalog();
const STICKER_RECOMMENDATION_COUNT = 6;
const STICKER_EMOTIONS = new Set(['greeting', 'happy', 'laugh', 'shy', 'flirt', 'love', 'missing', 'miss_you', 'sad', 'cry', 'wronged', 'comfort', 'comforting', 'encourage', 'thanks', 'goodnight', 'angry', 'awkward', 'speechless', 'excited', 'proud', 'jealous', 'surprised', 'thinking', 'sleepy', 'apology']);
const STICKER_SCENARIOS = new Set(['greeting', 'studying', 'working', 'tired', 'good_morning', 'good_night', 'missing_you', 'apology', 'encouragement', 'celebration', 'teasing', 'flirting', 'confession', 'thanks', 'waiting', 'reply_late', 'asking_attention', 'agree', 'refuse', 'speechless', 'angry_complaint', 'jealousy', 'hug', 'comfort', 'cute_acting', 'bye', 'safe_exit']);
const STICKER_RELATIONSHIP_STAGES = new Set(['stranger', 'acquaintance', 'talking_stage', 'flirting', 'relationship', 'post_conflict']);
const STICKER_SCORE_WEIGHTS = {
  primaryEmotion: 40,
  secondaryEmotion: 18,
  relatedEmotion: 22,
  scenario: 28,
  relatedScenario: 14,
  relationshipStage: 16,
  keyword: 8,
  tag: 4,
  intensity: 5,
  qualityScore: 10,
  usagePriority: 0.1,
  avoidTagPenalty: -45,
};
const STICKER_CHARACTER_ORDER = ['white_mochi', 'hamster', 'cat', 'shiba'];
const STICKER_MAX_PER_CHARACTER_SOFT = 2;
const STICKER_CANONICAL_EMOTIONS = {
  comforting: 'comfort',
  missing: 'miss_you',
  flirt: 'shy',
  excited: 'happy',
  proud: 'encourage',
  speechless: 'awkward',
  wronged: 'sad',
  tired: 'sleepy',
};
const STICKER_EMOTION_ALIASES = {
  greeting: ['greeting', 'happy', 'shy'],
  goodnight: ['goodnight', 'sleepy', 'comfort', 'love'],
  sleepy: ['sleepy', 'goodnight', 'comfort'],
  comfort: ['comfort', 'encourage', 'sad', 'cry', 'goodnight'],
  sad: ['sad', 'comfort', 'cry'],
  cry: ['cry', 'sad', 'comfort'],
  awkward: ['awkward', 'shy', 'surprised', 'happy'],
  surprised: ['surprised', 'awkward', 'happy'],
  miss_you: ['miss_you', 'love', 'shy'],
  love: ['love', 'miss_you', 'shy', 'comfort'],
  shy: ['shy', 'love', 'happy', 'apology'],
  apology: ['apology', 'shy', 'comfort', 'love'],
  happy: ['happy', 'laugh', 'encourage'],
  laugh: ['laugh', 'happy', 'awkward'],
  encourage: ['encourage', 'comfort', 'happy'],
  thanks: ['thanks', 'happy', 'shy'],
  thinking: ['thinking', 'awkward', 'surprised'],
  angry: ['angry', 'awkward'],
};
const STICKER_SCENARIO_ALIASES = {
  good_night: ['good_night', 'goodnight', 'tired', 'comfort'],
  goodnight: ['goodnight', 'good_night', 'tired', 'comfort'],
  tired: ['tired', 'good_night', 'comfort', 'encouragement'],
  comfort: ['comfort', 'hug', 'encouragement', 'good_night'],
  encouragement: ['encouragement', 'studying', 'comfort', 'celebration'],
  studying: ['studying', 'encouragement', 'working', 'tired'],
  celebration: ['celebration', 'happy', 'agree', 'encouragement'],
  flirting: ['flirting', 'teasing', 'missing_you', 'hug'],
  missing_you: ['missing_you', 'flirting', 'hug', 'waiting'],
  speechless: ['speechless', 'teasing', 'awkward'],
  apology: ['apology', 'comfort', 'flirting'],
  thanks: ['thanks', 'agree', 'teasing'],
};
const STICKER_REPLY_INTENT_PLANS = {
  soften_flirty_conflict: {
    emotion: 'shy',
    secondary_emotions: ['apology', 'comfort', 'love'],
    scenario: ['flirting', 'apology', 'comfort', 'cute_acting'],
    keywords: ['撒娇', '别生气', '哄你', '可爱'],
    intensity: 3,
    avoid_emotions: ['angry'],
  },
  say_goodnight_back: {
    emotion: 'goodnight',
    secondary_emotions: ['love', 'comfort', 'sleepy'],
    scenario: ['good_night', 'flirting', 'comfort'],
    keywords: ['晚安', '睡觉', '陪伴'],
    intensity: 3,
  },
  playful_continue: {
    emotion: 'laugh',
    secondary_emotions: ['happy', 'awkward'],
    scenario: ['teasing', 'celebration', 'agree'],
    keywords: ['哈哈', '接梗', '开心'],
    intensity: 3,
  },
  celebrate_together: {
    emotion: 'happy',
    secondary_emotions: ['laugh', 'encourage'],
    scenario: ['celebration', 'agree', 'encouragement'],
    keywords: ['开心', '好耶', '太好了'],
    intensity: 3,
  },
  accept_thanks: {
    emotion: 'thanks',
    secondary_emotions: ['happy', 'shy'],
    scenario: ['thanks', 'agree', 'teasing'],
    keywords: ['谢谢', '收到', '不客气'],
    intensity: 2,
  },
  comfort_support: {
    emotion: 'comfort',
    secondary_emotions: ['encourage', 'goodnight'],
    scenario: ['comfort', 'hug', 'encouragement', 'good_night'],
    keywords: ['抱抱', '安慰', '加油', '休息'],
    intensity: 3,
  },
  affectionate_reply: {
    emotion: 'miss_you',
    secondary_emotions: ['love', 'shy'],
    scenario: ['missing_you', 'flirting', 'hug'],
    keywords: ['想你', '喜欢', '抱抱'],
    intensity: 3,
  },
  encourage_support: {
    emotion: 'encourage',
    secondary_emotions: ['comfort', 'happy'],
    scenario: ['encouragement', 'studying', 'comfort'],
    keywords: ['加油', '鼓励', '陪你'],
    intensity: 3,
  },
  warm_greeting: {
    emotion: 'greeting',
    secondary_emotions: ['happy', 'shy'],
    scenario: ['greeting', 'teasing'],
    keywords: ['你好', '嗨', '认识'],
    intensity: 2,
  },
  flirty_continue: {
    emotion: 'shy',
    secondary_emotions: ['love', 'happy', 'awkward'],
    scenario: ['flirting', 'teasing', 'missing_you'],
    keywords: ['偷看', '嘴硬', '心动'],
    intensity: 3,
  },
  playful_awkward: {
    emotion: 'awkward',
    secondary_emotions: ['shy', 'surprised', 'happy'],
    scenario: ['teasing', 'speechless'],
    keywords: ['真的假的', '可疑', '啊这'],
    intensity: 2,
  },
  deescalate_gracefully: {
    emotion: 'awkward',
    secondary_emotions: ['apology', 'comfort'],
    scenario: ['safe_exit', 'bye', 'speechless'],
    keywords: ['先撤', '不打扰', '缓和'],
    intensity: 2,
  },
  warm_continue: {
    emotion: 'happy',
    secondary_emotions: ['shy', 'thinking'],
    scenario: ['teasing', 'greeting', 'agree'],
    keywords: ['接话', '继续聊'],
    intensity: 2,
  },
};

function loadStickerCatalog() {
  try {
    const catalog = JSON.parse(readFileSync(STICKER_CATALOG_PATH, 'utf8'));
    return Array.isArray(catalog.items) ? catalog.items : [];
  } catch (error) {
    console.warn(`Sticker catalog failed to load: ${error.message}`);
    return [];
  }
}

function normalizeStickerEmotionName(value) {
  const emotion = cleanText(value, 40);
  return STICKER_CANONICAL_EMOTIONS[emotion] || emotion;
}

function normalizeStickerHints(suggestions) {
  if (!Array.isArray(suggestions)) return [];
  return suggestions.map((suggestion) => {
    const emotion = normalizeStickerEmotionName(suggestion?.emotion);
    return {
      text: cleanText(suggestion?.text, 24),
      emotion: STICKER_EMOTIONS.has(emotion) ? emotion : '',
      scenario: STICKER_SCENARIOS.has(suggestion?.scenario) ? suggestion.scenario : '',
      relationship_stage: STICKER_RELATIONSHIP_STAGES.has(suggestion?.relationship_stage) ? suggestion.relationship_stage : '',
      keywords: Array.isArray(suggestion?.keywords)
        ? suggestion.keywords.map((keyword) => cleanText(keyword, 16)).filter(Boolean).slice(0, 8)
        : [],
    };
  }).filter((hint) => hint.text || hint.emotion || hint.scenario || hint.keywords.length);
}

function normalizeCatalogList(value) {
  if (Array.isArray(value)) return value.map((item) => cleanText(item, 40)).filter(Boolean);
  const text = cleanText(value, 40);
  return text ? [text] : [];
}

function normalizeCatalogEmotion(value) {
  if (typeof value === 'string') {
    return { primary: normalizeStickerEmotionName(value), secondary: [], intensity: 0 };
  }
  if (!value || typeof value !== 'object') {
    return { primary: '', secondary: [], intensity: 0 };
  }
  return {
    primary: normalizeStickerEmotionName(value.primary),
    secondary: normalizeCatalogList(value.secondary).map(normalizeStickerEmotionName).slice(0, 5),
    intensity: Number.isFinite(Number(value.intensity)) ? Number(value.intensity) : 0,
  };
}

function expandCatalogTerms(values, aliases) {
  const expanded = [];
  normalizeCatalogList(values).forEach((value) => {
    expanded.push(value);
    normalizeCatalogList(aliases[value]).forEach((alias) => expanded.push(alias));
  });
  return [...new Set(expanded.filter(Boolean))];
}

function getStockStickerCharacter(sticker) {
  return cleanText(sticker?.character || sticker?.id, 80) || 'unknown';
}

function stockStickerCharacterOrderIndex(character) {
  const index = STICKER_CHARACTER_ORDER.indexOf(character);
  return index >= 0 ? index : STICKER_CHARACTER_ORDER.length + 1;
}

function getStockDiversityCharacters(byCharacter) {
  const preferredCharacters = STICKER_CHARACTER_ORDER.filter((character) => byCharacter.has(character));
  if (preferredCharacters.length >= 2) return preferredCharacters;
  return [...byCharacter.keys()].sort((a, b) => {
    const order = stockStickerCharacterOrderIndex(a) - stockStickerCharacterOrderIndex(b);
    if (order !== 0) return order;
    return (byCharacter.get(b)?.[0]?.score || 0) - (byCharacter.get(a)?.[0]?.score || 0);
  });
}

function getStickerContext(dialogue) {
  if (hasPhysicalDiscomfort(dialogue)) return 'physical_discomfort';
  if (hasStudyStress(dialogue)) return 'study_stress';
  if (hasRecentEmotionalDisclosure(dialogue)) return 'emotional_disclosure';
  if (hasLateNightMiss(dialogue)) return 'late_night_miss';
  if (hasNewFriendOpening(dialogue)) return 'new_friend';
  if (hasPlayfulFlirt(dialogue)) return 'playful_flirt';
  if (hasQuestionTease(dialogue)) return 'question_tease';
  if (hasHappyEmotion(dialogue)) return 'happy';
  return 'generic';
}

function mapStageToStickerRelationshipStages(stage, { suggestStop = false, emotionalDisclosure = false } = {}) {
  if (suggestStop) return ['post_conflict', 'acquaintance', 'talking_stage'];
  if (emotionalDisclosure) return ['talking_stage', 'flirting', 'relationship'];
  const byStage = {
    初次认识: ['stranger', 'acquaintance'],
    轻松破冰: ['acquaintance', 'talking_stage'],
    稳定了解: ['talking_stage', 'flirting'],
    暧昧升温: ['flirting', 'relationship', 'talking_stage'],
    情绪陪伴: ['talking_stage', 'flirting', 'relationship'],
    建议停手: ['post_conflict', 'acquaintance', 'talking_stage'],
  };
  return byStage[normalizeConversationStage(stage)] || byStage.轻松破冰;
}

function pushUnique(list, values) {
  values.filter(Boolean).forEach((value) => {
    if (!list.includes(value)) list.push(value);
  });
}

function collectKeywordMatches(text, keywordGroups) {
  const found = [];
  keywordGroups.forEach((keywords) => {
    keywords.forEach((keyword) => {
      if (text.includes(keyword)) found.push(keyword);
    });
  });
  return found;
}

function getLatestOpponentText(dialogue) {
  return [...(dialogue || [])]
    .reverse()
    .find((message) => message.speaker === '对方')
    ?.text || '';
}

function inferStickerReplyIntent({
  dialogue = [],
  conversationStage = '轻松破冰',
  conversationMode = '',
  flirtLevel = '',
  suggestStop = false,
  emotionalDisclosure = false,
  activeCuriosity = false,
} = {}) {
  const latestOpponentText = getLatestOpponentText(dialogue);
  const recentText = recentDialogueText(dialogue, 10);
  const flirtyContext = conversationStage === '暧昧升温'
    || conversationMode === '轻松暧昧'
    || flirtLevel === '轻微暧昧'
    || flirtLevel === '自然升温'
    || hasPlayfulFlirt(dialogue)
    || /想你|喜欢|嘴硬|亲亲|钓|犯规|讨厌你/.test(recentText);

  if (suggestStop) return 'deescalate_gracefully';
  if (/讨厌你|不喜欢你|烦你|我生气了|气死我了|哼/.test(latestOpponentText) && flirtyContext) {
    return 'soften_flirty_conflict';
  }
  if (/晚安|睡了|睡觉|早点睡|先睡|好梦/.test(latestOpponentText)) return 'say_goodnight_back';
  if (/哈哈哈|哈哈|笑死|乐疯|嘿嘿|嘻嘻/.test(latestOpponentText)) return 'playful_continue';
  if (/谢谢|谢啦|谢了|感谢|辛苦你/.test(latestOpponentText)) return 'accept_thanks';
  if (/好累|太累|累死|我.{0,3}累|好困|太困|困死|撑不住/.test(latestOpponentText)) return 'comfort_support';
  if (/想你了|想你|想我|想见你|有点想/.test(latestOpponentText)) return 'affectionate_reply';

  if (hasPhysicalDiscomfort(dialogue) || emotionalDisclosure || contextFromDialogue(dialogue) === 'emotional_disclosure') return 'comfort_support';
  if (hasStudyStress(dialogue)) return 'encourage_support';
  if (hasLateNightMiss(dialogue)) return /想你|想我|等你|在等/.test(recentText) ? 'affectionate_reply' : 'say_goodnight_back';
  if (hasPlayfulFlirt(dialogue) || conversationStage === '暧昧升温') return 'flirty_continue';
  if (hasHappyEmotion(dialogue)) {
    return /哈哈哈|哈哈|笑死|乐疯|嘿嘿|嘻嘻/.test(latestOpponentText || recentText)
      ? 'playful_continue'
      : 'celebrate_together';
  }
  if (hasQuestionTease(dialogue)) return 'playful_awkward';
  if (hasNewFriendOpening(dialogue)) return 'warm_greeting';
  if (activeCuriosity) return 'warm_continue';
  return 'warm_continue';
}

function contextFromDialogue(dialogue) {
  return getStickerContext(dialogue);
}

function applyReplyIntentPlan(replyIntent, { emotions, scenarios, keywords, intensityRef }) {
  const plan = STICKER_REPLY_INTENT_PLANS[replyIntent] || STICKER_REPLY_INTENT_PLANS.warm_continue;
  pushUnique(emotions, [plan.emotion, ...(plan.secondary_emotions || [])]);
  pushUnique(scenarios, plan.scenario || []);
  pushUnique(keywords, plan.keywords || []);
  intensityRef.value = plan.intensity || intensityRef.value || 2;
  return plan;
}

function buildStickerMatchIntent({
  rawSuggestions = [],
  conversationStage = '轻松破冰',
  conversationMode = '',
  flirtLevel = '',
  dialogue = [],
  suggestStop = false,
  emotionalDisclosure = false,
  activeCuriosity = false,
} = {}) {
  const hints = normalizeStickerHints(rawSuggestions);
  const text = [
    recentDialogueText(dialogue, 12),
    hints.map((hint) => [hint.text, hint.emotion, hint.scenario, hint.relationship_stage, ...hint.keywords].join(' ')).join(' '),
    conversationStage,
    conversationMode,
    flirtLevel,
  ].join(' ');
  const context = getStickerContext(dialogue);
  const scenarios = [];
  const keywords = collectKeywordMatches(text, [
    ['哈哈哈', '哈哈', '笑死', '乐疯', '开心', '好耶', '太好了', '收到'],
    ['偷看', '害羞', '脸红', '不好意思', '想你', '心动', '犯规', '嘴硬', '亲亲'],
    ['哭哭', '委屈', '可怜巴巴', '抱抱', '拍拍', '摸摸头', '难受', '疼', '累', '压力'],
    ['无语', '白眼', '沉默', '你说得对', '听不懂', '真的假的', '可疑'],
    ['生气', '气死', '怒火', '拳头硬了', '哼'],
    ['考试', '作业', '论文', '复习', 'ddl', '加油'],
    ['晚安', '睡了', '睡觉', '困', '刚醒', '梦里'],
    ['对不起', '不好意思', '抱歉', '不打扰', '先撤'],
  ]);

  const replyIntent = inferStickerReplyIntent({
    dialogue,
    conversationStage,
    conversationMode,
    flirtLevel,
    suggestStop,
    emotionalDisclosure,
    activeCuriosity,
  });
  const intentEmotions = [];
  const intensityRef = { value: 2 };
  const replyPlan = applyReplyIntentPlan(replyIntent, {
    emotions: intentEmotions,
    scenarios,
    keywords,
    intensityRef,
  });

  hints.forEach((hint) => {
    if (hint.emotion && !(replyPlan.avoid_emotions || []).includes(hint.emotion)) pushUnique(intentEmotions, [hint.emotion]);
    if (hint.scenario) pushUnique(scenarios, [hint.scenario]);
    pushUnique(keywords, hint.keywords);
    if (hint.text) pushUnique(keywords, [hint.text]);
  });

  const primaryEmotion = intentEmotions[0] || 'happy';
  const intensity = intensityRef.value;

  pushUnique(scenarios, hints.map((hint) => hint.scenario));
  const relationshipStages = mapStageToStickerRelationshipStages(conversationStage, { suggestStop, emotionalDisclosure });
  pushUnique(relationshipStages, hints.map((hint) => hint.relationship_stage));

  return {
    reply_intent: replyIntent,
    emotion: primaryEmotion,
    secondary_emotions: intentEmotions.filter((emotion) => emotion !== primaryEmotion).slice(0, 4),
    scenario: scenarios.slice(0, 5),
    relationship_stage: relationshipStages.slice(0, 4),
    keywords: keywords.slice(0, 12),
    intensity,
    context,
  };
}

function scoreStockSticker(sticker, intent) {
  const stickerEmotion = normalizeCatalogEmotion(sticker.emotion);
  const stickerSecondary = stickerEmotion.secondary;
  const stickerScenario = normalizeCatalogList(sticker.scenario);
  const stickerStages = normalizeCatalogList(sticker.relationship_stage);
  const stickerTags = normalizeCatalogList(sticker.tags);
  const exactEmotions = [intent.emotion, ...intent.secondary_emotions].filter(Boolean);
  const relatedEmotions = expandCatalogTerms(exactEmotions, STICKER_EMOTION_ALIASES);
  const exactScenarios = normalizeCatalogList(intent.scenario);
  const relatedScenarios = expandCatalogTerms(exactScenarios, STICKER_SCENARIO_ALIASES);
  const searchableText = [
    sticker.id,
    sticker.character,
    sticker.text,
    sticker.source_filename,
    ...stickerTags,
    ...stickerScenario,
  ].join(' ').toLowerCase();
  let score = 0;

  if (stickerEmotion.primary === intent.emotion) score += STICKER_SCORE_WEIGHTS.primaryEmotion;
  else if (stickerSecondary.includes(intent.emotion)) score += STICKER_SCORE_WEIGHTS.secondaryEmotion;
  else if (relatedEmotions.includes(stickerEmotion.primary)) score += STICKER_SCORE_WEIGHTS.relatedEmotion;
  score += intent.secondary_emotions.filter((emotion) => stickerEmotion.primary === emotion || stickerSecondary.includes(emotion)).length * STICKER_SCORE_WEIGHTS.secondaryEmotion;
  score += exactScenarios.filter((scenario) => stickerScenario.includes(scenario)).length * STICKER_SCORE_WEIGHTS.scenario;
  score += relatedScenarios.filter((scenario) => !exactScenarios.includes(scenario) && stickerScenario.includes(scenario)).length * STICKER_SCORE_WEIGHTS.relatedScenario;
  score += intent.relationship_stage.filter((stage) => stickerStages.includes(stage)).length * STICKER_SCORE_WEIGHTS.relationshipStage;

  const keywordHits = intent.keywords.filter((keyword) => searchableText.includes(keyword.toLowerCase()));
  score += keywordHits.length * STICKER_SCORE_WEIGHTS.keyword;
  score += intent.keywords.filter((keyword) => stickerTags.includes(keyword)).length * STICKER_SCORE_WEIGHTS.tag;

  if (Number.isFinite(stickerEmotion.intensity) && stickerEmotion.intensity > 0) {
    score += Math.max(0, STICKER_SCORE_WEIGHTS.intensity - Math.abs(stickerEmotion.intensity - intent.intensity));
  }
  if (Array.isArray(sticker.avoid_tags) && sticker.avoid_tags.some((tag) => intent.keywords.includes(tag) || intent.scenario.includes(tag))) {
    score += STICKER_SCORE_WEIGHTS.avoidTagPenalty;
  }
  score += (Number(sticker.quality_score) || 0) * STICKER_SCORE_WEIGHTS.qualityScore;
  score += (Number(sticker.usage_priority) || 0) * STICKER_SCORE_WEIGHTS.usagePriority;

  return Math.round(score * 100) / 100;
}

function toStockStickerSuggestion(sticker, score, intent) {
  return {
    id: sticker.id,
    file: sticker.file,
    thumb: sticker.thumb || sticker.file,
    pack: sticker.pack || '',
    character: getStockStickerCharacter(sticker),
    text: sticker.text || '',
    emotion: normalizeCatalogEmotion(sticker.emotion),
    scenario: normalizeCatalogList(sticker.scenario),
    relationship_stage: normalizeCatalogList(sticker.relationship_stage),
    tags: normalizeCatalogList(sticker.tags),
    static: sticker.static !== false,
    score,
    match: {
      reply_intent: intent.reply_intent,
      emotion: intent.emotion,
      secondary_emotions: intent.secondary_emotions,
      scenario: intent.scenario,
      relationship_stage: intent.relationship_stage,
      keywords: intent.keywords,
    },
  };
}

function sortScoredStockStickers(a, b) {
  return b.score - a.score
    || (Number(b.sticker.usage_priority) || 0) - (Number(a.sticker.usage_priority) || 0)
    || stockStickerCharacterOrderIndex(getStockStickerCharacter(a.sticker)) - stockStickerCharacterOrderIndex(getStockStickerCharacter(b.sticker))
    || a.sticker.id.localeCompare(b.sticker.id);
}

function selectDiverseStockStickers(scored, count) {
  const sorted = scored.slice().sort(sortScoredStockStickers);
  const byCharacter = new Map();
  sorted.forEach((entry) => {
    const character = getStockStickerCharacter(entry.sticker);
    if (!byCharacter.has(character)) byCharacter.set(character, []);
    byCharacter.get(character).push(entry);
  });

  const characters = getStockDiversityCharacters(byCharacter);
  const selected = [];
  const selectedIds = new Set();
  const characterCounts = new Map();

  const takeNextForCharacter = (character, maxForCharacter = Infinity) => {
    if ((characterCounts.get(character) || 0) >= maxForCharacter) return;
    const next = (byCharacter.get(character) || []).find(({ sticker }) => !selectedIds.has(sticker.id));
    if (!next) return;
    selected.push(next);
    selectedIds.add(next.sticker.id);
    characterCounts.set(character, (characterCounts.get(character) || 0) + 1);
  };

  for (let pass = 1; pass <= STICKER_MAX_PER_CHARACTER_SOFT && selected.length < count; pass += 1) {
    characters.forEach((character) => {
      if (selected.length < count) takeNextForCharacter(character, pass);
    });
  }

  sorted.forEach((entry) => {
    if (selected.length < count && !selectedIds.has(entry.sticker.id)) {
      selected.push(entry);
      selectedIds.add(entry.sticker.id);
    }
  });

  return selected.slice(0, count);
}

function recommendStockStickers(intent, count = STICKER_RECOMMENDATION_COUNT) {
  if (!intent || !STOCK_STICKER_CATALOG.length) return [];
  const scored = STOCK_STICKER_CATALOG
    .filter((sticker) => sticker?.file && sticker.static !== false)
    .map((sticker) => ({ sticker, score: scoreStockSticker(sticker, intent) }));
  return selectDiverseStockStickers(scored, count)
    .map(({ sticker, score }) => toStockStickerSuggestion(sticker, score, intent));
}

function normalizeStickerSuggestions(suggestions, stage = '轻松破冰', dialogue = [], analysis = {}) {
  const intent = buildStickerMatchIntent({
    rawSuggestions: suggestions,
    conversationStage: stage,
    conversationMode: analysis.conversation_mode,
    flirtLevel: analysis.flirt_level,
    dialogue,
    suggestStop: analysis.suggest_stop === true,
    emotionalDisclosure: analysis.emotional_disclosure === true,
    activeCuriosity: analysis.active_curiosity === true,
  });
  return recommendStockStickers(intent);
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

function hasStudyStress(dialogue) {
  return dialogue.filter((message) => message.speaker === '对方').slice(-6).some((message) => STUDY_STRESS_PATTERN.test(message.text));
}

function hasHappyEmotion(dialogue) {
  return dialogue.filter((message) => message.speaker === '对方').slice(-6).some((message) => HAPPY_EMOTION_PATTERN.test(message.text));
}

function recentDialogueText(dialogue, count = 8) {
  return (dialogue || []).slice(-count).map((message) => message.text).join(' ');
}

function hasLateNightMiss(dialogue) {
  return LATE_NIGHT_MISS_PATTERN.test(recentDialogueText(dialogue));
}

function hasPlayfulFlirt(dialogue) {
  return PLAYFUL_FLIRT_PATTERN.test(recentDialogueText(dialogue));
}

function hasQuestionTease(dialogue) {
  return QUESTION_TEASE_PATTERN.test(recentDialogueText(dialogue));
}

function hasNewFriendOpening(dialogue) {
  return NEW_FRIEND_PATTERN.test(recentDialogueText(dialogue, 10));
}

function buildEmotionalDisclosureSignals(dialogue) {
  const opponentMessages = dialogue.filter((message) => message.speaker === '对方').slice(-6);
  const signals = ['连续补充自己的状态', '愿意表达真实情绪'];
  if (hasPhysicalDiscomfort(dialogue)) signals.push('主动说身体不舒服');
  if (opponentMessages.some((message) => /表情包|贴图|sticker/i.test(message.text))) signals.push('用表情包继续表达情绪');
  return signals.slice(0, 4);
}

function hasActiveCuriosity(dialogue) {
  const recentReplies = dialogue.filter((message) => message.speaker === '对方').slice(-6);
  const questionCount = recentReplies.filter((message) => /[?？]|什么|哪些|哪门|多少|吗|呢|爱好|喜欢|专业|课程|周末|平时/.test(message.text)).length;
  return recentReplies.length >= 2 && questionCount >= 2;
}

function buildActiveCuriositySignals() {
  return ['连续主动提问', '自然延伸话题', '想了解你的日常'];
}

function asksForPersonalDetail(text) {
  return /喜欢做什么|什么爱好|爱好吗|喜欢什么|学什么|什么专业|哪些课|哪门课|喜欢吃什么|吃什么|住哪里|哪里人|周末做什么|平时做什么/.test(text);
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
  const playfulContext = advice.conversation_stage === '暧昧升温'
    || hasLateNightMiss(advice.dialogue || [])
    || hasPlayfulFlirt(advice.dialogue || [])
    || hasQuestionTease(advice.dialogue || [])
    || hasNewFriendOpening(advice.dialogue || []);
  const questionCount = replies.filter((reply) => /[?？]/.test(reply.text)).length;
  const hasTemplateLanguage = replies.some((reply) => (
    /听起来|感觉你|那你平时|有需要.{0,6}告诉我|调整好状态|看来|一起疼也太难受|也太难受了|听着就难受|今天确实有点难熬/.test(reply.text)
  ));
  const inventsUnsupportedColdEvidence = replies.some((reply) => (
    /回复.{0,6}(慢|少|不.{0,3}积极)|疏远|没那么主动|不太主动|比较冷淡/.test(reply.text)
  ));
  const hasReversedComfortPerspective = /哄/.test(latestOpponentText)
    && replies.some((reply) => /^哄你[?？：:]?/.test(reply.text));
  const hasOverlongReplies = replies.some((reply) => {
    const lines = getReplyLines(reply.text);
    return lines.length > 3 || lines.some((line) => line.length > 48) || reply.text.length > 140;
  });
  const hasFlatPlayfulReplies = playfulContext
    && replies.length >= 3
    && !replies.some((reply) => getReplyLines(reply.text).length >= 2)
    && replies.filter((reply) => reply.text.length <= 14 && !/[，。！？?？]/.test(reply.text)).length >= 2;
  const asksForExplanation = /为什么|怎么(?:知道|确定|就确定|看出来)|如何|凭什么|哪里猜错|你不是.{0,12}吗/.test(latestOpponentText);
  const evasiveReplyCount = replies.filter((reply) => (
    /观察|秘密|吊人胃口|慢慢了解|慢慢发现|你说说|哪里猜错|猜猜|以后再告诉你/.test(reply.text)
  )).length;
  const evadesDirectQuestion = asksForExplanation && evasiveReplyCount >= 2;
  const hasTooFewReplies = replies.length < 3;
  const inventsPersonalDetails = asksForPersonalDetail(latestOpponentText)
    && replies.some((reply) => (
      !/___/.test(reply.text)
      && /我(?:平时|一般|空的时候|最近)?(?:比较)?喜欢|我会|最近在|平时(?:比较)?喜欢|喜欢(?:看电影|听音乐|运动|画画|做饭)|偶尔(?:打球|跑步|健身)/.test(reply.text)
    ));
  const mishandlesDisclosure = (advice.conversation_mode === '情绪倾诉' || hasRecentEmotionalDisclosure(advice.dialogue || []))
    && replies.some((reply) => (
      /早点睡|早点休息|先休息一下|优先休息|不要熬夜|别熬夜|多喝.{0,2}热水|身体.{0,2}重要|照顾好自己|别太勉强|别逼自己|放松一下|别太焦虑|太辛苦|也太难受|有需要.{0,6}告诉我|调整好状态|宝宝|乖|想你|抱抱|我照顾你/.test(reply.text)
    ));

  return hasTooFewReplies
    || questionCount > 1
    || hasTemplateLanguage
    || inventsUnsupportedColdEvidence
    || hasReversedComfortPerspective
    || hasOverlongReplies
    || hasFlatPlayfulReplies
    || evadesDirectQuestion
    || inventsPersonalDetails
    || mishandlesDisclosure;
}

function buildReplyRefinementPrompt(originalPrompt, advice) {
  const latestOpponentText = [...(advice.dialogue || [])]
    .reverse()
    .find((message) => message.speaker === '对方')
    ?.text || '';
  const dialogue = (advice.dialogue || [])
    .slice(-10)
    .map((message) => `${message.speaker}：${message.text}`)
    .join('；');
  const previousReplies = (advice.replies || [])
    .map((reply) => (reply.messages?.length ? reply.messages.join(' / ') : reply.text))
    .join('｜');

  return `【上一轮候选需要重写】
聊天记录：${dialogue}
对方最后一句：“${latestOpponentText}”
上一轮候选：${previousReplies}

- 候选必须是“我”准备发送给“对方”的话。
- 严格确认谁在哄谁、谁在关心谁。不要出现“哄你？”这种把方向说反的话。
- 如果对方在认真追问原因或澄清，至少两条直接回应问题，不要卖关子。
- 如果对方在倾诉困、疼、压力或不舒服，先解决情绪，不要复述原话，不要说教或硬撩。
- 如果是想你、晚安、刚认识、轻微试探或玩笑场景，优先写成 1 到 3 条 messages，像真实微信连续消息一样先接梗再补一句情绪。
- 每个候选都返回 messages 数组；text 等于 messages 用换行拼起来。
- 不要替用户编造截图里没有出现的爱好、经历、课程、行程和家乡；需要用户填写时，用“___”保留空位。
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
            makeReplyCandidate(['先别硬撑了', '你现在先躺一下', '作业我先替你骂两句']),
            makeReplyCandidate(['头和肚子都在抗议了', '今晚先别跟自己较劲']),
            makeReplyCandidate(['不想上学这句我懂', '但你现在先把自己哄舒服一点']),
            makeReplyCandidate(['我在', '你先缓一会儿', '好一点了再继续写']),
          ]
        : [
            makeReplyCandidate(['今天先别跟自己硬刚了', '缓一会儿也算前进']),
            makeReplyCandidate(['作业先放十分钟', '人不能一直被ddl欺负']),
            makeReplyCandidate(['你现在的任务', '是先把自己哄回来']),
            makeReplyCandidate(['想吐槽就吐槽', '我负责听']),
          ],
    };
  }

  if (asksForPersonalDetail(latestOpponentText)) {
    return {
      ...advice,
      replies: [
        makeReplyCandidate(['有，我平时比较喜欢___']),
        makeReplyCandidate(['最近比较常___', '但跟你聊这个也挺上头']),
        makeReplyCandidate(['这个得说真话：___', '你呢，你是不是也有点难描述']),
        makeReplyCandidate(['我最常做的是___', '不过现在好像在练怎么跟你聊天']),
      ],
    };
  }

  if (/为什么|怎么(?:知道|确定|就确定|看出来)|如何|凭什么|哪里猜错|你不是.{0,12}吗/.test(latestOpponentText)) {
    return {
      ...advice,
      replies: [
        makeReplyCandidate(['我瞎猜的，那我撤回']),
        makeReplyCandidate(['那我判断错了', '你还是愿意理我的']),
        makeReplyCandidate(['好吧，是我下结论太早了']),
        makeReplyCandidate(['我先收回刚刚那句', '是我想多了']),
      ],
    };
  }

  if (/哄/.test(latestOpponentText)) {
    return {
      ...advice,
      replies: [
        makeReplyCandidate(['先夸我两句，我看看诚意']),
        makeReplyCandidate(['先哄两句', '我听听水平']),
        makeReplyCandidate(['给你个机会', '先表现一下']),
      ],
    };
  }

  if (hasLateNightMiss(advice.dialogue || [])) {
    return {
      ...advice,
      replies: [
        makeReplyCandidate(['其实也没想很多', '就是睡前想到你一下', '结果一下有点久']),
        makeReplyCandidate(['刚醒', '一睁眼没看到你的消息', '有点白睡了']),
        makeReplyCandidate(['晚安可以晚点说', '但不能没有你这句']),
        makeReplyCandidate(['我本来想早点睡的', '结果脑子里有人不下班']),
      ],
    };
  }

  if (hasNewFriendOpening(advice.dialogue || [])) {
    return {
      ...advice,
      replies: [
        makeReplyCandidate(['摩西摩西', '这个名字有点可爱']),
        makeReplyCandidate(['你好呀', '我先认真认识一下']),
        makeReplyCandidate(['小巧思', '这个备注还挺有画面']),
        makeReplyCandidate(['那我先从名字开始记住你']),
      ],
    };
  }

  if (hasPlayfulFlirt(advice.dialogue || [])) {
    return {
      ...advice,
      replies: [
        makeReplyCandidate(['你这句话有点犯规', '我本来想正常回的', '现在又想多聊两句了']),
        makeReplyCandidate(['我哪有钓你', '只是把真话说得明显了一点']),
        makeReplyCandidate(['那你别太会接', '我会以为你也有点想我']),
        makeReplyCandidate(['嘴硬可以', '但别把想聊天藏太明显']),
      ],
    };
  }

  if (hasQuestionTease(advice.dialogue || [])) {
    return {
      ...advice,
      replies: [
        makeReplyCandidate(['我哪敢质疑你', '我只是有一点点好奇']),
        makeReplyCandidate(['被你看出来了', '我确实在认真听']),
        makeReplyCandidate(['你这句问得我开始认真了']),
        makeReplyCandidate(['等我组织一下语言', '不能显得我太好懂']),
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

async function logUsage({ req, advice, imageParts, metadata = {}, model = '', degraded = false }) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) return;

  try {
    const visitorId = cleanText(metadata.visitor_id, 80) || 'unknown';
    const ip = getClientIp(req);
    const country = readHeader(req, 'x-vercel-ip-country') || 'unknown';
    const region = readHeader(req, 'x-vercel-ip-country-region') || readHeader(req, 'x-vercel-ip-region') || 'unknown';
    const city = decodeHeader(readHeader(req, 'x-vercel-ip-city')) || 'unknown';
    const timezone = readHeader(req, 'x-vercel-ip-timezone') || 'unknown';
    const latitude = toNullableNumber(readHeader(req, 'x-vercel-ip-latitude'));
    const longitude = toNullableNumber(readHeader(req, 'x-vercel-ip-longitude'));
    const userAgent = readHeader(req, 'user-agent') || 'unknown';
    const referer = readHeader(req, 'referer') || readHeader(req, 'referrer') || '';
    const locationLabel = [city, region, country].filter((part) => part && part !== 'unknown').join(', ') || 'unknown';

    const imageRecords = [];
    for (let i = 0; i < imageParts.length; i++) {
      const part = imageParts[i];
      const ext = part.source.media_type.split('/')[1] || 'jpg';
      const path = buildStoragePath({ visitorId, index: i, ext });
      const buffer = Buffer.from(part.source.data, 'base64');
      const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/screenshots/${path}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
          'Content-Type': part.source.media_type,
          'x-upsert': 'false',
        },
        body: buffer,
      });
      if (uploadRes.ok) {
        imageRecords.push({
          path,
          url: `${supabaseUrl}/storage/v1/object/authenticated/screenshots/${path}`,
          media_type: part.source.media_type,
          bytes: buffer.length,
        });
      } else {
        console.warn(`Supabase screenshot upload failed with ${uploadRes.status}`);
      }
    }

    await fetch(`${supabaseUrl}/rest/v1/usage_logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        visitor_id: visitorId,
        ip,
        country,
        region,
        city,
        timezone,
        latitude,
        longitude,
        location_label: locationLabel,
        user_agent: userAgent,
        referer,
        page_path: metadata.page_path || '',
        browser_language: metadata.browser_language || '',
        client_timezone: metadata.client_timezone || '',
        image_count: imageParts.length,
        storage_paths: imageRecords.map((image) => image.path),
        image_urls: imageRecords.map((image) => image.url),
        images: imageRecords,
        model,
        degraded,
        attitude_label: advice.attitude_label || '',
        attitude_desc: advice.attitude_desc || '',
        interest_score: Number.isFinite(Number(advice.interest_score)) ? Number(advice.interest_score) : null,
        interest_level: advice.interest_level || '',
        conversation_mode: advice.conversation_mode || '',
        conversation_stage: advice.conversation_stage || '',
        flirt_level: advice.flirt_level || '',
        replies: advice.replies || [],
        sticker_suggestions: advice.sticker_suggestions || [],
        chat_guide: advice.chat_guide || {},
        dialogue: advice.dialogue || [],
        analysis_result: advice,
        request_metadata: {
          ...metadata,
          log_schema_version: 1,
        },
      }),
    });
  } catch (err) {
    console.warn('logUsage failed:', err.message);
  }
}

function readHeader(req, name) {
  const headers = req?.headers || {};
  const value = headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()];
  if (Array.isArray(value)) return value[0] || '';
  return typeof value === 'string' ? value : '';
}

function getClientIp(req) {
  const forwarded = readHeader(req, 'x-forwarded-for');
  return forwarded.split(',')[0].trim() || readHeader(req, 'x-real-ip') || 'unknown';
}

function decodeHeader(value) {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function toNullableNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function buildStoragePath({ visitorId, index, ext }) {
  const day = new Date().toISOString().slice(0, 10);
  const safeVisitorId = visitorId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'unknown';
  const suffix = Math.random().toString(36).slice(2, 10);
  return `${day}/${safeVisitorId}-${Date.now()}-${index}-${suffix}.${ext}`;
}

export { CHAT_ADVICE_SCHEMA, IMAGE_READING_RULES, MODELS, PRIMARY_IMAGE_DETAIL, PRIMARY_MAX_COMPLETION_TOKENS, REPLY_COACH_SYSTEM_PROMPT, REPLY_PERSPECTIVE_EXAMPLES, REPLY_REFINEMENT_SCHEMA, REFINEMENT_MAX_COMPLETION_TOKENS, buildActiveCuriosityGuide, buildEmotionalDisclosureGuide, buildFreeTierFallbackAdvice, buildReplyRefinementPrompt, buildStageChatGuide, buildStickerMatchIntent, extractFirstJsonObject, getRequestParts, getStickerContext, hasActiveCuriosity, hasHappyEmotion, hasRecentEmotionalDisclosure, hasRepeatedColdReplies, hasStudyStress, inferConversationStage, isRetryableModelError, isVerifiedChatScreenshot, logUsage, mergeRefinedReplies, needsReplyRefinement, normalizeChatGuide, normalizeConversationMode, normalizeConversationStage, normalizeDialogue, normalizeChatEvidence, normalizeStickerSuggestions, parseAdvice, recommendStockStickers, repairReplyCandidates, requestOpenAIAdvice, requestOpenAIReplyRefinement, scoreStockSticker };
