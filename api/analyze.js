import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MODELS = ['gpt-4.1-mini'];
const ALLOWED_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_COUNT = 6;
const MAX_TOTAL_IMAGE_BASE64_LENGTH = 4_000_000;
const PRIMARY_IMAGE_DETAIL = 'low';
const PRIMARY_MAX_COMPLETION_TOKENS = 3200;
const REFINEMENT_MAX_COMPLETION_TOKENS = 560;
const PRIMARY_OPENAI_TIMEOUT_MS = 25_000;
const REFINEMENT_OPENAI_TIMEOUT_MS = 3_500;
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
- 对方身体不舒服时，回复优先级固定为：行动 > 关心 > 安慰 > 幽默。不要优先玩梗，不要优先搞笑。先询问情况，再给具体行动，例如送药、送热乎的吃的、让她休息、提醒喝温水、陪她确认有没有更严重、必要时建议先停作业。
- 对方在倾诉难受时，先像朋友一样接住情绪。不要说教，不要连续叮嘱，不要强行暧昧，也不要写成客服式关怀或健康提醒作文。少用“肚子和头一起疼也太难受了”这种复述型客服句，优先写“你先躺下”“喝点温水”“我给你送药/点热的”“我在，先陪你缓一下”这种更像真实微信的关心。
- 情绪陪伴要有实质动作：先问清情况、表达心疼、给一个具体可执行的小动作。可以根据关系阶段写“先闭眼躺十分钟”“我给你点杯热的”“把地址发我，我给你送药和热乎的吃的”，但不要承诺截图里不支持的重大行动，也不要像客服一样列流程。
- 身体不舒服场景可以参考这些关心角度，但每组只选一个重点：话痨式追问具体哪里不舒服、展望式说如果在身边会照顾她、嘘寒问暖提醒休息喝水、宽慰式说可以告诉我能做什么、体贴式准备清淡吃的/水果/热饮、温暖式帮她查建议、分享式讲一个很短的小故事转移注意力、细节式准备常用药和小物、鼓励式提醒她会慢慢好起来。优先实际照顾，不要把分享故事和幽默放第一组。
- 绝对不要替用户编造截图或补充背景里没有出现的个人信息，例如爱好、经历、课程、行程和家乡。需要用户自己填写时，用“___”保留一个明显空位。
- 除了回复候选，还要给用户一条可以照着走的聊天路线：现在先做什么、后续怎么展开、什么不要做。每一步不是让用户一次发完，而是根据对方回应逐步推进。
- 先判断 conversation_stage。阶段决定下一步，不要把所有聊天都套成“接一句、聊兴趣、马上邀约”。只有对方持续接球，才逐步增加个人化话题或轻松邀约。
- 同时输出 analysis：stage 必须使用 relationship_stage 枚举 ice_breaking、daily_connection、emotional_bonding、push_pull_flirting、offline_invitation、relationship_confirmation；scene 写当前具体聊天场景；emotion 写对方真实情绪；reply_intent 写我方最适合采取的回复动作；intimacy_score 表示当前亲密推进空间。
- 回复流程必须是：先判断关系阶段，再判断场景和对方情绪，再判断我方 reply_intent，最后生成 3 到 5 组微信连续消息、6 个库存表情包检索意图和 next_topics。
- 现在你还是恋爱关系推进教练。必须分析整段聊天记录，而不是只看最后一句。relationship_memory_engine 要判断：当前 relationship_stage、亲密度 intimacy_score、吸引力 attraction_score、谁投入更多 investment_balance、谁先开启/推进 initiator、当前回复风险 risk_level、下一步最优动作 next_best_move。
- attraction_score 重点看对方是否主动：主动发消息、主动分享生活、主动查岗、主动问行程、主动分享照片、主动早安晚安、主动接梗、连续补充情绪。不要只因为用户想推进就打高分。
- investment_balance 要看整段对话里双方消息数量、字数、问题数量、谁在延伸话题。user_investing_more 表示我方更用力；other_person_investing_more 表示对方更主动；balanced 表示双方差不多。
- reply_risk 判断当前最可能的回复风险：too_needy、too_cold、too_pushy、safe。身体不舒服或 emo 场景，太冷是风险；早期阶段强邀约或表白，太 pushy 是风险；对方连续短回还追问，too_needy。
- conversation_future 预测未来 3 轮对方可能如何回应。relationship_goal 给出当前阶段到下一阶段的今日目标和避免事项。coach_advice 像恋爱教练一样解释现在应该怎么推进。reply_explanation 要解释每组推荐回复的目的。next_5_moves 输出未来 5 步聊天路线。
- next_topics 给用户“接下来怎么聊”，不是一次发给对方的话。要写成后续追踪建议，例如半小时后问有没有好一点、明早问昨晚睡得好吗、如果她继续接球再怎么推进。
- 给 3 条最贴合“我方应该怎么回复”的 sticker_suggestions 作为库存检索意图，不要复读对方表面情绪，也不要编造具体文件名。表情包意图先判断 reply_intent，再选择适合我方发出的 emotion、scenario、relationship_stage、keywords 和可发送短配字 text。比如对方说“我讨厌你”这种暧昧撒娇冲突，不要给 angry，要给 shy / apology / comfort / love 方向来缓和、撒娇、哄对方。后端会从库存 catalog 中按相关性打分选出 6 个真实表情包。
- 少用“听起来”“感觉你”“那你平时”“有需要告诉我”“调整好状态”“看来”这类模板句。
- 候选要自然、有变化，但不要给每条回复套风格标签。`;

const REPLY_PERSPECTIVE_EXAMPLES = `【视角示例，只学习尺度和方向，不要照抄】
- 对方说“那你要我怎么哄”，是对方问应该如何哄我。可以回“先夸我两句，我看看诚意”，不要回“哄你？”
- 对方说“你感受到我的了吗”，可以回“感受到一点，再表现两集看看”。
- 对方说“我一直都在关心你啊”，可以回“那我先给你记一分”。
- 对方说“你不是说我很难懂吗，那你怎么就确定了呢”，是在追问判断依据。可以回“我瞎猜的，撤回刚刚那句”或“那我判断错了，你还是愿意理我的”。不要回“让我观察你这个难懂的秘密”。
- 对方连续说“我也不想 还没写完”“肚子疼头也疼”“不想上学”，是在倾诉，不是敷衍。身体不舒服场景优先行动，例如 messages: ["怎么啦？是胃疼还是着凉了？", "先躺下，喝点温水", "我给你点点热的和药"]。不要优先写“肚子和头一起疼也太难受了”这种复述句，不要教育她不要熬夜，也不要先玩梗。
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
候选必须是“我”准备发给“对方”的话，输出 3 到 5 组自然、简短、可以直接发送的回复。每组带 style，用 messages 表示 1 到 3 条微信连续消息，text 等于 messages 用换行拼起来；最多一组候选带问号。`;
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
    analysis: {
      type: 'object',
      additionalProperties: false,
      properties: {
        stage: {
          type: 'string',
          enum: ['ice_breaking', 'daily_connection', 'emotional_bonding', 'push_pull_flirting', 'offline_invitation', 'relationship_confirmation'],
        },
        scene: { type: 'string' },
        emotion: { type: 'string' },
        reply_intent: { type: 'string' },
        intimacy_score: { type: 'integer', minimum: 0, maximum: 100 },
      },
      required: ['stage', 'scene', 'emotion', 'reply_intent', 'intimacy_score'],
    },
    relationship_memory_engine: {
      type: 'object',
      additionalProperties: false,
      properties: {
        relationship_stage: {
          type: 'string',
          enum: ['ice_breaking', 'daily_connection', 'emotional_bonding', 'push_pull_flirting', 'offline_invitation', 'relationship_confirmation'],
        },
        intimacy_score: { type: 'integer', minimum: 0, maximum: 100 },
        attraction_score: { type: 'integer', minimum: 0, maximum: 100 },
        investment_balance: {
          type: 'string',
          enum: ['user_investing_more', 'balanced', 'other_person_investing_more'],
        },
        initiator: {
          type: 'string',
          enum: ['user', 'other_person', 'balanced', 'unclear'],
        },
        risk_level: {
          type: 'string',
          enum: ['too_needy', 'too_cold', 'too_pushy', 'safe'],
        },
        next_best_move: { type: 'string' },
      },
      required: ['relationship_stage', 'intimacy_score', 'attraction_score', 'investment_balance', 'initiator', 'risk_level', 'next_best_move'],
    },
    reply_risk: {
      type: 'string',
      enum: ['too_needy', 'too_cold', 'too_pushy', 'safe'],
    },
    conversation_future: {
      type: 'object',
      additionalProperties: false,
      properties: {
        next_reply_likely: { type: 'string' },
        second_reply_likely: { type: 'string' },
        third_reply_likely: { type: 'string' },
      },
      required: ['next_reply_likely', 'second_reply_likely', 'third_reply_likely'],
    },
    relationship_goal: {
      type: 'object',
      additionalProperties: false,
      properties: {
        current_stage: {
          type: 'string',
          enum: ['ice_breaking', 'daily_connection', 'emotional_bonding', 'push_pull_flirting', 'offline_invitation', 'relationship_confirmation'],
        },
        target_stage: {
          type: 'string',
          enum: ['ice_breaking', 'daily_connection', 'emotional_bonding', 'push_pull_flirting', 'offline_invitation', 'relationship_confirmation'],
        },
        today_should_do: { type: 'string' },
        avoid: { type: 'string' },
      },
      required: ['current_stage', 'target_stage', 'today_should_do', 'avoid'],
    },
    coach_advice: {
      type: 'object',
      additionalProperties: false,
      properties: {
        summary: { type: 'string' },
        do: {
          type: 'array',
          items: { type: 'string' },
        },
        avoid: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['summary', 'do', 'avoid'],
    },
    reply_explanation: {
      type: 'array',
      minItems: 3,
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          reply_index: { type: 'integer', minimum: 1, maximum: 5 },
          style: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['reply_index', 'style', 'reason'],
      },
    },
    next_5_moves: {
      type: 'array',
      minItems: 5,
      maxItems: 5,
      items: { type: 'string' },
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
    next_topics: {
      type: 'array',
      minItems: 2,
      maxItems: 6,
      items: { type: 'string' },
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
          style: { type: 'string' },
          text: { type: 'string' },
          messages: {
            type: 'array',
            minItems: 1,
            maxItems: 3,
            items: { type: 'string' },
          },
        },
        required: ['style', 'text', 'messages'],
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
    'analysis',
    'relationship_memory_engine',
    'reply_risk',
    'conversation_future',
    'relationship_goal',
    'coach_advice',
    'reply_explanation',
    'next_5_moves',
    'reply_strategy',
    'flirt_level',
    'is_chat_screenshot',
    'non_chat_reply',
    'chat_evidence',
    'conversation_summary',
    'chat_guide',
    'next_topics',
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
          style: { type: 'string' },
          text: { type: 'string' },
          messages: {
            type: 'array',
            minItems: 1,
            maxItems: 3,
            items: { type: 'string' },
          },
        },
        required: ['style', 'text', 'messages'],
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
    const debug = buildVisionDebug(imageParts);
    const promptDebug = buildVisionPromptDebug({
      imageParts,
      prompt: textPart.text,
      imageDetail: PRIMARY_IMAGE_DETAIL,
    });
    Object.assign(debug, promptDebug);
    const startedAt = Date.now();
    console.info(`[${requestId}] /api/analyze request accepted`, {
      hasOpenAIKey: true,
      imageCount: imageParts.length,
      mediaTypes: imageParts.map((part) => part.source.media_type),
      base64Lengths: imageParts.map((part) => part.source.data.length),
      totalBase64Length: imageParts.reduce((sum, part) => sum + part.source.data.length, 0),
      promptLength: promptDebug.prompt_length,
      systemPromptLength: promptDebug.system_prompt_length,
      userPromptLength: promptDebug.user_prompt_length,
      responseSchemaLength: promptDebug.response_schema_length,
      estimatedPromptTokens: promptDebug.estimated_prompt_tokens,
      estimatedSchemaTokens: promptDebug.estimated_schema_tokens,
      estimatedImageTokens: promptDebug.estimated_image_tokens,
      estimatedTotalInputTokens: promptDebug.estimated_total_input_tokens,
      imageDetail: promptDebug.image_detail,
      imageSummaries: debug.images,
      visitorIdPresent: Boolean(metadata.visitor_id),
      pagePath: metadata.page_path || '',
    });
    let lastError;

    for (const model of MODELS) {
      try {
        debug.vision_called = true;
        const rawText = await requestOpenAIAdvice({
          apiKey,
          model,
          imageParts,
          prompt: textPart.text,
          requestId,
        });
        debug.vision_success = true;
        debug.elapsed_ms = Date.now() - startedAt;
        let advice;
        try {
          advice = parseAdvice(rawText);
        } catch (parseError) {
          console.error(`[${requestId}] OpenAI content parse failed`, {
            summary: summarizeError(parseError),
            raw_text_length: rawText.length,
            raw_text_preview: rawText.slice(0, 1600),
            raw_text_tail: rawText.slice(-1000),
            elapsed_ms: Date.now() - startedAt,
          });
          parseError.providerStatus = parseError.providerStatus || 503;
          parseError.providerCode = parseError.providerCode || 'invalid_json';
          throw parseError;
        }
        debug.extracted_text = buildDebugExtractedText(advice);
        debug.scene_detected = advice.analysis?.scene || '';
        debug.is_chat_screenshot = advice.is_chat_screenshot === true;
        debug.needs_retry = advice.needs_retry === true;
        console.info(`[${requestId}] Vision extracted chat text`, {
          extracted_text: debug.extracted_text,
          scene_detected: debug.scene_detected,
          is_chat_screenshot: debug.is_chat_screenshot,
          elapsed_ms: debug.elapsed_ms,
        });

        if (needsReplyRefinement(advice)) {
          advice = await refineOrRepairAdvice({ apiKey, model, advice });
        }
        debug.elapsed_ms = Date.now() - startedAt;

        queueUsageLog({ req, advice, imageParts, metadata, model });

        return res.status(200).json({
          content: [{ type: 'text', text: JSON.stringify(advice) }],
          model,
          debug,
        });
      } catch (error) {
        lastError = error;
        debug.vision_success = false;
        debug.vision_timeout = error?.providerCode === 'timeout';
        debug.elapsed_ms = Date.now() - startedAt;
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
      const isTimeout = lastError?.providerCode === 'timeout';
      const advice = isTimeout ? buildVisionTimeoutFallbackAdvice() : buildFreeTierFallbackAdvice();
      const debug = buildVisionDebug(imageParts, {
        ...promptDebug,
        vision_called: true,
        vision_success: false,
        vision_timeout: isTimeout,
        fallback_used: true,
        elapsed_ms: Date.now() - startedAt,
      });
      queueUsageLog({ req, advice, imageParts, metadata, model: 'fallback', degraded: true });
      return res.status(200).json({
        content: [{ type: 'text', text: JSON.stringify(advice) }],
        degraded: true,
        reason: isTimeout ? 'vision-timeout' : 'service-unavailable',
        debug,
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

  const imageParts = dedupeImageParts(content.filter((part) => part.type === 'image'));
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

function dedupeImageParts(imageParts) {
  const seen = new Set();
  return imageParts.filter((part) => {
    const key = `${part?.source?.media_type || ''}:${part?.source?.data || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getApproxBase64Bytes(base64 = '') {
  if (!base64) return 0;
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

function toPositiveInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

function formatBytes(bytes) {
  if (!bytes) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  return `${Math.round(bytes / 1024)} KB`;
}

function estimateTextTokens(text = '') {
  return Math.ceil(String(text || '').length / 2);
}

function estimateImageTokensForDetail(imagePart, detail = PRIMARY_IMAGE_DETAIL) {
  if (detail === 'low') return 85;
  const width = toPositiveInteger(imagePart?.source?.width);
  const height = toPositiveInteger(imagePart?.source?.height);
  if (!width || !height) return 85;

  const scale = Math.min(1, 2048 / Math.max(width, height));
  const scaledWidth = Math.ceil(width * scale);
  const scaledHeight = Math.ceil(height * scale);
  const tileCount = Math.ceil(scaledWidth / 512) * Math.ceil(scaledHeight / 512);
  return 85 + tileCount * 170;
}

function buildVisionPromptDebug({
  imageParts = [],
  prompt = '',
  systemPrompt = PRIMARY_SYSTEM_PROMPT,
  responseSchema = CHAT_ADVICE_SCHEMA,
  imageDetail = PRIMARY_IMAGE_DETAIL,
} = {}) {
  const schemaString = JSON.stringify(responseSchema);
  const imageInstructionText = imageParts
    .map((_, index) => `上传图片 ${index + 1}/${imageParts.length}。先判断它是否为聊天截图；多张有效聊天截图按此顺序从旧到新排列。`)
    .join('\n');
  const promptLength = systemPrompt.length + prompt.length + imageInstructionText.length;
  const schemaLength = schemaString.length;
  const estimatedPromptTokens = estimateTextTokens(`${systemPrompt}\n${imageInstructionText}\n${prompt}`);
  const estimatedSchemaTokens = estimateTextTokens(schemaString);
  const estimatedImageTokens = imageParts.reduce(
    (sum, part) => sum + estimateImageTokensForDetail(part, imageDetail),
    0,
  );

  return {
    prompt_length: promptLength,
    user_prompt_length: prompt.length,
    system_prompt_length: systemPrompt.length,
    response_schema_length: schemaLength,
    estimated_prompt_tokens: estimatedPromptTokens,
    estimated_schema_tokens: estimatedSchemaTokens,
    estimated_image_tokens: estimatedImageTokens,
    estimated_total_input_tokens: estimatedPromptTokens + estimatedSchemaTokens + estimatedImageTokens,
    image_detail: imageDetail,
  };
}

function buildVisionDebug(imageParts, overrides = {}) {
  const imageSummaries = imageParts.map((part, index) => {
    const approxBytes = getApproxBase64Bytes(part?.source?.data || '');
    const width = toPositiveInteger(part?.source?.width);
    const height = toPositiveInteger(part?.source?.height);
    const originalWidth = toPositiveInteger(part?.source?.original_width);
    const originalHeight = toPositiveInteger(part?.source?.original_height);
    const originalSizeBytes = toPositiveInteger(part?.source?.original_size_bytes);
    const compressedSizeBytes = toPositiveInteger(part?.source?.compressed_size_bytes) || approxBytes;
    return {
      index,
      mime_type: part?.source?.media_type || '',
      base64_length: part?.source?.data?.length || 0,
      approx_bytes: approxBytes,
      approx_size: formatBytes(approxBytes),
      image_width: width,
      image_height: height,
      original_width: originalWidth,
      original_height: originalHeight,
      original_size_bytes: originalSizeBytes,
      compressed_size_bytes: compressedSizeBytes,
      image_size_kb: Math.round((compressedSizeBytes / 1024) * 10) / 10,
      data_prefix: (part?.source?.data || '').slice(0, 24),
    };
  });
  return {
    image_received: imageParts.length > 0,
    image_count: imageParts.length,
    image_size: imageSummaries.map((image) => image.approx_size).join(', '),
    images: imageSummaries,
    payload: {
      transport: 'json_base64_image_url',
      content_type: 'application/json',
      image_array_length: imageParts.length,
      mime_types: imageSummaries.map((image) => image.mime_type),
      base64_lengths: imageSummaries.map((image) => image.base64_length),
    },
    image_size_kb: imageSummaries.map((image) => image.image_size_kb).join(', '),
    image_width: imageSummaries.map((image) => image.image_width || '').join(', '),
    image_height: imageSummaries.map((image) => image.image_height || '').join(', '),
    base64_length: imageSummaries.map((image) => image.base64_length).join(', '),
    prompt_length: 0,
    estimated_prompt_tokens: 0,
    estimated_image_tokens: 0,
    estimated_total_input_tokens: 0,
    vision_called: false,
    vision_success: false,
    vision_timeout: false,
    ocr_called: false,
    ocr_success: false,
    fallback_used: false,
    elapsed_ms: 0,
    extracted_text: '',
    scene_detected: '',
    is_chat_screenshot: false,
    needs_retry: false,
    ...overrides,
  };
}

function buildDebugExtractedText(advice) {
  const dialogueText = Array.isArray(advice?.dialogue)
    ? advice.dialogue.map((message) => `${message.speaker || ''}:${message.text || ''}`).join(' | ')
    : '';
  return cleanText(dialogueText || advice?.conversation_summary || '', 500);
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
  requestId = 'analyze',
  imageDetail = PRIMARY_IMAGE_DETAIL,
  maxCompletionTokens = PRIMARY_MAX_COMPLETION_TOKENS,
  responseSchema = CHAT_ADVICE_SCHEMA,
  systemPrompt = PRIMARY_SYSTEM_PROMPT,
  timeoutMs = PRIMARY_OPENAI_TIMEOUT_MS,
}) {
  const requestStartedAt = Date.now();
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
  const promptDebug = buildVisionPromptDebug({
    imageParts,
    prompt,
    systemPrompt,
    responseSchema,
    imageDetail,
  });
  const imagePayload = imageParts.map((part, index) => {
    const approxBytes = getApproxBase64Bytes(part.source.data);
    const compressedSizeBytes = toPositiveInteger(part.source.compressed_size_bytes) || approxBytes;
    return {
      index,
      mimeType: part.source.media_type,
      base64Length: part.source.data.length,
      approxBytes,
      imageSizeKb: Math.round((compressedSizeBytes / 1024) * 10) / 10,
      imageWidth: toPositiveInteger(part.source.width),
      imageHeight: toPositiveInteger(part.source.height),
      originalWidth: toPositiveInteger(part.source.original_width),
      originalHeight: toPositiveInteger(part.source.original_height),
      originalSizeBytes: toPositiveInteger(part.source.original_size_bytes),
      compressedSizeBytes,
      dataPrefix: part.source.data.slice(0, 24),
    };
  });

  console.log({
    image_size_kb: imagePayload.map((image) => image.imageSizeKb).join(', '),
    image_width: imagePayload.map((image) => image.imageWidth || '').join(', '),
    image_height: imagePayload.map((image) => image.imageHeight || '').join(', '),
    base64_length: imagePayload.map((image) => image.base64Length).join(', '),
    prompt_length: promptDebug.prompt_length,
    model,
    elapsed_ms: 0,
  });

  console.info(`[${requestId}] OpenAI Vision payload`, {
    model,
    imageCount: imageParts.length,
    imageDetail,
    imagePayload,
    promptLength: promptDebug.prompt_length,
    userPromptLength: promptDebug.user_prompt_length,
    systemPromptLength: promptDebug.system_prompt_length,
    responseSchemaLength: promptDebug.response_schema_length,
    estimatedPromptTokens: promptDebug.estimated_prompt_tokens,
    estimatedSchemaTokens: promptDebug.estimated_schema_tokens,
    estimatedImageTokens: promptDebug.estimated_image_tokens,
    estimatedTotalInputTokens: promptDebug.estimated_total_input_tokens,
    maxCompletionTokens,
    timeoutMs,
  });

  let response;
  try {
    response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
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
    }, timeoutMs);
  } catch (error) {
    console.error(`[${requestId}] OpenAI Vision transport failed`, {
      elapsed_ms: Date.now() - requestStartedAt,
      providerStatus: error?.providerStatus || null,
      providerCode: error?.providerCode || '',
      message: cleanText(error?.message || '', 500),
      raw_response: null,
    });
    throw error;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    console.error(`[${requestId}] OpenAI raw response`, {
      status: response.status,
      elapsed_ms: Date.now() - requestStartedAt,
      raw_response: data,
    });
    const providerError = new Error(data.error?.message || `OpenAI request failed with ${response.status}`);
    providerError.providerStatus = response.status;
    providerError.providerCode = data.error?.code || '';
    throw providerError;
  }

  const choice = data.choices?.[0] || {};
  const finishReason = choice.finish_reason || '';
  const text = choice.message?.content?.trim();
  if (!text) {
    console.error(`[${requestId}] OpenAI returned empty content`, {
      elapsed_ms: Date.now() - requestStartedAt,
      finish_reason: finishReason,
      raw_response: data,
    });
    const emptyError = new Error('OpenAI returned an empty response');
    emptyError.providerStatus = 503;
    emptyError.providerCode = finishReason || '';
    throw emptyError;
  }

  console.info(`[${requestId}] OpenAI Vision completed`, {
    model,
    elapsed_ms: Date.now() - requestStartedAt,
    output_length: text.length,
    finish_reason: finishReason,
    content_preview: text.slice(0, 600),
    content_tail: text.slice(-400),
  });
  console.log({
    image_size_kb: imagePayload.map((image) => image.imageSizeKb).join(', '),
    image_width: imagePayload.map((image) => image.imageWidth || '').join(', '),
    image_height: imagePayload.map((image) => image.imageHeight || '').join(', '),
    base64_length: imagePayload.map((image) => image.base64Length).join(', '),
    prompt_length: promptDebug.prompt_length,
    model,
    elapsed_ms: Date.now() - requestStartedAt,
  });

  return text;
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error(`OpenAI request timed out after ${timeoutMs}ms`);
      timeoutError.providerStatus = 408;
      timeoutError.providerCode = 'timeout';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function requestOpenAIReplyRefinement({ apiKey, model, advice }) {
  return requestOpenAIAdvice({
    apiKey,
    model,
    prompt: buildReplyRefinementPrompt('', advice),
    maxCompletionTokens: REFINEMENT_MAX_COMPLETION_TOKENS,
    responseSchema: REPLY_REFINEMENT_SCHEMA,
    systemPrompt: REPLY_REFINEMENT_SYSTEM_PROMPT,
    timeoutMs: REFINEMENT_OPENAI_TIMEOUT_MS,
  });
}

async function refineOrRepairAdvice({ apiKey, model, advice }) {
  const localRepair = repairReplyCandidates(advice);
  if (localRepair !== advice && !needsReplyRefinement(localRepair)) {
    return localRepair;
  }

  try {
    const refinedText = await requestOpenAIReplyRefinement({
      apiKey,
      model,
      advice,
    });
    const refinedAdvice = mergeRefinedReplies(advice, refinedText);
    return needsReplyRefinement(refinedAdvice)
      ? (localRepair !== advice ? localRepair : repairReplyCandidates(refinedAdvice))
      : refinedAdvice;
  } catch (error) {
    console.warn(`OpenAI reply refinement skipped/failed: ${summarizeError(error)}`);
    return localRepair !== advice ? localRepair : repairReplyCandidates(advice);
  }
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
  const modelNeedsRetry = Boolean(value.needs_retry);
  const dialogue = normalizeDialogue(value.dialogue);
  const chatEvidence = normalizeChatEvidence(value.chat_evidence);
  const isChatScreenshot = isVerifiedChatScreenshot(value, dialogue, chatEvidence);
  const needsRetry = modelNeedsRetry || (isChatScreenshot && dialogue.length < 2);
  const verifiedDialogue = isChatScreenshot ? dialogue : [];
  const emotionalDisclosure = isChatScreenshot && hasRecentEmotionalDisclosure(verifiedDialogue);
  const activeCuriosity = isChatScreenshot && !emotionalDisclosure && hasActiveCuriosity(verifiedDialogue);
  const suggestStop = isChatScreenshot && !emotionalDisclosure && (Boolean(value.suggest_stop) || hasRepeatedColdReplies(verifiedDialogue));
  const conversationStage = inferConversationStage(value.conversation_stage, { emotionalDisclosure, activeCuriosity, suggestStop });
  const conversationMode = isChatScreenshot ? (emotionalDisclosure ? '情绪倾诉' : activeCuriosity ? '主动了解' : normalizeConversationMode(value.conversation_mode)) : '礼貌回应';
  const flirtLevel = isChatScreenshot ? (emotionalDisclosure ? '先别暧昧' : normalizeFlirtLevel(value.flirt_level)) : '先别暧昧';
  const detectedScene = isChatScreenshot
    ? detectScene({
        dialogue: verifiedDialogue,
        text: [value.conversation_summary, value.reply_strategy].filter(Boolean).join(' '),
        modelAnalysis: value.analysis,
        conversationStage,
      })
    : null;
  const coachAnalysis = isChatScreenshot
    ? normalizeCoachAnalysis(value.analysis, {
        scene: detectedScene,
        dialogue: verifiedDialogue,
        conversationStage,
        interestScore: value.interest_score,
      })
    : {
        stage: 'ice_breaking',
        stage_label: RELATIONSHIP_STAGE_LABELS.ice_breaking,
        scene: '',
        scene_id: '',
        emotion: '',
        reply_intent: '',
        intimacy_score: 0,
      };
  const memoryContext = {
    dialogue: verifiedDialogue,
    coachAnalysis,
    scene: detectedScene,
    conversationStage,
    conversationMode,
    flirtLevel,
    suggestStop,
    emotionalDisclosure,
    activeCuriosity,
  };
  const relationshipMemory = isChatScreenshot
    ? normalizeRelationshipMemoryEngine(value.relationship_memory_engine, memoryContext)
    : {
        relationship_stage: 'ice_breaking',
        intimacy_score: 0,
        attraction_score: 0,
        investment_balance: 'balanced',
        initiator: 'unclear',
        risk_level: 'safe',
        next_best_move: '',
      };
  const replyRisk = isChatScreenshot ? normalizeReplyRisk(value.reply_risk, relationshipMemory) : 'safe';
  const relationshipGoal = isChatScreenshot ? normalizeRelationshipGoal(value.relationship_goal, relationshipMemory) : normalizeRelationshipGoal({}, relationshipMemory);
  const conversationFuture = isChatScreenshot
    ? normalizeConversationFuture(value.conversation_future, { relationshipMemory, scene: detectedScene })
    : normalizeConversationFuture({}, { relationshipMemory, scene: detectedScene });
  const coachAdvice = isChatScreenshot
    ? normalizeCoachAdvice(value.coach_advice, { relationshipMemory, relationshipGoal, scene: detectedScene })
    : normalizeCoachAdvice({}, { relationshipMemory, relationshipGoal, scene: detectedScene });
  const replyExplanation = isChatScreenshot
    ? normalizeReplyExplanations(value.reply_explanation, replies, { relationshipMemory, scene: detectedScene })
    : [];
  const next5Moves = isChatScreenshot
    ? normalizeNext5Moves(value.next_5_moves, { relationshipMemory, relationshipGoal, scene: detectedScene })
    : [];
  const nextTopics = isChatScreenshot ? normalizeNextTopics(value.next_topics, detectedScene) : [];
  const fallbackGuide = emotionalDisclosure ? buildEmotionalDisclosureGuide() : activeCuriosity ? buildActiveCuriosityGuide() : buildStageChatGuide(conversationStage);
  const chatGuide = isChatScreenshot ? buildSceneChatGuide(detectedScene, normalizeChatGuide(value.chat_guide, fallbackGuide)) : buildDefaultChatGuide();
  const stickerMatchIntent = isChatScreenshot ? buildStickerMatchIntent({
    rawSuggestions: value.sticker_suggestions,
    conversationStage,
    conversationMode,
    flirtLevel,
    dialogue: verifiedDialogue,
    suggestStop,
    emotionalDisclosure,
    activeCuriosity,
    analysis: coachAnalysis,
    scene: detectedScene,
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
    analysis: coachAnalysis,
    relationship_memory_engine: relationshipMemory,
    relationship_stage: relationshipMemory.relationship_stage,
    intimacy_score: relationshipMemory.intimacy_score,
    attraction_score: relationshipMemory.attraction_score,
    investment_balance: relationshipMemory.investment_balance,
    initiator: relationshipMemory.initiator,
    reply_risk: replyRisk,
    risk_level: relationshipMemory.risk_level,
    next_best_move: relationshipMemory.next_best_move,
    conversation_future: conversationFuture,
    relationship_goal: relationshipGoal,
    coach_advice: coachAdvice,
    reply_explanation: replyExplanation,
    next_5_moves: next5Moves,
    reply_strategy: isChatScreenshot ? (emotionalDisclosure ? '先回应她现在的不舒服，给她一点喘息空间，等她愿意继续说再慢慢接话。' : activeCuriosity ? '先认真回答她最后的问题，给一个真实细节，再顺着她的反应慢慢展开。' : cleanText(value.reply_strategy, 100)) : '',
    flirt_level: flirtLevel,
    is_chat_screenshot: isChatScreenshot,
    non_chat_reply: cleanText(value.non_chat_reply, 120) || (!isChatScreenshot ? getDefaultNonChatReply() : ''),
    chat_evidence: chatEvidence,
    conversation_summary: isChatScreenshot ? buildDialogueSummary(verifiedDialogue) || cleanText(value.conversation_summary, 260) : '',
    chat_guide: chatGuide,
    next_topics: nextTopics,
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
  const relationshipMemory = {
    relationship_stage: 'ice_breaking',
    intimacy_score: 0,
    attraction_score: 0,
    investment_balance: 'balanced',
    initiator: 'unclear',
    risk_level: 'safe',
    next_best_move: '',
  };
  const relationshipGoal = normalizeRelationshipGoal({}, relationshipMemory);
  return { attitude_label: '服务暂时繁忙', attitude_desc: '当前分析服务暂时不可用。为了避免给你不准确的建议，本次不会猜测截图内容，请稍后点击"重新分析"。', interest_score: 0, interest_level: '低意愿', interest_signals: [], conversation_mode: '礼貌回应', conversation_stage: '初次认识', analysis: { stage: 'ice_breaking', stage_label: RELATIONSHIP_STAGE_LABELS.ice_breaking, scene: '', scene_id: '', emotion: '', reply_intent: '', intimacy_score: 0 }, relationship_memory_engine: relationshipMemory, relationship_stage: 'ice_breaking', intimacy_score: 0, attraction_score: 0, investment_balance: 'balanced', initiator: 'unclear', reply_risk: 'safe', risk_level: 'safe', next_best_move: '', conversation_future: normalizeConversationFuture({}, { relationshipMemory, scene: null }), relationship_goal: relationshipGoal, coach_advice: normalizeCoachAdvice({}, { relationshipMemory, relationshipGoal, scene: null }), reply_explanation: [], next_5_moves: [], reply_strategy: '', flirt_level: '先别暧昧', is_chat_screenshot: true, non_chat_reply: '', chat_evidence: {}, conversation_summary: '', chat_guide: buildDefaultChatGuide(), next_topics: [], dialogue: [], suggest_stop: false, needs_retry: true, degraded: true, replies: [], sticker_match_intent: null, sticker_suggestions: [] };
}

function buildVisionTimeoutFallbackAdvice() {
  const advice = buildFreeTierFallbackAdvice();
  return {
    ...advice,
    attitude_label: '识图超时',
    attitude_desc: '截图已经收到，但 OpenAI Vision 分析超过 25 秒。这不是“非聊天截图”，只是本次识图超时；请直接点重新分析，或稍后再试。',
    non_chat_reply: '',
    is_chat_screenshot: true,
    needs_retry: true,
    degraded: true,
    chat_evidence: {
      image_kind: 'chat screenshot pending vision',
      has_message_bubbles: true,
      has_chat_ui: true,
      has_two_sided_layout: false,
    },
    conversation_summary: '',
    chat_guide: {
      current_move: '本次 Vision 识图超时，先不要根据空结果判断关系。',
      next_steps: [
        '直接点击重新分析，图片会重新走 Vision。',
        '如果连续超时，可以先裁剪到只保留聊天区域。',
        '不要把这次结果当成“不是聊天截图”。',
      ],
      avoid: '不要因为超时结论误删图片或改动聊天分析逻辑。',
    },
  };
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
  const candidate = {
    text: messages.join('\n'),
    messages,
  };
  const style = cleanText(reply?.style, 18);
  if (style) candidate.style = style;
  return candidate;
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

const SCENE_LIBRARY_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'chat', 'scene-library.json');
const RELATIONSHIP_ENGINE_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'chat', 'relationship-engine.v1.json');
const STICKER_LIBRARY_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'stickers', 'sticker-library.json');
const STICKER_CATALOG_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'stickers', 'catalog.v1.json');
const RELATIONSHIP_STAGES = new Set(['ice_breaking', 'daily_connection', 'emotional_bonding', 'push_pull_flirting', 'offline_invitation', 'relationship_confirmation']);
const RELATIONSHIP_STAGE_LABELS = {
  ice_breaking: '破冰期',
  daily_connection: '日常连接期',
  emotional_bonding: '情绪共鸣期',
  push_pull_flirting: '推拉暧昧期',
  offline_invitation: '线下邀约期',
  relationship_confirmation: '关系确认期',
};
const LEGACY_STAGE_TO_RELATIONSHIP_STAGE = {
  初次认识: 'ice_breaking',
  轻松破冰: 'ice_breaking',
  稳定了解: 'daily_connection',
  暧昧升温: 'push_pull_flirting',
  情绪陪伴: 'emotional_bonding',
  建议停手: 'ice_breaking',
};
const CHAT_SCENE_LIBRARY = loadSceneLibrary();
const RELATIONSHIP_ENGINE_CONFIG = loadRelationshipEngineConfig();
const STICKER_LIBRARY = loadStickerLibrary();
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
  care_action_support: {
    emotion: 'comfort',
    secondary_emotions: ['encourage', 'goodnight', 'love'],
    scenario: ['comfort', 'hug', 'encouragement', 'good_night'],
    keywords: ['抱抱', '摸头', '盖被子', '递热水', '守护', '陪你', '喝点热的'],
    intensity: 3,
  },
  emotional_comfort: {
    emotion: 'comfort',
    secondary_emotions: ['sad', 'cry', 'love'],
    scenario: ['comfort', 'hug'],
    keywords: ['抱抱', '摸头', '我在呢', '陪你', '不哭'],
    intensity: 3,
  },
  reassure_jealousy: {
    emotion: 'shy',
    secondary_emotions: ['love', 'comfort', 'apology'],
    scenario: ['jealousy', 'flirting', 'comfort'],
    keywords: ['乖乖报备', '别吃醋', '哄你', '小醋包', '安心'],
    intensity: 3,
    avoid_emotions: ['angry'],
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
  low_pressure_invite: {
    emotion: 'happy',
    secondary_emotions: ['excited', 'shy'],
    scenario: ['celebration', 'agree', 'flirting'],
    keywords: ['好耶', '期待', '一起', '约饭'],
    intensity: 3,
  },
  soft_confirm_interest: {
    emotion: 'shy',
    secondary_emotions: ['love', 'happy'],
    scenario: ['confession', 'flirting'],
    keywords: ['心动', '认真', '喜欢', '害羞'],
    intensity: 3,
  },
  confirm_relationship: {
    emotion: 'love',
    secondary_emotions: ['shy', 'comfort'],
    scenario: ['confession', 'hug'],
    keywords: ['喜欢你', '认真', '安心', '抱抱'],
    intensity: 4,
  },
  steady_value_reply: {
    emotion: 'thinking',
    secondary_emotions: ['comfort', 'love'],
    scenario: ['comfort', 'flirting'],
    keywords: ['认真', '安心', '听你说'],
    intensity: 2,
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

function loadSceneLibrary() {
  try {
    const library = JSON.parse(readFileSync(SCENE_LIBRARY_PATH, 'utf8'));
    const scenes = Array.isArray(library.scenes) ? library.scenes.filter((scene) => scene?.id && scene?.scene) : [];
    return { ...library, scenes };
  } catch (error) {
    console.warn(`Scene library failed to load: ${error.message}`);
    return { version: '0.0.0', relationship_stages: RELATIONSHIP_STAGE_LABELS, scenes: [] };
  }
}

function loadRelationshipEngineConfig() {
  try {
    const config = JSON.parse(readFileSync(RELATIONSHIP_ENGINE_PATH, 'utf8'));
    return {
      relationship_stages: config.relationship_stages || {},
      reply_risks: config.reply_risks || {},
    };
  } catch (error) {
    console.warn(`Relationship engine config failed to load: ${error.message}`);
    return { relationship_stages: {}, reply_risks: {} };
  }
}

function loadStickerLibrary() {
  try {
    const library = JSON.parse(readFileSync(STICKER_LIBRARY_PATH, 'utf8'));
    return {
      default_text_by_tag: library.default_text_by_tag || {},
      scene_to_sticker_strategy: library.scene_to_sticker_strategy || {},
      scene_text_fallbacks: library.scene_text_fallbacks || {},
    };
  } catch (error) {
    console.warn(`Sticker strategy library failed to load: ${error.message}`);
    return { default_text_by_tag: {}, scene_to_sticker_strategy: {}, scene_text_fallbacks: {} };
  }
}

function loadStickerCatalog() {
  try {
    const catalog = JSON.parse(readFileSync(STICKER_CATALOG_PATH, 'utf8'));
    return Array.isArray(catalog.items) ? catalog.items : [];
  } catch (error) {
    console.warn(`Sticker catalog failed to load: ${error.message}`);
    return [];
  }
}

function getSceneSearchText(dialogue = [], extraText = '') {
  return [
    recentDialogueText(dialogue, 16),
    cleanText(extraText, 500),
  ].filter(Boolean).join(' ');
}

function getSceneById(id) {
  return CHAT_SCENE_LIBRARY.scenes.find((scene) => scene.id === id) || null;
}

function normalizeSceneRecord(scene) {
  if (!scene || typeof scene !== 'object') return null;
  return {
    id: cleanText(scene.id, 80),
    scene: cleanText(scene.scene, 40),
    variant: cleanText(scene.variant, 40),
    stage: RELATIONSHIP_STAGES.has(scene.stage) ? scene.stage : 'daily_connection',
    triggers: normalizeCatalogList(scene.triggers).slice(0, 12),
    psychology: cleanText(scene.psychology, 220),
    goals: normalizeCatalogList(scene.goals).slice(0, 6),
    reply_strategy: normalizeCatalogList(scene.reply_strategy).slice(0, 6),
    sticker_strategy: normalizeCatalogList(scene.sticker_strategy).slice(0, 8),
    next_topics: normalizeCatalogList(scene.next_topics).slice(0, 6),
  };
}

function scoreScene(scene, text, dialogue = []) {
  const haystack = cleanText(text, 1200).toLowerCase();
  if (!haystack) return 0;
  let score = 0;
  normalizeCatalogList(scene.triggers).forEach((trigger) => {
    const normalized = trigger.toLowerCase();
    if (normalized && haystack.includes(normalized)) score += Math.max(12, normalized.length * 2);
  });

  if (scene.scene === '身体不舒服' && hasPhysicalDiscomfort(dialogue)) score += 80;
  if ((scene.scene === '工作压力' || scene.scene === '学习压力') && hasStudyStress(dialogue)) score += 45;
  if (scene.scene === '晚安' && /晚安|睡觉|睡了|好梦|早点睡/.test(haystack)) score += 80;
  if (scene.scene === '想你' && /想你|想我|想见|见不到/.test(haystack)) score += 70;
  if (scene.scene === '吃醋' && /跟谁|谁啊|谁出去|女生吗|男生吗|吃醋/.test(haystack)) score += 75;
  if (scene.scene === '查岗' && /你在哪|在干嘛|跟谁|去哪|什么时候回来|为什么不回/.test(haystack)) score += 70;
  if (scene.scene === 'emo 动态' && /emo|破防|崩溃|心情不好|低落|丧|不想说话/.test(haystack)) score += 80;
  if (scene.scene === '失眠' && /失眠|睡不着|脑子停不下来|凌晨|熬夜/.test(haystack)) score += 70;
  if (scene.scene === '早安' && /早安|早上好|早呀|起床/.test(haystack)) score += 70;
  if (scene.scene === '撒娇' && /讨厌你|不理你|你哄我|哄我|哼/.test(haystack)) score += 65;
  if (scene.scene === '委屈' && /委屈|想哭|被欺负|没人懂|不开心/.test(haystack)) score += 65;
  if (scene.scene === '生气' && /生气|气死|烦死|火大|别惹我/.test(haystack)) score += 55;
  if ((scene.scene === '工作压力' || scene.scene === '学习压力') && /好累|太累|累死|撑不住|不想上学|没写完/.test(haystack)) score += 58;

  return score;
}

function detectScene({ dialogue = [], text = '', modelAnalysis = {}, conversationStage = '轻松破冰' } = {}) {
  const explicitScene = cleanText(modelAnalysis?.scene, 40);
  const searchText = getSceneSearchText(dialogue, `${text} ${explicitScene}`);
  if (hasPhysicalDiscomfort(dialogue)) {
    const sickScene = getSceneById('sick_001') || CHAT_SCENE_LIBRARY.scenes.find((scene) => scene.scene === '身体不舒服');
    if (sickScene) return normalizeSceneRecord(sickScene);
  }
  if (conversationStage === '稳定了解' && hasActiveCuriosity(dialogue) && !hasRecentEmotionalDisclosure(dialogue) && !explicitScene) {
    return normalizeSceneRecord({
      id: 'generic_active_curiosity',
      scene: '主动了解',
      variant: '通用',
      stage: 'daily_connection',
      triggers: [],
      psychology: '对方在主动了解你，重点是认真回答一个具体点，再留一个她容易接住的入口。',
      goals: ['回应问题', '展示真实细节', '制造下一句话'],
      reply_strategy: ['认真回答', '补一个细节', '轻轻反问'],
      sticker_strategy: ['收到', '开心', '偷看'],
      next_topics: ['先回答她最后问的那个点。', '给一个真实但不过度暴露的小细节。', '她继续接球后，再自然聊到共同兴趣或轻松邀约。'],
    });
  }
  const explicitMatch = explicitScene
    ? CHAT_SCENE_LIBRARY.scenes.find((scene) => scene.scene === explicitScene || scene.id === explicitScene)
    : null;
  if (explicitMatch) return normalizeSceneRecord(explicitMatch);

  const scored = CHAT_SCENE_LIBRARY.scenes
    .map((scene) => ({ scene, score: scoreScene(scene, searchText, dialogue) }))
    .sort((a, b) => b.score - a.score || a.scene.id.localeCompare(b.scene.id));

  const best = scored[0]?.score > 0 ? scored[0].scene : null;
  if (best) return normalizeSceneRecord(best);

  const fallbackStage = LEGACY_STAGE_TO_RELATIONSHIP_STAGE[conversationStage] || 'daily_connection';
  return normalizeSceneRecord({
    id: 'generic_001',
    scene: '日常聊天',
    variant: '通用',
    stage: fallbackStage,
    triggers: [],
    psychology: '当前场景信息较少，先保持轻松、具体、容易接住。',
    goals: ['维持连接', '制造下一句话'],
    reply_strategy: ['接住最后一句', '补一个具体细节', '观察对方是否继续接球'],
    sticker_strategy: ['收到', '开心', '偷看'],
    next_topics: ['先顺着最后一句回一个具体点。', '如果对方继续接球，再交换一个日常细节。', '不要一次连续追问太多。'],
  });
}

function inferEmotionForScene(scene, dialogue = []) {
  const sceneName = scene?.scene || '';
  const text = getSceneSearchText(dialogue);
  if (/身体不舒服|工作压力|学习压力|失眠|emo 动态|委屈/.test(sceneName)) return /哭|想哭|委屈/.test(text) ? 'sad' : 'comfort';
  if (sceneName === '晚安') return 'goodnight';
  if (sceneName === '早安') return 'greeting';
  if (/想你|梦到你|深夜聊天/.test(sceneName)) return 'miss_you';
  if (/撒娇|表白试探|夸照片|换发型/.test(sceneName)) return 'shy';
  if (/吃醋|查岗/.test(sceneName)) return 'jealous';
  if (sceneName === '生气') return 'angry';
  if (/分享歌曲|分享照片|发朋友圈|生日|节日/.test(sceneName)) return 'happy';
  if (/邀约吃饭|邀约电影|约咖啡/.test(sceneName)) return 'excited';
  if (sceneName === '关系确认') return 'love';
  if (sceneName === '前任话题' || sceneName === '感情观') return 'thinking';
  return 'happy';
}

function inferReplyIntentForScene(scene, emotion = '') {
  const sceneName = scene?.scene || '';
  if (sceneName === '身体不舒服') return 'care_action_support';
  if (/工作压力|学习压力/.test(sceneName)) return 'encourage_support';
  if (/失眠|emo 动态|委屈/.test(sceneName)) return 'emotional_comfort';
  if (sceneName === '晚安') return 'say_goodnight_back';
  if (sceneName === '早安') return 'warm_greeting';
  if (/想你|梦到你|深夜聊天/.test(sceneName)) return 'affectionate_reply';
  if (sceneName === '撒娇') return 'soften_flirty_conflict';
  if (/吃醋|查岗/.test(sceneName)) return 'reassure_jealousy';
  if (sceneName === '生气') return 'soften_flirty_conflict';
  if (/邀约吃饭|邀约电影|约咖啡/.test(sceneName)) return 'low_pressure_invite';
  if (sceneName === '表白试探') return 'soft_confirm_interest';
  if (sceneName === '关系确认') return 'confirm_relationship';
  if (/分享歌曲|分享照片|发朋友圈|换头像|换发型|夸照片/.test(sceneName)) return 'playful_continue';
  if (sceneName === '前任话题' || sceneName === '感情观') return 'steady_value_reply';
  return emotion === 'comfort' ? 'comfort_support' : 'warm_continue';
}

function normalizeCoachAnalysis(rawAnalysis, { scene, dialogue, conversationStage, interestScore }) {
  const inferredEmotion = inferEmotionForScene(scene, dialogue);
  const emotion = cleanText(rawAnalysis?.emotion, 32) || inferredEmotion;
  const inferredStage = scene?.stage || LEGACY_STAGE_TO_RELATIONSHIP_STAGE[conversationStage] || 'daily_connection';
  const stage = RELATIONSHIP_STAGES.has(rawAnalysis?.stage) ? rawAnalysis.stage : inferredStage;
  const replyIntent = cleanText(rawAnalysis?.reply_intent, 48) || inferReplyIntentForScene(scene, emotion);
  const intimacyScore = clampScore(Number.isFinite(Number(rawAnalysis?.intimacy_score)) ? rawAnalysis.intimacy_score : interestScore);
  return {
    stage,
    stage_label: RELATIONSHIP_STAGE_LABELS[stage] || '',
    scene: scene?.scene || cleanText(rawAnalysis?.scene, 40) || '日常聊天',
    scene_id: scene?.id || '',
    emotion,
    reply_intent: replyIntent,
    intimacy_score: intimacyScore,
  };
}

function normalizeNextTopics(value, scene) {
  const topics = [];
  if (Array.isArray(value)) pushUnique(topics, value.map((topic) => cleanText(topic, 120)));
  pushUnique(topics, normalizeCatalogList(scene?.next_topics).map((topic) => cleanText(topic, 120)));
  return topics.filter(Boolean).slice(0, 4);
}

function buildSceneChatGuide(scene, fallbackGuide) {
  if (!scene) return fallbackGuide;
  const strategy = normalizeCatalogList(scene.reply_strategy).join(' → ');
  return normalizeChatGuide({
    current_move: `${scene.scene}：${strategy || scene.psychology}`,
    next_steps: normalizeCatalogList(scene.next_topics),
    avoid: scene.scene === '身体不舒服'
      ? '不要只说“多喝热水、早点休息、注意身体”。必须加具体行动和后续追踪。'
      : '不要复述对方原话，也不要一次性连续追问。',
  }, fallbackGuide);
}

function getSceneStickerStrategy(sceneName) {
  return STICKER_LIBRARY.scene_to_sticker_strategy?.[sceneName] || {};
}

function getStickerDisplayTextsForScene(scene) {
  const strategy = getSceneStickerStrategy(scene?.scene);
  const fromStrategy = Array.isArray(strategy.text_candidates)
    ? strategy.text_candidates.map((item) => cleanText(item?.text || item?.tag, 16)).filter(Boolean)
    : [];
  if (fromStrategy.length) return [...new Set(fromStrategy)].slice(0, 8);
  return normalizeCatalogList(scene?.sticker_strategy)
    .map((tag) => cleanText(STICKER_LIBRARY.default_text_by_tag?.[tag] || tag, 16))
    .filter(Boolean)
    .slice(0, 8);
}

function mapSceneToStickerScenario(sceneName) {
  const byScene = {
    身体不舒服: ['comfort', 'hug', 'good_night'],
    工作压力: ['encouragement', 'working', 'comfort'],
    学习压力: ['encouragement', 'studying', 'comfort'],
    失眠: ['good_night', 'comfort'],
    早安: ['greeting'],
    晚安: ['good_night', 'comfort'],
    想你: ['missing_you', 'flirting', 'hug'],
    撒娇: ['flirting', 'cute_acting', 'apology'],
    委屈: ['comfort', 'hug'],
    生气: ['apology', 'comfort', 'flirting'],
    吃醋: ['jealousy', 'flirting', 'comfort'],
    查岗: ['jealousy', 'flirting'],
    'emo 动态': ['comfort', 'hug'],
    邀约吃饭: ['celebration', 'agree'],
    邀约电影: ['flirting', 'celebration'],
    约咖啡: ['flirting', 'agree'],
    表白试探: ['confession', 'flirting'],
    关系确认: ['confession', 'hug'],
  };
  return byScene[sceneName] || [];
}

function getMessagesBySpeaker(dialogue, speaker) {
  return (dialogue || []).filter((message) => message.speaker === speaker);
}

function countPattern(messages, pattern) {
  return messages.filter((message) => pattern.test(message.text)).length;
}

function sumMessageLength(messages) {
  return messages.reduce((sum, message) => sum + message.text.length, 0);
}

function getQuestionCount(messages) {
  return countPattern(messages, /[?？]|什么|哪里|在哪|跟谁|干嘛|为啥|为什么|吗|呢|想不想|要不要|有没有|喜欢|行程|几点|什么时候/);
}

function getRelationshipSignals(dialogue = []) {
  const opponentMessages = getMessagesBySpeaker(dialogue, '对方');
  const userMessages = getMessagesBySpeaker(dialogue, '我');
  const opponentText = opponentMessages.map((message) => message.text).join(' ');
  const userText = userMessages.map((message) => message.text).join(' ');
  const fullText = recentDialogueText(dialogue, 20);
  const firstSpeaker = dialogue.find((message) => message.speaker === '对方' || message.speaker === '我')?.speaker || '';

  return {
    opponentMessages,
    userMessages,
    opponentCount: opponentMessages.length,
    userCount: userMessages.length,
    opponentChars: sumMessageLength(opponentMessages),
    userChars: sumMessageLength(userMessages),
    opponentQuestions: getQuestionCount(opponentMessages),
    userQuestions: getQuestionCount(userMessages),
    firstSpeaker,
    opponentInitiated: firstSpeaker === '对方',
    userInitiated: firstSpeaker === '我',
    opponentSharedLife: /照片|自拍|朋友圈|动态|歌|音乐|今天|刚刚|吃了|吃饭|上课|下课|工作|加班|学校|出去|回家|路上|买了|看到|梦到|发型|头像/.test(opponentText),
    opponentCheckedIn: /你在哪|在干嘛|跟谁|谁啊|今晚跟谁|出去|什么时候回来|怎么不回|为什么不回/.test(opponentText),
    opponentScheduleAsk: /行程|去哪|什么时候|几点|今天干嘛|周末|晚上|今晚|明天/.test(opponentText),
    opponentPhotoShare: /照片|自拍|拍了|发你看|好看吗|朋友圈|动态/.test(opponentText),
    opponentGreeting: /早安|早上好|早呀|晚安|睡了吗|睡了|好梦/.test(opponentText),
    opponentAffection: /想你|想我|想见|喜欢你|喜欢我|梦到你|嘴硬|亲亲|抱抱|哄我|讨厌你/.test(opponentText),
    opponentEmotionDisclosure: opponentMessages.some((message) => EMOTIONAL_DISCLOSURE_PATTERN.test(message.text)),
    userPushy: /在一起|做我女朋友|做我男朋友|喜欢我吗|你到底|必须|一定要|现在出来|马上见|为什么不回/.test(userText),
    userNeedy: userMessages.length >= opponentMessages.length + 3 || /怎么不回|为什么不理|你去哪了|你是不是/.test(userText),
    fullText,
  };
}

function inferInitiator(signals) {
  if (signals.opponentInitiated && signals.opponentCount >= signals.userCount) return 'other_person';
  if (signals.userInitiated && signals.userCount >= signals.opponentCount + 1) return 'user';
  if (signals.opponentInitiated) return 'other_person';
  if (signals.userInitiated) return 'user';
  return 'unclear';
}

function inferInvestmentBalance(signals) {
  const opponentInvestment = signals.opponentCount * 8 + signals.opponentChars * 0.35 + signals.opponentQuestions * 12
    + (signals.opponentSharedLife ? 14 : 0)
    + (signals.opponentCheckedIn ? 14 : 0)
    + (signals.opponentGreeting ? 8 : 0)
    + (signals.opponentEmotionDisclosure ? 12 : 0);
  const userInvestment = signals.userCount * 8 + signals.userChars * 0.35 + signals.userQuestions * 12;
  if (userInvestment > opponentInvestment + 22) return 'user_investing_more';
  if (opponentInvestment > userInvestment + 16) return 'other_person_investing_more';
  return 'balanced';
}

function inferAttractionScore(signals, { activeCuriosity = false, suggestStop = false } = {}) {
  let score = 20;
  if (signals.opponentInitiated) score += 10;
  if (signals.opponentCount >= signals.userCount) score += 8;
  if (signals.opponentQuestions) score += Math.min(24, signals.opponentQuestions * 8);
  if (activeCuriosity) score += 16;
  if (signals.opponentSharedLife) score += 12;
  if (signals.opponentPhotoShare) score += 12;
  if (signals.opponentCheckedIn) score += 16;
  if (signals.opponentScheduleAsk) score += 10;
  if (signals.opponentGreeting) score += 10;
  if (signals.opponentAffection) score += 18;
  if (signals.opponentEmotionDisclosure) score += 8;
  if (hasPlayfulFlirt([{ text: signals.fullText }])) score += 10;
  if (suggestStop) score -= 28;
  if (signals.opponentCount <= 2 && signals.userCount >= signals.opponentCount + 3) score -= 18;
  return clampScore(score);
}

function inferIntimacyScore({ stage, attractionScore, signals, emotionalDisclosure = false }) {
  const baseByStage = {
    ice_breaking: 16,
    daily_connection: 36,
    emotional_bonding: 54,
    push_pull_flirting: 66,
    offline_invitation: 74,
    relationship_confirmation: 86,
  };
  let score = baseByStage[stage] || 30;
  score += Math.round((attractionScore - 50) * 0.28);
  if (signals.opponentAffection) score += 10;
  if (signals.opponentCheckedIn) score += 8;
  if (emotionalDisclosure || signals.opponentEmotionDisclosure) score += 8;
  if (signals.opponentSharedLife) score += 5;
  return clampScore(score);
}

function inferRelationshipStageFromMemory({ coachAnalysis, scene, signals, attractionScore, conversationStage }) {
  if (scene?.stage === 'relationship_confirmation') return 'relationship_confirmation';
  if (scene?.stage === 'offline_invitation') return 'offline_invitation';
  if (signals.opponentAffection || signals.opponentCheckedIn || scene?.stage === 'push_pull_flirting') return 'push_pull_flirting';
  if (scene?.stage === 'emotional_bonding' || signals.opponentEmotionDisclosure) return 'emotional_bonding';
  if (attractionScore >= 58 || coachAnalysis?.stage === 'daily_connection') return 'daily_connection';
  return coachAnalysis?.stage || LEGACY_STAGE_TO_RELATIONSHIP_STAGE[conversationStage] || 'ice_breaking';
}

function inferReplyRisk({ stage, scene, signals, attractionScore, investmentBalance, suggestStop = false, emotionalDisclosure = false }) {
  if (suggestStop || (investmentBalance === 'user_investing_more' && attractionScore < 45) || signals.userNeedy) return 'too_needy';
  if ((scene?.stage === 'emotional_bonding' || emotionalDisclosure || signals.opponentEmotionDisclosure) && /身体不舒服|emo 动态|委屈|失眠|压力/.test(scene?.scene || '')) return 'too_cold';
  if ((stage === 'ice_breaking' || stage === 'daily_connection') && signals.userPushy) return 'too_pushy';
  return 'safe';
}

function getNextBestMove({ stage, scene, riskLevel }) {
  if (riskLevel === 'too_needy') return '先收住需求感，别继续追问，把话题留给对方回应。';
  if (riskLevel === 'too_pushy') return '降低推进强度，先回到轻松日常或具体共情。';
  if (riskLevel === 'too_cold') return '先给具体关心和行动，不要只用一句模板安慰。';
  if (scene?.scene === '身体不舒服') return '先问清哪里不舒服，再给一个具体照顾动作和半小时追踪。';
  if (stage === 'daily_connection') return '分享一点自己的生活，再接住对方一个细节，推进到情绪共鸣。';
  if (stage === 'emotional_bonding') return '继续提供情绪价值，等她情绪缓下来再轻轻换到日常话题。';
  if (stage === 'push_pull_flirting') return '顺着已有暧昧梗轻轻回球，别突然逼她表态。';
  if (stage === 'offline_invitation') return '给低压力、可拒绝的具体邀约选项。';
  if (stage === 'relationship_confirmation') return '表达清楚态度，用稳定行动给安全感。';
  return '先让这轮聊天舒服继续，给一个容易接住的具体入口。';
}

function normalizeRelationshipMemoryEngine(rawMemory, context) {
  const signals = getRelationshipSignals(context.dialogue);
  const investmentBalance = ['user_investing_more', 'balanced', 'other_person_investing_more'].includes(rawMemory?.investment_balance)
    ? rawMemory.investment_balance
    : inferInvestmentBalance(signals);
  const attractionScore = clampScore(Number.isFinite(Number(rawMemory?.attraction_score))
    ? rawMemory.attraction_score
    : inferAttractionScore(signals, context));
  const inferredStage = inferRelationshipStageFromMemory({
    coachAnalysis: context.coachAnalysis,
    scene: context.scene,
    signals,
    attractionScore,
    conversationStage: context.conversationStage,
  });
  const relationshipStage = RELATIONSHIP_STAGES.has(rawMemory?.relationship_stage) ? rawMemory.relationship_stage : inferredStage;
  const intimacyScore = clampScore(Number.isFinite(Number(rawMemory?.intimacy_score))
    ? rawMemory.intimacy_score
    : inferIntimacyScore({ stage: relationshipStage, attractionScore, signals, emotionalDisclosure: context.emotionalDisclosure }));
  const initiator = ['user', 'other_person', 'balanced', 'unclear'].includes(rawMemory?.initiator)
    ? rawMemory.initiator
    : inferInitiator(signals);
  const riskLevel = ['too_needy', 'too_cold', 'too_pushy', 'safe'].includes(rawMemory?.risk_level)
    ? rawMemory.risk_level
    : inferReplyRisk({
        stage: relationshipStage,
        scene: context.scene,
        signals,
        attractionScore,
        investmentBalance,
        suggestStop: context.suggestStop,
        emotionalDisclosure: context.emotionalDisclosure,
      });
  return {
    relationship_stage: relationshipStage,
    intimacy_score: intimacyScore,
    attraction_score: attractionScore,
    investment_balance: investmentBalance,
    initiator,
    risk_level: riskLevel,
    next_best_move: cleanText(rawMemory?.next_best_move, 140) || getNextBestMove({ stage: relationshipStage, scene: context.scene, riskLevel }),
  };
}

function normalizeReplyRisk(value, relationshipMemory) {
  return ['too_needy', 'too_cold', 'too_pushy', 'safe'].includes(value) ? value : relationshipMemory.risk_level;
}

function normalizeConversationFuture(rawFuture, { relationshipMemory, scene }) {
  const sceneName = scene?.scene || '日常聊天';
  const defaults = {
    next_reply_likely: relationshipMemory.risk_level === 'safe'
      ? `如果你按当前策略回复，对方大概率会继续围绕“${sceneName}”补充细节或接一句。`
      : '如果继续用高风险方式回复，对方可能会短回或降温。',
    second_reply_likely: relationshipMemory.attraction_score >= 60
      ? '第二轮有机会出现主动解释、回问或轻微接梗。'
      : '第二轮更可能需要你提供一个轻松、具体、低压力的话题入口。',
    third_reply_likely: relationshipMemory.relationship_stage === 'push_pull_flirting'
      ? '第三轮如果她继续接球，可以轻轻推到暧昧或低压力邀约。'
      : '第三轮适合从情绪或日常细节过渡到一个共同话题。',
  };
  return {
    next_reply_likely: cleanText(rawFuture?.next_reply_likely, 160) || defaults.next_reply_likely,
    second_reply_likely: cleanText(rawFuture?.second_reply_likely, 160) || defaults.second_reply_likely,
    third_reply_likely: cleanText(rawFuture?.third_reply_likely, 160) || defaults.third_reply_likely,
  };
}

function getStageGoal(stage) {
  return RELATIONSHIP_ENGINE_CONFIG.relationship_stages?.[stage] || {};
}

function normalizeRelationshipGoal(rawGoal, relationshipMemory) {
  const currentStage = RELATIONSHIP_STAGES.has(rawGoal?.current_stage) ? rawGoal.current_stage : relationshipMemory.relationship_stage;
  const goal = getStageGoal(currentStage);
  const targetStage = RELATIONSHIP_STAGES.has(rawGoal?.target_stage)
    ? rawGoal.target_stage
    : (RELATIONSHIP_STAGES.has(goal.target_stage) ? goal.target_stage : currentStage);
  return {
    current_stage: currentStage,
    target_stage: targetStage,
    today_should_do: cleanText(rawGoal?.today_should_do, 140) || cleanText(goal.today_should_do, 140) || relationshipMemory.next_best_move,
    avoid: cleanText(rawGoal?.avoid, 140) || cleanText(goal.avoid, 140) || '不要一次把推进动作做满，先看对方是否接球。',
  };
}

function normalizeCoachAdvice(rawAdvice, { relationshipMemory, relationshipGoal, scene }) {
  const doItems = Array.isArray(rawAdvice?.do) ? rawAdvice.do.map((item) => cleanText(item, 100)).filter(Boolean) : [];
  const avoidItems = Array.isArray(rawAdvice?.avoid) ? rawAdvice.avoid.map((item) => cleanText(item, 100)).filter(Boolean) : [];
  return {
    summary: cleanText(rawAdvice?.summary, 180) || `当前处在${RELATIONSHIP_STAGE_LABELS[relationshipMemory.relationship_stage] || '关系推进'}，场景是${scene?.scene || '日常聊天'}。重点不是多说，而是把下一步做对。`,
    do: (doItems.length ? doItems : [
      relationshipMemory.next_best_move,
      relationshipGoal.today_should_do,
      relationshipMemory.attraction_score >= 60 ? '对方有主动信号，可以轻轻接住并制造下一句话。' : '先观察对方是否愿意继续接球，不急着加码。',
    ]).slice(0, 4),
    avoid: (avoidItems.length ? avoidItems : [
      relationshipGoal.avoid,
      RELATIONSHIP_ENGINE_CONFIG.reply_risks?.[relationshipMemory.risk_level] || '避免把回复写成模板或压力。',
    ]).slice(0, 4),
  };
}

function explainReply(reply, index, { relationshipMemory, scene }) {
  const text = reply?.text || '';
  if (/地址|送|点.*热|药|躺|喝点|休息|半小时/.test(text)) return '给出具体行动和后续追踪，降低对方此刻的不安。';
  if (/抱|在|陪|别硬撑|心疼|担心/.test(text)) return '增强陪伴感，让对方感觉被接住。';
  if (/想你|犯规|嘴硬|心动|梦里/.test(text)) return '制造轻微推拉和暧昧张力，但不逼对方表态。';
  if (/___/.test(text)) return '避免编造信息，同时留下对方容易继续问的真实入口。';
  if (relationshipMemory.relationship_stage === 'daily_connection') return '用轻松具体的日常细节推进到情绪共鸣。';
  if (scene?.scene === '身体不舒服') return '优先处理身体不舒服场景的照顾感。';
  return index === 0 ? '先接住当前场景，保证回复自然可发。' : '提供另一种节奏，让用户根据对方反应选择。';
}

function normalizeReplyExplanations(rawExplanations, replies, context) {
  const rawList = Array.isArray(rawExplanations) ? rawExplanations : [];
  return replies.map((reply, index) => {
    const raw = rawList.find((item) => Number(item?.reply_index) === index + 1) || rawList[index] || {};
    return {
      reply_index: index + 1,
      style: cleanText(raw.style, 18) || cleanText(reply.style, 18) || `推荐回复${index + 1}`,
      reason: cleanText(raw.reason, 140) || explainReply(reply, index, context),
    };
  }).slice(0, 5);
}

function normalizeNext5Moves(rawMoves, { relationshipMemory, relationshipGoal, scene }) {
  const rawList = Array.isArray(rawMoves) ? rawMoves.map((move) => cleanText(move, 120)).filter(Boolean) : [];
  const defaults = scene?.scene === '身体不舒服'
    ? ['第1步：先关心具体哪里不舒服。', '第2步：给一个具体照顾动作，比如送药、点热的或提醒躺下。', '第3步：半小时后追踪有没有好一点。', '第4步：情绪缓下来后分享一个轻松生活片段。', '第5步：恢复后自然约一个低压力活动。']
    : ['第1步：接住当前场景，不急着跳话题。', '第2步：补一个真实生活细节。', '第3步：观察对方是否主动回问或补充。', '第4步：围绕共同兴趣制造下一句话。', `第5步：向 ${RELATIONSHIP_STAGE_LABELS[relationshipGoal.target_stage] || '下一阶段'} 轻轻推进。`];
  return [...rawList, ...defaults].slice(0, 5);
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

function inferStickerDisplayText(sticker, intent, index = 0) {
  const catalogText = cleanText(sticker?.text, 24);
  if (catalogText) return catalogText;

  const displayTexts = Array.isArray(intent?.display_texts) ? intent.display_texts.filter(Boolean) : [];
  if (displayTexts.length) return cleanText(displayTexts[index % displayTexts.length], 24);

  const intentText = displayTextFromEmotion(intent?.emotion, intent?.scenario, intent?.keywords);
  if (intentText) return intentText;

  const emotion = normalizeCatalogEmotion(sticker?.emotion).primary || intent?.emotion || '';
  const scenarios = normalizeCatalogList(sticker?.scenario);
  const tags = normalizeCatalogList(sticker?.tags);
  const haystack = [sticker?.id, sticker?.source_filename, ...scenarios, ...tags, ...(intent?.keywords || [])].join(' ');
  if (/晚安|good.?night|sleep|睡|困/i.test(haystack) || emotion === 'goodnight' || emotion === 'sleepy') return '晚安';
  if (/抱|hug|安慰|comfort/i.test(haystack) || emotion === 'comfort') return '抱抱';
  if (/加油|encourage|study|作业|学习|鼓励/i.test(haystack) || emotion === 'encourage') return '加油';
  if (/谢谢|thanks/i.test(haystack) || emotion === 'thanks') return '谢谢';
  if (/想你|miss/i.test(haystack) || emotion === 'miss_you') return '想你';
  if (/道歉|apology|sorry/i.test(haystack) || emotion === 'apology') return '对不起';
  if (/害羞|shy|flirt/i.test(haystack) || emotion === 'shy') return '害羞';
  if (/love|喜欢|心动/i.test(haystack) || emotion === 'love') return '喜欢你';
  if (/哭|sad|cry/i.test(haystack) || emotion === 'sad' || emotion === 'cry') return '哭哭';
  if (/气|angry/i.test(haystack) || emotion === 'angry') return '哼';
  if (/尴尬|awkward|speechless/i.test(haystack) || emotion === 'awkward') return '啊这';
  if (/惊|surprised/i.test(haystack) || emotion === 'surprised') return '欸？';
  if (/thinking|想|思考/i.test(haystack) || emotion === 'thinking') return '想想';
  if (/laugh|笑|哈哈/i.test(haystack) || emotion === 'laugh') return '哈哈哈';
  if (/hello|greeting|早|你好/i.test(haystack) || emotion === 'greeting') return '你好呀';
  return emotion === 'happy' ? '开心' : '收到';
}

function displayTextFromEmotion(emotion, scenarios = [], keywords = []) {
  const text = [emotion, ...normalizeCatalogList(scenarios), ...normalizeCatalogList(keywords)].join(' ');
  if (/comfort|hug|安慰|抱|疼|难受|累/.test(text)) return '抱抱';
  if (/encourage|加油|作业|学习|study/.test(text)) return '加油';
  if (/good.?night|晚安|睡|困|sleepy/.test(text)) return '晚安';
  if (/thanks|谢谢/.test(text)) return '谢谢';
  if (/miss|想你/.test(text)) return '想你';
  if (/apology|对不起|抱歉/.test(text)) return '对不起';
  if (/shy|害羞|flirt/.test(text)) return '害羞';
  if (/love|喜欢|心动/.test(text)) return '喜欢你';
  if (/sad|cry|哭/.test(text)) return '哭哭';
  if (/angry|生气/.test(text)) return '哼';
  if (/awkward|speechless|尴尬/.test(text)) return '啊这';
  if (/surprised|惊/.test(text)) return '欸？';
  if (/thinking|思考/.test(text)) return '想想';
  if (/laugh|哈哈|笑/.test(text)) return '哈哈哈';
  if (/greeting|你好|早/.test(text)) return '你好呀';
  if (/happy|开心/.test(text)) return '开心';
  return '';
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

  if (hasPhysicalDiscomfort(dialogue)) return 'care_action_support';
  if (emotionalDisclosure || contextFromDialogue(dialogue) === 'emotional_disclosure') return 'comfort_support';
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
  analysis = null,
  scene = null,
} = {}) {
  const hints = normalizeStickerHints(rawSuggestions);
  const text = [
    recentDialogueText(dialogue, 12),
    hints.map((hint) => [hint.text, hint.emotion, hint.scenario, hint.relationship_stage, ...hint.keywords].join(' ')).join(' '),
    analysis?.scene,
    analysis?.emotion,
    analysis?.reply_intent,
    scene?.scene,
    normalizeCatalogList(scene?.sticker_strategy).join(' '),
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

  const shouldUseSceneIntent = scene?.id && !/^generic/.test(scene.id) && analysis?.reply_intent;
  const replyIntent = (shouldUseSceneIntent && STICKER_REPLY_INTENT_PLANS[analysis.reply_intent])
    ? analysis.reply_intent
    : inferStickerReplyIntent({
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

  pushUnique(scenarios, mapSceneToStickerScenario(scene?.scene));
  pushUnique(scenarios, hints.map((hint) => hint.scenario));
  const relationshipStages = mapStageToStickerRelationshipStages(conversationStage, { suggestStop, emotionalDisclosure });
  pushUnique(relationshipStages, hints.map((hint) => hint.relationship_stage));
  pushUnique(keywords, normalizeCatalogList(scene?.scene));
  pushUnique(keywords, normalizeCatalogList(scene?.sticker_strategy));
  pushUnique(keywords, normalizeCatalogList(STICKER_LIBRARY.scene_text_fallbacks?.[scene?.scene]));
  const displayTexts = getStickerDisplayTextsForScene(scene);

  return {
    reply_intent: replyIntent,
    emotion: primaryEmotion,
    secondary_emotions: intentEmotions.filter((emotion) => emotion !== primaryEmotion).slice(0, 4),
    scenario: scenarios.slice(0, 5),
    relationship_stage: relationshipStages.slice(0, 4),
    keywords: keywords.slice(0, 12),
    display_texts: displayTexts.slice(0, 8),
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

function toStockStickerSuggestion(sticker, score, intent, index = 0) {
  const displayText = inferStickerDisplayText(sticker, intent, index);
  return {
    id: sticker.id,
    file: sticker.file,
    thumb: sticker.thumb || sticker.file,
    pack: sticker.pack || '',
    character: getStockStickerCharacter(sticker),
    text: displayText,
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
      display_texts: intent.display_texts || [],
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
    .map(({ sticker, score }, index) => toStockStickerSuggestion(sticker, score, intent, index));
}

function normalizeStickerSuggestions(suggestions, stage = '轻松破冰', dialogue = [], analysis = {}) {
  const scene = analysis.scene_record || detectScene({
    dialogue,
    modelAnalysis: analysis.analysis || analysis,
    conversationStage: stage,
  });
  const coachAnalysis = analysis.coach_analysis || normalizeCoachAnalysis(analysis.analysis || analysis, {
    scene,
    dialogue,
    conversationStage: stage,
    interestScore: 50,
  });
  const intent = buildStickerMatchIntent({
    rawSuggestions: suggestions,
    conversationStage: stage,
    conversationMode: analysis.conversation_mode,
    flirtLevel: analysis.flirt_level,
    dialogue,
    suggestStop: analysis.suggest_stop === true,
    emotionalDisclosure: analysis.emotional_disclosure === true,
    activeCuriosity: analysis.active_curiosity === true,
    analysis: coachAnalysis,
    scene,
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
            makeReplyCandidate(['你现在感觉还好吗？', '有没有哪里特别不舒服', '先躺下，喝点温水']),
            makeReplyCandidate(['把地址发我', '我给你送点药和清淡的吃的', '你先别硬撑']),
            makeReplyCandidate(['如果我在你旁边就好了', '至少能看着你按时休息', '现在先别看手机了']),
            makeReplyCandidate(['我帮你查一下这种情况怎么缓解', '你先告诉我是肚子更疼还是头更疼']),
            makeReplyCandidate(['等你好一点', '我带你去吃点清淡但好吃的', '先把今晚撑过去']),
          ]
        : [
            makeReplyCandidate(['先别跟自己硬刚了', '缓十分钟也算前进']),
            makeReplyCandidate(['作业先放一下', '我陪你把最急的那一点拆出来']),
            makeReplyCandidate(['你现在的任务', '是先把自己哄回来']),
            makeReplyCandidate(['想吐槽就吐槽', '我负责听', '听完再陪你想办法']),
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
  const hasAnyDialogue = dialogue.length > 0;
  const hasVisualEvidence = evidence.has_message_bubbles || evidence.has_chat_ui || (evidence.has_two_sided_layout && hasTwoSidedDialogue);
  const modelSaysChat = value.is_chat_screenshot === true;
  if (hasStrongNonChatEvidence(evidence, dialogue)) return false;
  if (hasVisualEvidence) return true;
  if (modelSaysChat && dialogue.length >= 2) return true;
  if (value.is_chat_screenshot === false && !hasVisualEvidence) return false;
  return false;
}

function hasStrongNonChatEvidence(evidence, dialogue = []) {
  const imageKind = cleanText(evidence?.image_kind, 80).toLowerCase();
  const hasChatEvidence = evidence?.has_message_bubbles === true || evidence?.has_chat_ui === true || evidence?.has_two_sided_layout === true;
  if (hasChatEvidence) return false;
  if (/document|homework|worksheet|paper|pdf|slide|spreadsheet|landscape|poster|webpage|article|receipt|menu|photo|image|diagram|chart/.test(imageKind)) {
    return true;
  }
  const text = (dialogue || []).map((message) => message.text).join(' ');
  return /loss function|classification|using mlp|write down|homework|worksheet|equation|dataset|algorithm/i.test(text);
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

function queueUsageLog(args) {
  logUsage(args).catch((error) => {
    console.warn(`Usage logging failed after response: ${summarizeError(error)}`);
  });
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
        relationship_stage: advice.relationship_stage || advice.relationship_memory_engine?.relationship_stage || '',
        intimacy_score: Number.isFinite(Number(advice.intimacy_score)) ? Number(advice.intimacy_score) : null,
        attraction_score: Number.isFinite(Number(advice.attraction_score)) ? Number(advice.attraction_score) : null,
        investment_balance: advice.investment_balance || advice.relationship_memory_engine?.investment_balance || '',
        reply_risk: advice.reply_risk || advice.relationship_memory_engine?.risk_level || '',
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

export { CHAT_ADVICE_SCHEMA, CHAT_SCENE_LIBRARY, IMAGE_READING_RULES, MODELS, PRIMARY_IMAGE_DETAIL, PRIMARY_MAX_COMPLETION_TOKENS, PRIMARY_OPENAI_TIMEOUT_MS, REPLY_COACH_SYSTEM_PROMPT, REPLY_PERSPECTIVE_EXAMPLES, REPLY_REFINEMENT_SCHEMA, REFINEMENT_MAX_COMPLETION_TOKENS, buildActiveCuriosityGuide, buildEmotionalDisclosureGuide, buildFreeTierFallbackAdvice, buildReplyRefinementPrompt, buildStageChatGuide, buildStickerMatchIntent, detectScene, extractFirstJsonObject, getRequestParts, getStickerContext, hasActiveCuriosity, hasHappyEmotion, hasRecentEmotionalDisclosure, hasRepeatedColdReplies, hasStudyStress, inferConversationStage, isRetryableModelError, isVerifiedChatScreenshot, logUsage, mergeRefinedReplies, needsReplyRefinement, normalizeChatGuide, normalizeConversationMode, normalizeConversationStage, normalizeDialogue, normalizeChatEvidence, normalizeStickerSuggestions, parseAdvice, recommendStockStickers, repairReplyCandidates, requestOpenAIAdvice, requestOpenAIReplyRefinement, scoreStockSticker };
