import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MODELS = ['gpt-4.1-mini'];
const ALLOWED_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_COUNT = 6;
const MAX_TOTAL_IMAGE_BASE64_LENGTH = 4_000_000;
const PRIMARY_IMAGE_DETAIL = 'low';
const PRIMARY_MAX_COMPLETION_TOKENS = 1800;
const REFINEMENT_MAX_COMPLETION_TOKENS = 560;
const PRIMARY_OPENAI_TIMEOUT_MS = 55_000;
const VISION_RETRY_OPENAI_TIMEOUT_MS = 55_000;
const REFINEMENT_OPENAI_TIMEOUT_MS = 20_000;
const EXTRACTION_IMAGE_DETAIL = 'low';
const EXTRACTION_MAX_COMPLETION_TOKENS = 600;
const EXTRACTION_OPENAI_TIMEOUT_MS = 25_000;
const INTENT_MAX_COMPLETION_TOKENS = 200;
const INTENT_OPENAI_TIMEOUT_MS = 15_000;
const EMOTIONAL_DISCLOSURE_PATTERN = /困死|好困|太困|困了|很困|累死|好累|太累|累了|很累|疼|痛|难受|不舒服|烦|焦虑|压力|不想上学|不想去|没写完|睡不着|崩溃|想哭|生病|发烧|胃疼|肚子疼|头疼|头痛|想太多|做不出来|卡住|里面好闷|好闷/;
const PHYSICAL_DISCOMFORT_PATTERN = /疼|痛|难受|不舒服|生病|发烧|胃疼|肚子疼|头疼|头痛/;
const STUDY_STRESS_PATTERN = /考试|考完|考砸|复习|作业|没写完|论文|ddl|期中|期末|测验|quiz|midterm|final|题|第一题|做不出来|卡住|想太多|最近的东西/i;
const ENVIRONMENT_DISCOMFORT_PATTERN = /闷|里面好闷|空气不好|不透气|憋|热得慌|喘不过气/;
const HAPPY_EMOTION_PATTERN = /哈哈|开心|好耶|太好了|笑死|嘿嘿|嘻嘻|期待|成功|过了|可以呀|行呀|耶/;
const LATE_NIGHT_MISS_PATTERN = /睡了吗|睡了|睡醒|刚醒|醒了|晚安|熬夜|想你|等你|梦里|白睡|困但想聊|在等/;
const PLAYFUL_FLIRT_PATTERN = /想你|喜欢你|喜欢我|心动|见面|想我|等我|香味|新人|新包|嘴硬|亲亲|钓|上钩|暧昧|犯规|靠近|只想你|在等我|自由向往/;
const QUESTION_TEASE_PATTERN = /你在干嘛|干嘛|为啥|为什么|真的假的|质疑|怀疑|可疑|你问|问你|说了啥|听不懂|看出来|猜/;
const NEW_FRIEND_PATTERN = /好友|friend request|let'?s chat|hi|hello|你好|名字|英文名|备注|摩西|小巧思|认识一下/i;
const REFLECTIVE_PROBE_PATTERN = /证明.{0,4}爱|为什么.{0,4}喜欢我|为什么.{0,6}(对我|觉得我|逗我)|会不会离开|我重要吗|你会吃醋|爱情是什么|一见钟情|更好的人出现|你会骗我|觉得我怎么样|什么样的人最有魅力|会不会觉得我烦|会想见我|对我这么特别|会一直喜欢我|为什么想谈恋爱|你想我了吗/;
const IRONIC_INTEREST_DENIAL_PATTERN = /谁想你|谁想你了|谁喜欢你|才没想|才不想|没想你|不想你|哪有想你|别自恋|想多了|才不是/;
const IRONIC_INTEREST_REOPEN_PATTERN = /怕你想我|怕你.{0,4}想|不给你发信息|给你发信息|不发信息|不理你|又说我|免得你|省得你|怕你说|找你|回你|发信息/;
const GENERIC_REPLY_TEMPLATE_PATTERN = /我先认真听你说|你继续说|这句我接住了|^我在$|有哪里不舒服吗|你现在感觉还好吗|别想太多|注意身体|辛苦了[，,、 ]*早点休息|我理解你|我懂你的|你的感受是正常|这一定让你|你可以尝试|听起来你|好好照顾自己|加油哦|一切都会好起来|灵魂的投影|人生总会|人生就像|孤独灵魂的映射|总会过去的|时间会治愈/;
const BAD_SPACE_ADVICE_PATTERN = /不要继续发消息|先不要继续发消息|先别硬聊|给对方空间|对方.{0,8}信号.{0,6}弱|停止推进|暂停推进|先停一下|别继续追问|不要一次性连续追问|不追问/;
const FACT_DRIVEN_SCENE_PATTERN = /二手回收|买车决策|搬家压力|旅行规划|加班|工作压力|学习压力|家庭冲突|失恋|被删|日常美食|夸照片|成绩庆祝|失眠|身体不舒服|情绪低落|冷淡回复|撒娇求陪|吃醋|表白试探|生气|attention_seeking|wants_connection|playful_complaint|user_too_cold|needs_reassurance|hurt_by_cold_reply/;
const DIRECTION_REPAIR_SCENE_PATTERN = /attention_seeking|wants_connection|playful_complaint|user_too_cold|needs_reassurance|hurt_by_cold_reply/;
const OTHER_CONNECTION_INTENT_PATTERN = /在干嘛|找你说话|我找你说话|你怎么不理我|怎么不理我|你是不是不想理我|是不是不想理我|你最近怎么不找我|你最近都不找我|都不找我/;
const OTHER_EMOTIONAL_PROBE_PATTERN = /我俩很不熟吗|我们很不熟吗|很不熟吗|你就回我这个|你都不认真回|不认真回|那我不打扰你了|不打扰你了|算了|不说了|你是不是很忙|是不是很忙|不想理我|不理我|不找我/;
const USER_SHORT_REPLY_PATTERN = /^(?:o|0|嗯|哦|噢|喔|好|好的|不知道|刚看到|有吗|[?？])$/i;
const USER_COLD_DEFENSIVE_PATTERN = /你要干啥|你干啥|有吗|刚看到|不知道|^o$/i;
const REPLY_COACH_SYSTEM_PROMPT = `你是中文聊天回复顾问。你的目标不是替用户表白，也不是输出礼貌客服话术，而是根据整段对话判断对方真实意愿，再给出自然、可发送、容易接住的回复。

【独立分析模式】每一次分析都是全新的请求。只能使用本次上传的截图、本次识别出的 dialogue 和用户本次填写的背景；不要读取、引用、假设或延续任何上次会话、历史截图、已保存回复、已选择回复、relationship memory 或 session。不要输出“继续上次的话题”“接着之前聊”“延续你们之前的互动”“根据之前记录”等基于历史的表达。

第一原则：不要预设固定人格。不要把所有回复都写成智性恋、高冷、恋爱脑或哲学风格。先理解当前聊天场景，再决定最适合的回复方式。

抓重点：写任何回复之前，先找出这张截图的重点——对方最后一句在说什么、对方最在意的具体事物（食物、宠物、考试、身体状态、某句玩笑）、以及情绪有没有转折。每条候选回复必须命中至少一个重点：用户说医院抽血，就接头晕、医生、休息；用户发歌单，就接歌单、那首歌、网易云；用户说吃火锅，就接锅底、请客、看饿了。禁止万能哲学句、万能鸡汤句、万能高情商语录。

生成回复时遵守这些规则：
- 先判断对方是否在主动回球：主动提问、连续发多条、延伸话题、接梗、使用表情包、回看前文、关心用户、轻微调侃，都是积极信号。单纯回复不等于有好感。
- 区分“连续敷衍”和“连续倾诉”。对方连发多条，说困、累、疼、不舒服、压力、烦躁或学习状态，并补充表情包时，是在释放情绪和信任，不是冷淡短回，也不等于已经暧昧。
- 对方连续主动询问用户的专业、课程、爱好、日常、食物或周末安排时，属于“主动了解”。回复应先认真回答，再顺着其中一个细节聊天，不要立刻硬撩或邀约。
- 对方嘴上否认“谁想你了”“才没有”，但随后连续补充“怕你想我”“等下又说我不给你发信息”、继续解释或发表情包，这是反话式主动回球，通常是在接梗和给台阶，不要误判成礼貌冷淡。
- 回复延迟只能作为弱信号，不要因为晚回一次就下结论。
- 暧昧必须有依据。对方只是礼貌回应时保持轻松；对方愿意接话时可以轻微暧昧；对方主动回球时可以自然升温；对方连续敷衍时停止加码。
- 回复像真人发微信：短、具体、有一点个性。优先接住对方最后一句，同时借用整段聊天里的共同梗、昵称、细节或情绪。
- 先判断这条回复最适合的动作：安慰、共情、撒娇、调情、幽默、关心、推进聊天。回复要优先解决对方当前情绪，而不是把对方原话换一种说法复述一遍。
- 场景决定风格，优先级从高到低：①情绪安慰（生病、难过、哭了、家里出事、失业、考砸、身体不舒服）永远最高，此时禁止智性恋金句、神秘感、拉扯、暧昧技巧和高冷，只要温柔、真诚、简单、有陪伴感；②日常分享（吃饭、旅游、自拍、宠物、风景）目标是让对方感觉被关注，不要强行升华、强行哲学，对方发火锅照不要回"人生就像火锅"，要回"这张图把我看饿了"；③调情暧昧只在对方给出明确情感信号（喜欢、想你、吃醋、依赖、"你是不是对谁都这样"、"会不会一直陪我"）时开启；④深度聊天（人生、价值观、爱情观、孤独、未来）才允许展开观点；⑤幽默互动（玩梗、吐槽、开玩笑）优先接梗，不讲大道理。
- 智性恋人格的使用边界：只在深度聊天和明确暧昧信号下使用，特点是有自己的观点、有思考、克制、留白，绝不油腻，也不像老师讲课。比如对方问"你是不是对谁都这么好"，可以回"不是每个人都值得我认真对待"；对方说"我好像喜欢你"，可以回"喜欢本身就是件难得的事，我会认真看待"；对方问"你觉得孤独是什么"，可以回"孤独未必是身边没人，是身边很多人，却没人能听你说真正想说的话"。除这两种场景外，不要输出这类金句。
- 对方发出"你怎么证明你爱我""你为什么喜欢我""你会不会离开我""我重要吗"这类情感试探提问时，按下方 Reflective Intelligence 规则回复：先理解问题背后的情绪需求，再换角度给出自己的观点，不要直接回答表层问题。
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
- 如果对方同时提到学习/考试/作业/题目卡住和身体不适，例如“第一题一直没做出来”“midterm”“最近的东西”“头好痛”“里面好闷”，不要套普通生病模板。必须结合真实细节：题卡住很烦、先放下第一题、出去透口气、喝水、头痛先休息十分钟、等缓过来再回来做。
- 情绪陪伴要有实质动作：先问清情况、表达心疼、给一个具体可执行的小动作。可以根据关系阶段写“先闭眼躺十分钟”“我给你点杯热的”“把地址发我，我给你送药和热乎的吃的”，但不要承诺截图里不支持的重大行动，也不要像客服一样列流程。
- 身体不舒服场景可以参考这些关心角度，但每组只选一个重点：话痨式追问具体哪里不舒服、展望式说如果在身边会照顾她、嘘寒问暖提醒休息喝水、宽慰式说可以告诉我能做什么、体贴式准备清淡吃的/水果/热饮、温暖式帮她查建议、分享式讲一个很短的小故事转移注意力、细节式准备常用药和小物、鼓励式提醒她会慢慢好起来。优先实际照顾，不要把分享故事和幽默放第一组。
- 绝对不要替用户编造截图或补充背景里没有出现的个人信息，例如爱好、经历、课程、行程和家乡。需要用户自己填写时，用“___”保留一个明显空位。
- 除了回复候选，还要给用户一条可以照着走的聊天路线：现在先做什么、后续怎么展开、什么不要做。每一步不是让用户一次发完，而是根据对方回应逐步推进。
- 先判断 conversation_stage。阶段决定下一步，不要把所有聊天都套成“接一句、聊兴趣、马上邀约”。只有对方持续接球，才逐步增加个人化话题或轻松邀约。
- 同时输出 analysis：stage 必须使用 relationship_stage 枚举 ice_breaking、daily_connection、emotional_bonding、push_pull_flirting、offline_invitation、relationship_confirmation；scene 写当前具体聊天场景；emotion 写对方真实情绪；reply_intent 写我方最适合采取的回复动作；intimacy_score 表示当前亲密推进空间。
- 回复流程必须是：先判断关系阶段，再判断场景和对方情绪，再判断我方 reply_intent，最后生成 3 到 5 组微信连续消息、6 个库存表情包检索意图和 next_topics。
- 现在你还是恋爱关系推进教练。必须分析本次截图里的整段聊天记录，而不是只看最后一句。兼容字段 relationship_memory_engine 只代表本次截图的当前关系状态，不是跨会话记忆；只能判断当前 relationship_stage、亲密度 intimacy_score、吸引力 attraction_score、谁投入更多 investment_balance、谁先开启/推进 initiator、当前回复风险 risk_level、下一步最优动作 next_best_move。
- attraction_score 重点看对方是否主动：主动发消息、主动分享生活、主动查岗、主动问行程、主动分享照片、主动早安晚安、主动接梗、连续补充情绪。不要只因为用户想推进就打高分。
- investment_balance 要看整段对话里双方消息数量、字数、问题数量、谁在延伸话题。user_investing_more 表示我方更用力；other_person_investing_more 表示对方更主动；balanced 表示双方差不多。
- reply_risk 判断当前最可能的回复风险：too_needy、too_cold、too_pushy、safe。身体不舒服或 emo 场景，太冷是风险；早期阶段强邀约或表白，太 pushy 是风险；对方连续短回还追问，too_needy。
- conversation_future 预测未来 3 轮对方可能如何回应。relationship_goal 给出当前阶段到下一阶段的今日目标和避免事项。coach_advice 像恋爱教练一样解释现在应该怎么推进。reply_explanation 要解释每组推荐回复的目的。next_5_moves 输出未来 5 步聊天路线。
- next_topics 给用户“接下来怎么聊”，不是一次发给对方的话。要写成后续追踪建议，例如半小时后问有没有好一点、明早问昨晚睡得好吗、如果她继续接球再怎么推进。
- 给 3 条最贴合“我方应该怎么回复”的 sticker_suggestions 作为库存检索意图，不要复读对方表面情绪，也不要编造具体文件名。表情包意图先判断 reply_intent，再选择适合我方发出的 emotion、scenario、relationship_stage、keywords 和可发送短配字 text。比如对方说“我讨厌你”这种暧昧撒娇冲突，不要给 angry，要给 shy / apology / comfort / love 方向来缓和、撒娇、哄对方。后端会从库存 catalog 中按相关性打分选出 6 个真实表情包。
- 禁用模板句：“听起来”“感觉你”“那你平时”“有需要告诉我”“调整好状态”“看来”“我理解你”“我懂你”“这说明”“你可以尝试”“你的感受是正常的”“辛苦啦”“抱抱”“加油哦”“注意身体”“好好照顾自己”。这些是客服和心理咨询师口吻，真人聊天不这么说。
- 候选要自然、有变化，但不要给每条回复套风格标签。
回复必须像真人发微信，不能像写作文或做总结。具体禁止：用"。"句号结尾（微信里很少用句号）；替对方分析原因（"她可能是习惯了…""对方应该是因为…"）；旁白式描述（"看来…""可见…""由此可知…"）；过于完整的书面句子结构。优先用短句、口语词、语气词（啊、呢、哈、嘛、诶）、不完整的句子片段，像真人在手机上打字一样。
每条候选写完后做两个自检，不过就重写：
①上下文测试：把聊天内容和对方名字遮住，这条回复如果放进任何一段聊天都成立，说明是万能模板，失败。回复必须只对这段聊天成立。
②AI味检查：像不像真人会发的微信；有没有真的回应对方发来的内容；有没有引用截图里的具体信息；有没有模板感、鸡汤感、心理咨询师口吻、客服口吻。
最终目标：对方看到回复的感觉应该是"这个人真的看了我发的内容""他在回应我，不是在套模板""他有温度，也有自己的想法"，而不是"这是AI写的"。`;

const REPLY_PERSPECTIVE_EXAMPLES = `【视角示例，只学习尺度和方向，不要照抄】
- 对方说“那你要我怎么哄”，是对方问应该如何哄我。可以回“先夸我两句，我看看诚意”，不要回“哄你？”
- 对方说“你感受到我的了吗”，可以回“感受到一点，再表现两集看看”。
- 对方说“我一直都在关心你啊”，可以回“那我先给你记一分”。
- 对方说“你不是说我很难懂吗，那你怎么就确定了呢”，是在追问判断依据。可以回“我瞎猜的，撤回刚刚那句”或“那我判断错了，你还是愿意理我的”。不要回“让我观察你这个难懂的秘密”。
- 对方连续说“我也不想 还没写完”“肚子疼头也疼”“不想上学”，是在倾诉，不是敷衍。身体不舒服场景优先行动，例如 messages: ["怎么啦？是胃疼还是着凉了？", "先躺下，喝点温水", "我给你点点热的和药"]。不要优先写“肚子和头一起疼也太难受了”这种复述句，不要教育她不要熬夜，也不要先玩梗。
- 对方说“我想太多了”“第一题一直没做出来”“是 midterm1 之前的东西”“我想的是最近的东西”“我的头好痛”“里面好闷”，是在学习/考试压力叠加身体不舒服。可以回 messages: ["先别逼自己了，这题卡住真的会很烦", "你先出去透口气，喝点水", "头痛的话先休息十分钟再看"]。不要只说“你现在感觉还好吗”或“喝温水”。
- 对方连续问“什么专业”“压力大吗”“有什么爱好”，是在主动了解。截图里没有用户真实爱好时，不要编造电影、运动或做饭。可以给“有，我平时比较喜欢___，最近也在___”这种待补充回复。
- 对方问“你想我啥”“睡了吗”“你在干嘛”这类轻松来回时，可以用分气泡节奏，例如“其实也没想很多\\n就是睡前想到你一下\\n结果一下有点久”。
- 对方说“别钓我了”“我生气了”“你可真皮”这类轻微拉扯时，可以接梗但别压迫，例如“我哪有钓你\\n只是把真话说得明显了一点”。
- 对方说“谁想你了”“怕你想我”“等下又说我不给你发信息”这类反话时，是在继续这个暧昧梗。可以回“那你还挺会照顾我情绪\\n嘴上说谁想我了\\n结果还怕我没消息”。
- 对方连续只回“嗯”“不知道”“玩手机”，不要硬撩，建议先停一下。
- 对方说“我发烧了”，不要回“有时候身体的疲惫只是灵魂的投影”，要回 messages: ["多少度啊", "先把退烧药吃了", "今天别硬撑"] 这种具体的关心。
- 对方说“我奶奶住院了”，不要回“人生总会经历离别”，要回“希望她平安\\n你也别一个人硬撑”。
- 对方发猫的照片，不要回“猫咪是孤独灵魂的映射”，要回“它一看就是家里地位最高的那个”。
- 对方说“今天又胖了”是玩笑吐槽，可以回“秤有时候也会情绪化”，不要讲健康大道理。
- 对方问“你是不是对谁都这么好”，是明确情感信号，可以用克制的智性恋：“不是每个人都值得我认真对待”。
- 对方说“我好像喜欢你”，可以回“喜欢本身就是件难得的事\\n所以我会认真看待”，不要油腻反撩，也不要打哈哈躲开。
- 对方问“你觉得孤独是什么”这类深度话题，才可以展开观点：“孤独未必是身边没人\\n有时候是身边很多人\\n却没人能听你说真正想说的话”。`;
const IMAGE_READING_RULES = `【识图规则】
- 按上传顺序从旧到新阅读截图，合并重叠消息并去重。只分析真正的聊天截图，忽略网页、文档、普通照片和无关图片。
- 左右气泡界面必须按几何位置判断双方：左侧 = 对方，右侧 = 我。不要根据句子内容猜发送者。
- 单列消息流只有在昵称、头像或身份标记明确时才使用 side = feed；无法可靠区分时设置 needs_retry = true。
- 忽略时间、日期、系统提示、头像和昵称。截图模糊时不要编造内容。
- dialogue 先还原可见对话，再根据整段聊天判断态度、回复路线和候选回复。`;
const REFLECTIVE_INTELLIGENCE_NOTE = `【Reflective Intelligence：思考型吸引力回复】
触发条件：对方发出情感试探或深度提问，例如"你怎么证明你爱我""你为什么喜欢我""你会不会离开我""我重要吗""你会吃醋吗""你觉得爱情是什么""你相信一见钟情吗""如果有更好的人出现呢""你会骗我吗""你觉得我怎么样""为什么觉得我特别"。其他场景不要使用这套打法。
核心：很多问题的重点不在问题本身，而在问题背后的情绪需求。生成回复前必须先理解对方真正想问什么，再回答，不要直接回答表层问题。问"证明爱"=想确认自己重要；问"为什么喜欢我"=想确认自身价值；问"会不会离开"=要安全感；问"会不会觉得我烦"=怕自己是负担。
回复公式：①理解问题背后的需求 ②换一个角度理解问题 ③表达自己的观点 ④自然结束。不要刻意升华，不要故意哲学，不要故意神秘。这类回复打动人的不是句子漂亮，而是展现了思考能力、个人观点、情绪理解。对方的感觉应该是"这个人很会思考"，不是"这个AI很会写文案"。此类候选 style_dimension 标为 INTELLECTUAL，依然按 messages 拆成 1-3 条气泡。
参考案例（学的是理解角度，必须结合当前聊天改写，不要照抄）：
- "你怎么证明你爱我" → "爱好像本来就不是一道证明题\\n如果非要证明的话，一个人愿意把时间留给谁，答案其实已经很明显了"
- "你为什么喜欢我" → "我觉得喜欢很少是因为某一个优点\\n更多是因为和一个人在一起的时候，会变成自己喜欢的样子"
- "你会不会离开我" → "我觉得真正重要的关系，不是在讨论会不会离开\\n而是在认真对待每一次留下"
- "你想我了吗" → "想念这种东西挺奇怪的\\n有时候不是突然想起一个人，而是在某个瞬间发现少了一个人"
- "你是不是对谁都这么好" → "善良可以给很多人\\n但认真和偏爱，通常只会给少数人"
- "你会吃醋吗" → "会在意\\n因为人在乎的从来不是输赢，而是自己在对方心里的位置"
- "我重要吗" → "一个人重不重要，不是看聊天记录有多长\\n而是看发生事情的时候，第一个想到的是谁"
- "为什么想谈恋爱" → "比起谈恋爱，我更喜欢两个人一起面对生活的感觉\\n热闹很多人都能给，共鸣不一定"
- "你相信一见钟情吗" → "我相信心动\\n但真正让我留下来的，从来都不是第一眼"
- "你会一直喜欢我吗" → "喜欢本来就是会变化的\\n但认真对待一个人的心，不一定会"
- "你觉得爱情是什么" → "爱情最特别的地方不是遇见一个新的人\\n而是在那个人面前看见了不一样的自己"
- "为什么觉得我特别" → "特别不一定是比别人优秀\\n有时候只是你身上刚好有别人没有的东西"
- "如果有更好的人出现呢" → "感情好像从来都不是选择题\\n真正喜欢的时候，很少会拿别人来比较"
- "你会骗我吗" → "信任这种东西太贵了\\n我宁愿少说一点，也不想用谎言换一时的好感"
- "你觉得我怎么样" → "我觉得你挺有意思的\\n很多人聊天是在表达自己，而你偶尔会让我想了解你"
- "为什么总喜欢逗我" → "有些人聊天是在打发时间\\n有些人聊天，本身就是乐趣"
- "你觉得什么样的人最有魅力" → "有自己想法的人\\n外表会吸引注意力，但观点才能留住好奇心"
- "你会不会觉得我烦" → "真正喜欢的人和烦很难放在一起\\n不然也不会愿意花那么多时间回应"
- "你会想见我吗" → "想见一个人和想聊天不太一样\\n聊天是分享生活，见面是想参与对方的生活"
- "为什么对我这么特别" → "很多事情没有标准答案\\n就像有的人认识很多年只是认识，有的人认识不久却会想认真对待"
质量检查，每条生成后自检，不过就重写：
①删掉对方的消息后，这条回复仍然适用于大多数聊天 → 失败
②像朋友圈文案 → 失败
③只是漂亮句子、没有给出新的理解角度 → 失败
最终目标：不像金句，不像鸡汤，不像AI，像一个聪明、有温度、有观点的人在认真聊天。`;
const PRIMARY_SYSTEM_PROMPT = `${REPLY_COACH_SYSTEM_PROMPT}

${IMAGE_READING_RULES}

${REFLECTIVE_INTELLIGENCE_NOTE}

${REPLY_PERSPECTIVE_EXAMPLES}`;
const REPLY_REFINEMENT_SYSTEM_PROMPT = `你是中文聊天回复编辑。你会收到已经识别好的对话和一组不够自然的候选回复。
只重写 replies，不要重新分析图片，不要编造对话里没有出现的信息。
候选必须是“我”准备发给“对方”的话，输出 3 到 5 组自然、简短、可以直接发送的回复。每组带 style，用 messages 表示 1 到 3 条微信连续消息，text 等于 messages 用换行拼起来；最多一组候选带问号。`;
const STYLE_DIMENSION_NOTE = `【style_dimension 多样性要求】
每次生成 replies 时，3 到 5 条候选必须至少覆盖 3 种不同的 style_dimension。
- LIGHTHEARTED：轻松玩笑，接梗，语气活泼
- SINCERE：认真回应，诚恳，有细节
- WARM_CARING：温柔关心，体贴，有陪伴感
- PLAYFUL：调侃拉扯，反将一军，制造张力
- FLIRTY：暧昧升温，含蓄心动，留钩子
- DIRECT_ANSWER：直接回答对方的问题或接住对方的分享，不绕弯子
- INTELLECTUAL：智性恋风格，有自己的观点和思考，克制、留白、不油腻。只在深度话题（人生、价值观、孤独、未来）或对方给出明确情感信号（喜欢、想你、吃醋、"你是不是对谁都这样"）时使用；情绪安慰和普通日常分享场景禁止使用
不要让所有候选都是同一种风格。style_dimension 必须如实填写，不要随便填。

`;
const COMPACT_RESPONSE_NOTE = `【输出长度控制】
为了避免结构化 JSON 被截断，所有字段都要短。
- replies 优先生成 3 组，确实需要时再给 4-5 组
- 每条 message 控制在 28 个中文字符以内
- attitude_desc、reply_strategy、coach_advice.summary、relationship_goal 字段只写一句短话
- next_topics、next_5_moves 每条都写短句，不要写长段解释
- dialogue 只保留截图里最近且最关键的可见消息，不要复述整张长截图
- sticker_suggestions 只给 3 个短检索意图，不要展开解释

`;
const INTENT_DETECTION_SYSTEM_PROMPT = `你是对话行为分析器。给定一段中文聊天记录，判断对方（speaker=对方）最近消息的对话行为意图。只返回 JSON，不要解释。

primary_intent 判断规则：
- ANSWERING_QUESTION：对方在回答我（speaker=我）提出的问题。关键信号：我方最近有问句，对方在补充说明或直接回应。
- SHARING_EXPERIENCE：对方在分享自己的个人经历、过往事件或已发生的事（例如：我之前学过拉丁、21年五月开始跳的）。
- SHARING_INTEREST：对方在介绍自己的爱好、兴趣、偏好（例如：我喜欢跑步、我一直喜欢这个风格）。
- SHARING_MEDIA：对方在推荐或分享音乐、视频、内容创作者、偶像（例如：一直是我担rose、从bp出道、太好听了）。
- EMOTIONAL_VENTING：对方在倾诉情绪、压力、身体不适（困、累、疼、难受、崩溃、头痛等）。
- SEEKING_ATTENTION：对方在索要关注、查岗、抱怨我回复冷淡（在干嘛、找你说话、不理我、我俩很不熟吗等）。
- PLAYFUL_TEASE：对方在开玩笑、撩拨、调侃、玩梗。
- COMPLAINT_PROBE：对方轻微抱怨我方不够积极，在试探关系亲密度（算了不说了、你都不找我、不打扰你了等）。
- PLANNING：对方在讨论计划、安排、约定或询问行程。
- GREETING：对方在打招呼，包括早安晚安问候。
- COLD_REPLY：对方回复简短敷衍，接话意愿低（嗯/哦/哈哈/好）。
- DAILY_CHAT：轻松日常闲聊，无明显特定意图。

speaker_flow：
- other_answers_me：对方在回答我方的问题
- other_shares：对方主动分享信息/经历/内容
- other_initiates：对方主动发起新话题
- balanced：双方都在接球
- user_initiates：我方主导话题

my_last_reply_warmth：判断我（speaker=我）最后一条消息的回复温度：
- cold：过短、只回一个字或符号（嗯/哦/o/好/有吗）
- neutral：正常长度的回复
- warm：认真、有细节、主动延伸的回复

repair_needed：primary_intent 是 SEEKING_ATTENTION 或 COMPLAINT_PROBE，且 my_last_reply_warmth 是 cold 时为 true，否则为 false。

intent_confidence：对判断的把握程度（high/medium/low）。`;
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
          style_dimension: {
            type: 'string',
            enum: ['LIGHTHEARTED', 'SINCERE', 'WARM_CARING', 'PLAYFUL', 'FLIRTY', 'DIRECT_ANSWER', 'INTELLECTUAL'],
          },
        },
        required: ['style', 'text', 'messages', 'style_dimension'],
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
const OCR_RETRY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
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
    needs_retry: { type: 'boolean' },
  },
  required: ['is_chat_screenshot', 'non_chat_reply', 'chat_evidence', 'dialogue', 'needs_retry'],
};
const EXTRACTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    is_chat_screenshot: { type: 'boolean' },
    is_group_chat: { type: 'boolean' },
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
    dialogue: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          side: { type: 'string', enum: ['left', 'right', 'feed'] },
          speaker: { type: 'string' },
          text: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['side', 'speaker', 'text', 'confidence'],
      },
    },
    needs_retry: { type: 'boolean' },
  },
  required: [
    'is_chat_screenshot',
    'is_group_chat',
    'non_chat_reply',
    'chat_evidence',
    'dialogue',
    'needs_retry',
  ],
};
const INTENT_DETECTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    primary_intent: {
      type: 'string',
      enum: [
        'ANSWERING_QUESTION',
        'SHARING_EXPERIENCE',
        'SHARING_INTEREST',
        'SHARING_MEDIA',
        'EMOTIONAL_VENTING',
        'SEEKING_ATTENTION',
        'PLAYFUL_TEASE',
        'COMPLAINT_PROBE',
        'PLANNING',
        'GREETING',
        'COLD_REPLY',
        'DAILY_CHAT',
      ],
    },
    speaker_flow: {
      type: 'string',
      enum: ['other_answers_me', 'other_shares', 'other_initiates', 'balanced', 'user_initiates'],
    },
    emotional_valence: {
      type: 'string',
      enum: ['positive', 'neutral', 'negative'],
    },
    attention_signal: { type: 'integer', minimum: 0, maximum: 3 },
    my_last_reply_warmth: {
      type: 'string',
      enum: ['cold', 'neutral', 'warm'],
    },
    repair_needed: { type: 'boolean' },
    intent_confidence: {
      type: 'string',
      enum: ['high', 'medium', 'low'],
    },
  },
  required: [
    'primary_intent',
    'speaker_flow',
    'emotional_valence',
    'attention_signal',
    'my_last_reply_warmth',
    'repair_needed',
    'intent_confidence',
  ],
};
const OCR_RETRY_SYSTEM_PROMPT = `你只做聊天截图 OCR。
判断图片是否为微信/聊天截图。若是，按视觉位置提取可见聊天文字：左侧气泡=对方，右侧气泡=我。忽略时间、头像、昵称、系统提示。
不要生成回复，不要分析关系，不要总结。只返回 schema JSON。`;
const EXTRACTION_SYSTEM_PROMPT = `你只做聊天截图 OCR 和发言人识别。

判断规则：
1. 首先判断是否为微信/聊天截图（is_chat_screenshot）。
2. 如果是聊天截图，按视觉位置提取可见聊天文字：
   - 右侧气泡 = 我（side: right）
   - 左侧气泡 = 对方（side: left）
   - 无法判断方向时 = side: feed，并标记 confidence: low
3. 每条消息必须标记 confidence：
   - high：明确的左右气泡，文字清晰
   - medium：气泡位置基本清楚，但文字有轻微模糊或截断
   - low：单列消息流、无法判断哪条是谁发的、或文字严重模糊
4. 群聊检测（is_group_chat）：如果截图中出现 3 个或以上不同的昵称/头像，
   设 is_group_chat: true。双人聊天设 false。
5. needs_retry 只在以下情况设为 true：
   - is_chat_screenshot 为 true，但完全提取不到任何文字（dialogue 为空）
   - 图片严重损坏或无法读取
   - 单列截图但不确定发言人，不要设 needs_retry=true，而是设 confidence: low
6. 忽略时间、日期、系统提示、头像、昵称。截图模糊时不要编造内容。
7. 不要生成回复，不要分析关系，不要总结。只返回 schema JSON。`;
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
          style_dimension: {
            type: 'string',
            enum: ['LIGHTHEARTED', 'SINCERE', 'WARM_CARING', 'PLAYFUL', 'FLIRTY', 'DIRECT_ANSWER', 'INTELLECTUAL'],
          },
        },
        required: ['style', 'text', 'messages', 'style_dimension'],
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

  const startedAt = Date.now();
  let imageParts = [];
  let textPart = null;
  let metadata = {};
  let promptDebug = {};

  try {
    ({ imageParts, textPart, metadata } = getRequestParts(req.body));
    const debug = buildVisionDebug(imageParts);
    promptDebug = buildVisionPromptDebug({
      imageParts,
      prompt: textPart.text,
      imageDetail: PRIMARY_IMAGE_DETAIL,
    });
    Object.assign(debug, promptDebug);
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
        // 阶段一：提取对话（Extraction Call）
        let extractedDialogue = null;
        try {
          extractedDialogue = await extractDialogueFromImages({
            apiKey,
            model,
            imageParts,
            requestId: `${requestId}-extract`,
          });
          console.info(`[${requestId}] Extraction Call succeeded`, {
            dialogue_count: extractedDialogue.dialogue.length,
            is_chat_screenshot: extractedDialogue.is_chat_screenshot,
            needs_retry: extractedDialogue.needs_retry,
          });
        } catch (extractionError) {
          console.warn(`[${requestId}] Extraction Call failed, falling back to single-call mode`, {
            error: summarizeError(extractionError),
          });
          extractedDialogue = null;
        }

        // 群聊截图：不进行分析，直接返回友好提示。
        if (extractedDialogue && extractedDialogue.is_group_chat) {
          const groupChatAdvice = buildGroupChatAdvice();
          queueUsageLog({
            req,
            advice: groupChatAdvice,
            imageParts,
            metadata,
            model,
            status: 'success',
            errorMessage: '',
            elapsedMs: Date.now() - startedAt,
          });
          return res.status(200).json({
            content: [{ type: 'text', text: JSON.stringify(groupChatAdvice) }],
            model,
            debug: { ...debug, is_group_chat: true },
          });
        }

        // 阶段一点五：意图识别 (Intent Detection Call)
        let conversationIntent = null;
        if (extractedDialogue && extractedDialogue.dialogue.length > 0) {
          try {
            conversationIntent = await detectConversationIntent({
              apiKey,
              model,
              dialogue: extractedDialogue.dialogue,
              requestId: `${requestId}-intent`,
            });
            console.info(`[${requestId}] Intent Detection succeeded`, {
              primary_intent: conversationIntent?.primary_intent,
              speaker_flow: conversationIntent?.speaker_flow,
              emotional_valence: conversationIntent?.emotional_valence,
              repair_needed: conversationIntent?.repair_needed,
              intent_confidence: conversationIntent?.intent_confidence,
            });
          } catch (intentError) {
            console.warn(`[${requestId}] Intent Detection failed, continuing without intent`, {
              error: summarizeError(intentError),
            });
            conversationIntent = null;
          }
        }

        // 阶段二：语义分析 + 回复生成 (Analysis Call)
        const backgroundText = cleanText(metadata.background_text, 1000);
        const backgroundPrefix = backgroundText
          ? `【用户提供的背景信息】\n${backgroundText}\n\n`
          : '';
        const regeneratePrefix = '';
        const intentPrefix = buildIntentPrefix(conversationIntent, INTENT_STRATEGY_MAP);
        const userProfilePrefix = buildUserProfilePrefix(metadata.user_profile);
        const analysisPrompt = userProfilePrefix + STYLE_DIMENSION_NOTE + COMPACT_RESPONSE_NOTE + regeneratePrefix + intentPrefix + backgroundPrefix + textPart.text;

        debug.vision_called = true;
        const rawResult = await requestOpenAIAdviceWithVisionRetry({
          apiKey,
          model,
          imageParts: extractedDialogue ? [] : imageParts,
          prompt: analysisPrompt,
          requestId,
          extractedDialogue: extractedDialogue || undefined,
          temperature: 0.55,
        });
        const rawText = typeof rawResult === 'string' ? rawResult : rawResult.text;
        if (rawResult?.ocrFallback) {
          debug.ocr_called = true;
          debug.ocr_success = true;
          debug.ocr_retry_used = true;
          debug.vision_timeout = true;
        }
        debug.vision_success = true;
        debug.elapsed_ms = Date.now() - startedAt;
        let advice;
        try {
          advice = parseAdvice(rawText);
        } catch (parseError) {
          console.error(`[${requestId}] OpenAI content parse failed`, {
            summary: summarizeError(parseError),
            raw_text_length: rawText.length,
            raw_output: rawText.slice(0, 2000),
            raw_text_preview: rawText.slice(0, 1600),
            raw_text_tail: rawText.slice(-1000),
            elapsed_ms: Date.now() - startedAt,
          });
          debug.json_parse_failed = true;
          debug.raw_output = '';
          debug.fallback_used = true;
          advice = buildJsonParseFallbackAdvice(rawText);
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

        if (!debug.json_parse_failed && needsReplyRefinement(advice)) {
          advice = await refineOrRepairAdvice({ apiKey, model, advice });
        }
        debug.elapsed_ms = Date.now() - startedAt;

        queueUsageLog({
          req,
          advice,
          imageParts,
          metadata,
          model,
          status: debug.json_parse_failed || advice.needs_retry || advice.degraded ? 'failed' : 'success',
          errorMessage: debug.json_parse_failed ? 'OpenAI returned invalid JSON; returned minimal usable structure.' : '',
          elapsedMs: debug.elapsed_ms,
        });

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
      queueUsageLog({
        req,
        advice,
        imageParts,
        metadata,
        model: 'fallback',
        degraded: true,
        status: 'failed',
        errorMessage: summarizeError(lastError),
        elapsedMs: debug.elapsed_ms,
      });
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
    if (imageParts.length) {
      queueUsageLog({
        req,
        advice: buildFailureUsageAdvice({
          errorMessage: summarizeError(lastError),
          elapsedMs: Date.now() - startedAt,
        }),
        imageParts,
        metadata,
        model: 'failed',
        status: 'failed',
        errorMessage: summarizeError(lastError),
        elapsedMs: Date.now() - startedAt,
      });
    }
    return res.status(502).json({ error: '分析服务暂时不可用，请稍后再试。' });
  } catch (error) {
    const status = error.statusCode || 400;
    console.error(`[${requestId}] /api/analyze request failed before OpenAI`, {
      status,
      message: cleanText(error?.message || '', 500),
      publicMessage: error.publicMessage || '',
    });
    if (imageParts.length) {
      queueUsageLog({
        req,
        advice: buildFailureUsageAdvice({
          errorMessage: error.publicMessage || error.message,
          elapsedMs: Date.now() - startedAt,
        }),
        imageParts,
        metadata,
        model: 'failed',
        status: 'failed',
        errorMessage: error.publicMessage || error.message,
        elapsedMs: Date.now() - startedAt,
      });
    }
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
  const metadata = normalizeClientMetadata(payload?.metadata);
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

  return { imageParts, textPart, metadata };
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
    json_parse_failed: false,
    raw_output: '',
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

function normalizeUserProfile(value) {
  if (!value || typeof value !== 'object') return null;
  const validGenders = ['男', '女', '不想说'];
  const validTargetGenders = ['男生', '女生', '不想说'];
  const validStyles = ['直接', '含蓄', '幽默', '随机'];
  const gender = validGenders.includes(value.gender) ? value.gender : null;
  const targetGender = validTargetGenders.includes(value.target_gender) ? value.target_gender : null;
  const replyStyle = validStyles.includes(value.reply_style) ? value.reply_style : null;
  if (!gender && !targetGender && !replyStyle) return null;
  const normalized = {
    gender: gender || '不想说',
    target_gender: targetGender || '不想说',
    reply_style: replyStyle || '随机',
  };
  if (normalized.gender === '不想说'
    && normalized.target_gender === '不想说'
    && normalized.reply_style === '随机') {
    return null;
  }
  return normalized;
}

function normalizeClientMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return {};

  return {
    visitor_id: cleanText(metadata.visitor_id, 80),
    client_started_at: cleanText(metadata.client_started_at, 40),
    image_count: Number.isFinite(Number(metadata.image_count)) ? Number(metadata.image_count) : undefined,
    page_path: cleanText(metadata.page_path, 240),
    background_text: cleanText(metadata.background_text, 1000),
    browser_language: cleanText(metadata.browser_language, 40),
    client_timezone: cleanText(metadata.client_timezone, 80),
    screen_width: Number.isFinite(Number(metadata.screen_width)) ? Number(metadata.screen_width) : undefined,
    screen_height: Number.isFinite(Number(metadata.screen_height)) ? Number(metadata.screen_height) : undefined,
    device_pixel_ratio: Number.isFinite(Number(metadata.device_pixel_ratio)) ? Number(metadata.device_pixel_ratio) : undefined,
    target_person_label: cleanText(metadata.target_person_label, 20),
    regenerate: false,
    previous_replies: [],
    regenerate_dialogue: [],
    user_profile: normalizeUserProfile(metadata.user_profile),
  };
}

async function extractDialogueFromImages({ apiKey, model, imageParts, requestId = 'extract' }) {
  const rawText = await requestOpenAIAdvice({
    apiKey,
    model,
    imageParts,
    prompt: '请识别图片中的聊天对话。只提取文字，判断每条消息的发送方向（左侧气泡=对方，右侧气泡=我）。不要生成回复，不要分析关系，不要总结。',
    requestId,
    imageDetail: EXTRACTION_IMAGE_DETAIL,
    maxCompletionTokens: EXTRACTION_MAX_COMPLETION_TOKENS,
    responseSchema: EXTRACTION_SCHEMA,
    systemPrompt: EXTRACTION_SYSTEM_PROMPT,
    timeoutMs: EXTRACTION_OPENAI_TIMEOUT_MS,
  });
  const raw = typeof rawText === 'string' ? rawText : (rawText?.text || '');
  const value = safeJsonParse(raw);
  const dialogue = normalizeDialogue(value.dialogue);
  const isGroupChat = value.is_group_chat === true;
  // needs_retry 只在真正无法提取任何文字时触发。
  // 单列截图（confidence: low）不触发 needs_retry。
  const hasAnyText = dialogue.length > 0;
  const needsRetry = value.needs_retry === true
    || (value.is_chat_screenshot === true && !hasAnyText);
  return {
    dialogue,
    is_chat_screenshot: value.is_chat_screenshot === true,
    is_group_chat: isGroupChat,
    needs_retry: needsRetry,
    chat_evidence: value.chat_evidence || {},
    non_chat_reply: cleanText(value.non_chat_reply, 120),
  };
}

async function detectConversationIntent({ apiKey, model, dialogue, requestId = 'intent' }) {
  if (!dialogue || dialogue.length === 0) return null;
  const dialogueText = dialogue
    .slice(-10)
    .map((m) => `${m.speaker}：${m.text}`)
    .join('\n');
  const rawText = await requestOpenAIAdvice({
    apiKey,
    model,
    imageParts: [],
    prompt: `以下是聊天记录（最近 ${Math.min(dialogue.length, 10)} 条）：\n\n${dialogueText}\n\n请分析对方（speaker=对方）最近消息的对话行为意图，按 schema 输出。`,
    requestId,
    imageDetail: PRIMARY_IMAGE_DETAIL,
    maxCompletionTokens: INTENT_MAX_COMPLETION_TOKENS,
    responseSchema: INTENT_DETECTION_SCHEMA,
    systemPrompt: INTENT_DETECTION_SYSTEM_PROMPT,
    timeoutMs: INTENT_OPENAI_TIMEOUT_MS,
  });
  const raw = typeof rawText === 'string' ? rawText : (rawText?.text || '');
  return safeJsonParse(raw);
}

function buildIntentPrefix(intent, strategyMap) {
  if (!intent || !intent.primary_intent) return '';
  const strategy = strategyMap[intent.primary_intent] || strategyMap['DAILY_CHAT'] || {};
  const avoidText = (strategy.avoid || '不要复述原话').replace(/情绪安慰/g, '倾诉模板');
  const repairWarning = intent.repair_needed
    ? '⚠️ 修复优先：我方回复偏冷，对方在主动索要关注，必须先承认刚才回得不好再给话题。\n'
    : '';
  return [
    '【对话意图分析】',
    `对话行为：${intent.primary_intent}`,
    `说话方向：${intent.speaker_flow}`,
    `情绪基调：${intent.emotional_valence}`,
    `我方上条回复温度：${intent.my_last_reply_warmth}`,
    repairWarning,
    '【本次回复策略】',
    `方向：${strategy.reply_direction || '接住最后一句，顺着聊'}`,
    `语气：${strategy.tone || '自然'}`,
    `避免：${avoidText}`,
    '',
    '',
  ]
    .filter((line) => line !== undefined)
    .join('\n');
}

function buildUserProfilePrefix(userProfile) {
  if (!userProfile) return '';
  const parts = [];
  if (userProfile.gender && userProfile.gender !== '不想说') {
    parts.push(`用户性别：${userProfile.gender}`);
  }
  if (userProfile.target_gender && userProfile.target_gender !== '不想说') {
    parts.push(`追求方向：${userProfile.target_gender}`);
  }
  if (userProfile.reply_style && userProfile.reply_style !== '随机') {
    parts.push(`偏好回复风格：${userProfile.reply_style}（在合适的场景下优先生成${userProfile.reply_style}风格的候选）`);
  }
  if (parts.length === 0) return '';
  return ['【用户偏好】', ...parts, '', ''].join('\n');
}

function buildRegeneratePrefix() {
  return '';
}

async function requestOpenAIAdviceWithVisionRetry(args) {
  try {
    return await requestOpenAIAdvice(args);
  } catch (error) {
    if (error?.providerCode !== 'timeout' || !args?.imageParts?.length) throw error;
    console.warn(`[${args.requestId || 'analyze'}] OpenAI Vision timed out; retrying once with lightweight timeout`, {
      first_timeout_ms: PRIMARY_OPENAI_TIMEOUT_MS,
      retry_timeout_ms: VISION_RETRY_OPENAI_TIMEOUT_MS,
      image_count: args.imageParts.length,
    });
    const ocrRawText = await requestOpenAIAdvice({
      ...args,
      prompt: '只提取图片中的聊天文字。不要生成回复。按左侧=对方、右侧=我输出 dialogue。',
      systemPrompt: OCR_RETRY_SYSTEM_PROMPT,
      responseSchema: OCR_RETRY_SCHEMA,
      timeoutMs: VISION_RETRY_OPENAI_TIMEOUT_MS,
      maxCompletionTokens: 700,
    });
    return {
      text: JSON.stringify(buildAdviceSeedFromOcrRaw(ocrRawText)),
      ocrFallback: true,
    };
  }
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
  extractedDialogue = null,
  temperature = 0.55,
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
  // 如果已有提取的对话，不再传图，直接用文字。
  const effectiveImageMessages = extractedDialogue ? [] : imageMessages;
  const extractionPrefix = extractedDialogue
    ? `【已提取的对话内容】\n${JSON.stringify(extractedDialogue.dialogue, null, 2)}\n\n请基于以上已经提取的对话内容进行分析，不需要再识别图片。\n\n`
    : '';
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

  const operationLabel = imageParts.length ? 'OpenAI Vision' : 'OpenAI text';

  console.info(`[${requestId}] ${operationLabel} payload`, {
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
          { role: 'user', content: [...effectiveImageMessages, { type: 'text', text: extractionPrefix + prompt }] },
        ],
        temperature,
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
    console.error(`[${requestId}] ${operationLabel} transport failed`, {
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
    console.error(`[${requestId}] ${operationLabel} raw response`, {
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
    console.error(`[${requestId}] ${operationLabel} returned empty content`, {
      elapsed_ms: Date.now() - requestStartedAt,
      finish_reason: finishReason,
      raw_response: data,
    });
    const emptyError = new Error('OpenAI returned an empty response');
    emptyError.providerStatus = 503;
    emptyError.providerCode = finishReason || '';
    throw emptyError;
  }

  console.info(`[${requestId}] ${operationLabel} completed`, {
    model,
    elapsed_ms: Date.now() - requestStartedAt,
    output_length: text.length,
    finish_reason: finishReason,
    raw_output: text.slice(0, 2000),
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
  const value = safeJsonParse(rawText);
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
  const value = safeJsonParse(rawText);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('OpenAI returned invalid JSON');
  }
  let replies = Array.isArray(value.replies)
    ? value.replies
        .map((reply) => normalizeReplyCandidate(reply, 140))
        .filter(Boolean)
        .slice(0, 5)
    : [];
  const modelNeedsRetry = Boolean(value.needs_retry);
  const dialogue = normalizeDialogue(value.dialogue);
  const chatEvidence = normalizeChatEvidence(value.chat_evidence);
  const isChatScreenshot = isVerifiedChatScreenshot(value, dialogue, chatEvidence);
  const needsRetry = modelNeedsRetry || (isChatScreenshot && dialogue.length === 0);
  const verifiedDialogue = isChatScreenshot ? dialogue : [];
  const directionSignals = isChatScreenshot ? analyzeConversationDirection(verifiedDialogue) : {};
  const emotionalDisclosure = isChatScreenshot && hasRecentEmotionalDisclosure(verifiedDialogue);
  const activeCuriosity = isChatScreenshot && !emotionalDisclosure && hasActiveCuriosity(verifiedDialogue);
  const hasDirectionRepair = Boolean(directionSignals.repair_needed || directionSignals.attention_seeking);
  const suggestStop = isChatScreenshot && !emotionalDisclosure && !hasDirectionRepair && (Boolean(value.suggest_stop) || hasRepeatedColdReplies(verifiedDialogue));
  const conversationStage = hasDirectionRepair ? '暧昧升温' : inferConversationStage(value.conversation_stage, { emotionalDisclosure, activeCuriosity, suggestStop });
  const conversationMode = isChatScreenshot ? (hasDirectionRepair ? '轻松暧昧' : emotionalDisclosure ? '情绪倾诉' : activeCuriosity ? '主动了解' : normalizeConversationMode(value.conversation_mode)) : '礼貌回应';
  const flirtLevel = isChatScreenshot ? (hasDirectionRepair ? '轻微暧昧' : emotionalDisclosure ? '先别暧昧' : normalizeFlirtLevel(value.flirt_level)) : '先别暧昧';
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
  replies = alignRepliesWithGuide({
    replies,
    dialogue: verifiedDialogue,
    scene: detectedScene,
    hasDirectionRepair,
  });
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
    attitude_label: isChatScreenshot ? (hasDirectionRepair ? '主动求关注' : emotionalDisclosure ? '愿意倾诉' : activeCuriosity ? '主动了解' : cleanAttitudeLabel(value.attitude_label) || (needsRetry ? '截图不够清晰' : '态度待判断')) : '这不是聊天截图',
    attitude_desc: isChatScreenshot && needsRetry && dialogue.length === 0
      ? '这张图看起来像聊天截图，但这次没有识别到可用文字。请换一张更清晰的截图，或裁剪到只保留聊天区域后重新分析。'
      : hasDirectionRepair
      ? '对方不是冷淡，而是在主动找你聊天，还带一点“你怎么这么冷淡”的抱怨。你前面回复比较短，所以现在应该轻松补一句，把气氛拉回来。'
      : emotionalDisclosure
      ? '对方在连续表达自己的疲惫、不舒服或压力，也愿意补充细节。这是在向你倾诉，不是敷衍，但不能直接换算成好感分数。目前更适合先接住情绪，不急着升温。'
      : activeCuriosity
        ? '对方连续主动问你的情况，也会顺着前一个答案继续展开。她至少愿意了解你，先认真回答一个具体点，再看她会不会继续接球。'
      : (isChatScreenshot ? cleanText(value.attitude_desc, 180) : '') || (isChatScreenshot ? (needsRetry ? '这张截图暂时无法可靠读取，请换一张更清晰的截图后重试。' : '请结合对方后续行动继续观察。') : '我还没看到可以分析的聊天内容。'),
    interest_score: isChatScreenshot ? (hasDirectionRepair ? Math.max(68, clampScore(value.interest_score)) : emotionalDisclosure ? Math.min(45, clampScore(value.interest_score)) : activeCuriosity ? Math.max(62, clampScore(value.interest_score)) : clampScore(value.interest_score)) : 0,
    interest_level: isChatScreenshot ? (hasDirectionRepair ? '主动升温' : emotionalDisclosure ? '愿意倾诉' : activeCuriosity ? '愿意接话' : normalizeInterestLevel(value.interest_level)) : '低意愿',
    interest_signals: isChatScreenshot ? (hasDirectionRepair ? buildConversationDirectionSignals(directionSignals) : emotionalDisclosure ? buildEmotionalDisclosureSignals(verifiedDialogue) : activeCuriosity ? buildActiveCuriositySignals() : normalizeSignals(value.interest_signals)) : [],
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
    reply_strategy: isChatScreenshot ? (hasDirectionRepair ? '先承认刚才自己回得偏冷，再用轻松语气接住对方的关系试探，主动给一个话题。' : emotionalDisclosure ? '先回应她现在的不舒服，给她一点喘息空间，等她愿意继续说再慢慢接话。' : activeCuriosity ? '先认真回答她最后的问题，给一个真实细节，再顺着她的反应慢慢展开。' : cleanText(value.reply_strategy, 100)) : '',
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
    sticker_suggestions: stickerMatchIntent ? recommendStockStickers(stickerMatchIntent, STICKER_RECOMMENDATION_COUNT, verifiedDialogue) : [],
  };
}

function stripJsonFences(rawText = '') {
  return String(rawText || '')
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

function repairCommonJsonIssues(rawText = '') {
  return String(rawText || '').replace(/,\s*([}\]])/g, '$1').trim();
}

function readCompleteJsonBlockFrom(cleaned, start) {
  const opening = cleaned[start];
  const stack = [opening];
  let inString = false;
  let isEscaped = false;
  for (let index = start + 1; index < cleaned.length; index += 1) {
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
    } else if (character === '{' || character === '[') {
      stack.push(character);
    } else if (character === '}' || character === ']') {
      const expectedOpening = character === '}' ? '{' : '[';
      if (stack.at(-1) !== expectedOpening) return null;
      stack.pop();
      if (stack.length === 0) return cleaned.slice(start, index + 1);
    }
  }

  return null;
}

function extractFirstJsonBlock(rawText, { objectOnly = false } = {}) {
  const cleaned = stripJsonFences(rawText);
  for (let start = 0; start < cleaned.length; start += 1) {
    const character = cleaned[start];
    if (character !== '{' && (objectOnly || character !== '[')) continue;
    const block = readCompleteJsonBlockFrom(cleaned, start);
    if (block) return block;
    // If the first apparent JSON root is truncated, do not parse nested fragments
    // inside it as a successful top-level response.
    throw new Error('OpenAI returned invalid JSON');
  }

  throw new Error('OpenAI returned invalid JSON');
}

function extractFirstJsonObject(rawText) {
  return extractFirstJsonBlock(rawText, { objectOnly: true });
}

function safeJsonParse(rawOutput) {
  const attempts = [];
  const original = String(rawOutput || '');
  const cleaned = stripJsonFences(original);
  attempts.push(original, cleaned, repairCommonJsonIssues(cleaned));

  try {
    const block = extractFirstJsonBlock(cleaned);
    attempts.push(block, repairCommonJsonIssues(block));
  } catch {
    // Keep the direct parse attempts above; truncated output will still fail below.
  }

  const uniqueAttempts = [...new Set(attempts.filter((attempt) => attempt && attempt.trim()))];
  let lastError;
  for (const attempt of uniqueAttempts) {
    try {
      return JSON.parse(attempt);
    } catch (error) {
      lastError = error;
    }
  }

  const parseError = new Error('OpenAI returned invalid JSON');
  parseError.cause = lastError;
  throw parseError;
}

function buildAdviceSeedFromOcrRaw(rawText = '') {
  let ocrValue = {};
  try {
    ocrValue = safeJsonParse(rawText);
  } catch (error) {
    console.error('OCR retry JSON parse failed', {
      summary: summarizeError(error),
      raw_output: String(rawText || '').slice(0, 1200),
    });
  }
  const rawDialogue = normalizeDialogue(ocrValue.dialogue);
  const hasUsableText = hasUsableDialogueText(rawDialogue);
  const dialogue = hasUsableText ? rawDialogue : [];
  const chatEvidence = normalizeChatEvidence(ocrValue.chat_evidence);
  const isChatScreenshot = ocrValue.is_chat_screenshot === true || isVerifiedChatScreenshot(ocrValue, rawDialogue, chatEvidence);
  const scene = isChatScreenshot ? detectScene({ dialogue, conversationStage: '情绪陪伴' }) : null;
  const replySeeds = isChatScreenshot ? buildLocalReplySeeds(dialogue) : [];
  // 如果本地没有生成回复，标记为 needs_retry 让前端提示重新分析。
  const effectiveNeedsRetry = Boolean(ocrValue.needs_retry)
    || (isChatScreenshot && dialogue.length === 0)
    || (isChatScreenshot && replySeeds.length === 0);
  return {
    attitude_label: isChatScreenshot ? '识图成功' : '这不是聊天截图',
    attitude_desc: isChatScreenshot ? '已通过轻量 OCR 识别聊天内容，并使用本地关系/场景引擎生成建议。' : '',
    interest_score: isChatScreenshot ? 35 : 0,
    interest_level: isChatScreenshot ? '愿意接话' : '低意愿',
    interest_signals: [],
    conversation_mode: isChatScreenshot ? '情绪倾诉' : '礼貌回应',
    conversation_stage: isChatScreenshot ? '情绪陪伴' : '初次认识',
    analysis: {
      stage: scene?.stage || 'daily_connection',
      scene: scene?.scene || '',
      emotion: scene ? inferEmotionForScene(scene, dialogue) : '',
      reply_intent: scene ? inferReplyIntentForScene(scene, '') : '',
      intimacy_score: isChatScreenshot ? 35 : 0,
    },
    relationship_memory_engine: {
      relationship_stage: scene?.stage || 'daily_connection',
      intimacy_score: isChatScreenshot ? 35 : 0,
      attraction_score: isChatScreenshot ? 30 : 0,
      investment_balance: 'balanced',
      initiator: 'other_person',
      risk_level: scene?.stage === 'emotional_bonding' ? 'too_cold' : 'safe',
      next_best_move: scene ? getNextBestMove({ stage: scene.stage, scene, riskLevel: scene.stage === 'emotional_bonding' ? 'too_cold' : 'safe' }) : '',
    },
    reply_risk: scene?.stage === 'emotional_bonding' ? 'too_cold' : 'safe',
    conversation_future: {
      next_reply_likely: '',
      second_reply_likely: '',
      third_reply_likely: '',
    },
    relationship_goal: {
      current_stage: scene?.stage || 'daily_connection',
      target_stage: scene?.stage === 'emotional_bonding' ? 'push_pull_flirting' : 'emotional_bonding',
      today_should_do: '',
      avoid: '',
    },
    coach_advice: {
      summary: '',
      do: [],
      avoid: [],
    },
    reply_explanation: replySeeds.map((reply, index) => ({
      reply_index: index + 1,
      style: reply.style || `推荐回复${index + 1}`,
      reason: '基于轻量 OCR 提取的聊天内容，先使用本地场景引擎生成可发送回复。',
    })).slice(0, 5),
    next_5_moves: [],
    reply_strategy: '',
    flirt_level: '先别暧昧',
    is_chat_screenshot: isChatScreenshot,
    non_chat_reply: cleanText(ocrValue.non_chat_reply, 120),
    chat_evidence: chatEvidence,
    conversation_summary: buildDialogueSummary(dialogue),
    chat_guide: buildDefaultChatGuide(),
    next_topics: [],
    dialogue,
    suggest_stop: false,
    needs_retry: effectiveNeedsRetry,
    replies: replySeeds,
    sticker_suggestions: [],
  };
}

function hasUsableDialogueText(dialogue = []) {
  const text = dialogue.map((message) => message.text).join('');
  if (!text) return false;
  const readableMatches = text.match(/[\p{Script=Han}A-Za-z0-9]/gu) || [];
  const questionMarks = text.match(/[?？]/g) || [];
  const readableRatio = readableMatches.length / Math.max(1, text.length);
  if (readableMatches.length < 6) return false;
  if (questionMarks.length >= 6 && readableRatio < 0.45) return false;
  return readableRatio >= 0.28;
}

function buildLocalReplySeeds(dialogue) {
  const directionReplies = buildGroundedFallbackReplies(dialogue, buildConversationDirectionScene(dialogue) || {});
  if (directionReplies.length) return directionReplies.map((messages) => makeReplyCandidate(messages)).slice(0, 5);
  if (hasStudyPressureWithDiscomfort(dialogue)) {
    return [
      makeReplyCandidate(['先别逼自己了', '这题卡住真的会很烦', '你先出去透口气']),
      makeReplyCandidate(['不是你不行', '是脑子已经太累了', '先把第一题放一下']),
      makeReplyCandidate(['里面闷的话先出去走一下', '题目可以晚点再想', '你现在先把自己缓过来最重要']),
      makeReplyCandidate(['头痛就别一直硬盯着题了', '先休息十分钟', '等没那么痛了再回来做']),
      makeReplyCandidate(['midterm 的东西先不用全塞进脑子里', '我们先把最近的那部分捋清楚', '我陪你一点点拆']),
    ];
  }
  if (hasPhysicalDiscomfort(dialogue)) {
    return [
      makeReplyCandidate(['你现在感觉还好吗？', '有没有哪里特别不舒服', '先别硬撑']),
      makeReplyCandidate(['先躺一下', '我给你点点热的', '半小时后告诉我有没有好一点']),
      makeReplyCandidate(['把地址发我', '我给你送点药和清淡的吃的', '你先别硬撑']),
      makeReplyCandidate(['我在', '你先把自己缓过来', '别一个人扛着']),
    ];
  }
  const latestOpponentText = getLatestOpponentText(dialogue);
  if (/讨厌你|不喜欢你|烦你|我生气了|气死我了|哼/.test(latestOpponentText)) {
    return [
      makeReplyCandidate(['那我先认错半秒', '再认真哄你']),
      makeReplyCandidate(['你讨厌得这么认真', '我都有点想笑了']),
      makeReplyCandidate(['好好好', '我先站好让你骂两句']),
      makeReplyCandidate(['那我今天的任务', '就是把你哄回来一点']),
    ];
  }
  if (/困死|好困|困了|不想写|作业|没写完/.test(recentDialogueText(dialogue))) {
    return [
      makeReplyCandidate(['先别硬撑', '眯十分钟再写会快很多']),
      makeReplyCandidate(['作业先放一下', '你现在困到硬写也很折磨']),
      makeReplyCandidate(['我陪你把最急的那一点拆出来', '先别一口气想完全部']),
    ];
  }
  // 无匹配场景时返回空数组，由调用方决定降级策略
  return [];
}

function addConcreteFact(facts, id, terms, label = '') {
  if (facts.some((fact) => fact.id === id)) return;
  facts.push({
    id,
    label: label || terms[0] || id,
    terms: [...new Set(terms.filter(Boolean))],
  });
}

function extractConcreteFacts(source = []) {
  const text = Array.isArray(source)
    ? recentDialogueText(source, 20)
    : cleanText(source, 2000);
  const facts = [];
  const addIf = (pattern, id, terms, label) => {
    if (pattern.test(text)) addConcreteFact(facts, id, terms, label);
  };

  addIf(/头好痛|头痛|头疼/, 'headache', ['头痛', '头疼', '头好痛', '头', '痛'], '头痛');
  addIf(/难受|不舒服/, 'discomfort', ['难受', '不舒服'], '难受');
  addIf(/感冒|发烧|体温/, 'cold', ['感冒', '发烧', '量体温', '体温'], '感冒');
  addIf(/midterm|期中/i, 'midterm', ['midterm', '期中'], 'midterm');
  addIf(/第一题|题|做不出来|卡住|什么都不会/, 'study_block', ['第一题', '题', '做不出来', '卡住', '什么都不会', '换题'], '题目卡住');
  addIf(/老板|骂我|被骂|不想干/, 'boss_work', ['老板', '骂', '被骂', '不想干', '先缓一下'], '工作压力');
  addIf(/还在公司|十二点|12点|加班/, 'overtime', ['还在公司', '公司', '十二点', '12点', '加班', '吃饭', '别熬'], '加班');
  addIf(/三点|3点|睡不着|失眠/, 'insomnia', ['三点', '3点', '睡不着', '别刷手机', '闭眼'], '失眠');
  addIf(/什么都不想做|没动力|提不起劲|不想动/, 'low_mood', ['什么都不想做', '不想做', '没动力', '发生什么', '不用逼自己', '很小的事'], '情绪低落');
  addIf(/跟我妈|跟妈妈|跟家里|吵架/, 'family_conflict', ['我妈', '妈妈', '家里', '吵架', '发生什么', '不乱站队', '慢慢讲', '最难受'], '家庭吵架');
  addIf(/删了|拉黑|分手|失恋/, 'breakup', ['删了', '拉黑', '分手', '失恋', '难受', '复合', '情绪稳住', '没说完'], '被删');
  addIf(/爱回收|回收|二手商|竞价|出价|包|谁高我卖谁|省时省心|一家家跑/, 'resale', ['爱回收', '回收', '包', '竞价', '二手商', '出价', '谁高', '谁价高', '省时', '省得', '一家家跑', '报价', '合适再出'], '二手回收');
  addIf(/RX350h|RX500h|差价|车型|买车|预算|需求/, 'car_decision', ['RX350h', 'RX500h', '差价', '车型', '预算', '需求'], '买车决策');
  addIf(/搬家|东西太多|快累死|累死了/, 'moving', ['搬家', '东西太多', '东西', '累', '帮忙', '硬搬', '最重', '必须带走', '慢慢来'], '搬家');
  addIf(/日本|攻略|行程|旅游|旅行|美食/, 'travel', ['日本', '攻略', '行程', '美食'], '旅行');
  addIf(/气死了|生气|火大|烦死/, 'anger', ['气死', '生气', '发生什么', '谁惹', '慢慢骂', '气顺', '处理'], '生气');
  addIf(/拿A|拿 A|拿了A|成绩|考得好|过了/, 'celebration', ['拿A', 'A', '成绩', '恭喜'], '成绩好');
  addIf(/火锅|撑死|吃撑|刚吃完/, 'food', ['火锅', '撑', '吃撑', '好不好吃', '锅底', '消化', '快乐过载'], '火锅');
  addIf(/嗯|哦|哈哈/, 'cold_reply', ['嗯', '哦', '哈哈', '三连', '不追问', '先收一下', '想聊', '放轻', '接话兴致不高'], '冷淡回复');
  addIf(/裙子|新买|好看吗|自拍|照片|穿搭/, 'photo_compliment', ['裙子', '新买', '好看', '细节', '穿搭'], '新裙子');
  addIf(/没人陪我|没人陪|陪我|不陪我/, 'clingy', ['没人陪', '陪你', '陪我'], '需要陪伴');
  addIf(/跟她聊挺多|跟他聊挺多|跟她聊|跟他聊|吃醋/, 'jealousy', ['跟她聊', '跟他聊', '聊挺多', '安全感', '解释', '不舒服', '分寸', '在意', '讲清楚'], '吃醋');
  addIf(/喜欢一个人|有点喜欢|喜欢上|有喜欢的人/, 'confession_hint', ['喜欢一个人', '喜欢', '那个人', '猜是谁', '心动', '不用急'], '喜欢一个人');
  addIf(/闷|里面好闷|透气|透口气/, 'stuffy_room', ['闷', '里面好闷', '透气', '透口气'], '环境闷');
  addIf(/在干嘛|找你说话|我俩很不熟吗|我们很不熟吗|你怎么不理我|我找你说话|你最近都不找我|你是不是很忙|不打扰你|你就回我这个|你都不认真回|算了|不说了/, 'attention_seeking', ['在干嘛', '找你说话', '不熟', '不理', '不找我', '不打扰', '回太冷', '认真回', '好好回', '补回来', '我错了', '熟啊', '陪你聊'], '主动求关注');
  addIf(/我[:：]?\s*(好的|不知道|o|嗯|哦)|好的|不知道|你要干啥|^o$/i, 'user_cold_reply', ['好的', '不知道', 'o', '只回一个', '回太冷', '脑子卡住', '补回来', '我错了', '认真点'], '我方回复偏冷');

  return facts;
}

function replyMatchesConcreteFact(reply, facts = []) {
  const text = cleanText(reply?.text || (Array.isArray(reply?.messages) ? reply.messages.join(' ') : reply), 300).toLowerCase();
  if (!text || !facts.length) return false;
  return facts.some((fact) => fact.terms.some((term) => term && text.includes(String(term).toLowerCase())));
}

function isGenericReplyCandidate(reply) {
  const text = cleanText(reply?.text || (Array.isArray(reply?.messages) ? reply.messages.join(' ') : reply), 300);
  return GENERIC_REPLY_TEMPLATE_PATTERN.test(text) || BAD_SPACE_ADVICE_PATTERN.test(text);
}

function isFactDrivenScene(sceneName = '') {
  return FACT_DRIVEN_SCENE_PATTERN.test(sceneName);
}

function buildGroundedFallbackReplies(dialogue = [], scene = {}) {
  const text = recentDialogueText(dialogue, 20);
  const sceneName = scene?.scene || detectGroundedScene(dialogue)?.scene || '';
  const directionSignals = analyzeConversationDirection(dialogue);

  if (/attention_seeking|wants_connection|playful_complaint|user_too_cold|needs_reassurance|hurt_by_cold_reply/.test(sceneName) || directionSignals.repair_needed || directionSignals.attention_seeking) {
    if (directionSignals.needs_reassurance) {
      return [
        ['没有打扰我', '刚刚是我回得太冷了'],
        ['我是在忙了一下', '不是不想理你'],
        ['你不用退回去', '我现在认真陪你聊'],
        ['别说不打扰这种话', '你来找我我挺开心的'],
      ];
    }
    if (directionSignals.hurt_by_cold_reply) {
      return [
        ['我错了', '刚刚不该那么敷衍你'],
        ['不是不认真回你', '我现在把注意力拉回来'],
        ['你别先不说了', '我认真听你讲'],
        ['刚刚我只回一个字确实欠揍', '现在开始好好回你'],
      ];
    }
    if (/你最近都不找我|你最近怎么不找我|都不找我|有啊/.test(text)) {
      return [
        ['有吗这句我撤回', '我确实该主动一点'],
        ['不是不找你', '我怕打扰你才憋着'],
        ['那我现在补一次', '你今天在干嘛'],
        ['我错了', '以后我主动一点', '别给我扣分'],
      ];
    }
    if (/你怎么不理我|我找你说话/.test(text)) {
      return [
        ['刚看到', '不是不想理你'],
        ['你来找我说话', '我当然要认真回'],
        ['刚刚我回得太冷了', '现在补回来'],
        ['没有不理你', '我现在认真陪你聊'],
      ];
    }
    if (/怎么变熟|变熟点|变熟一点|怎么熟|熟一点/.test(text)) {
      return [
        ['那先从我不只回一个字开始', '刚刚是我太冷了', '我补回来'],
        ['想变熟也简单', '你负责来找我', '我负责好好回你'],
        ['刚刚那个 o 我撤回', '现在重新来', '你想聊什么'],
        ['先从认真陪你聊开始', '不装死了', '你问我我好好答'],
        ['熟一点的话', '我先交个补考作业', '今天认真陪你聊'],
      ];
    }
    return [
      ['没有啊', '刚刚我回太冷了', '我补回来'],
      ['谁说不熟', '你都来找我说话了', '那肯定熟'],
      ['刚刚有点没反应过来', '你现在想聊什么', '我认真点'],
      ['我错了', '不该只回一个 o', '现在开始好好回你'],
      ['熟啊', '只是我刚刚脑子卡住了', '你别扣我分'],
    ];
  }

  if (/二手回收/.test(sceneName) || /爱回收|回收|竞价|二手商|谁高我卖谁/.test(text)) {
    return [
      ['就是爱回收那个平台', '我把包挂上去', '让二手商自己出价'],
      ['主要是省得我一家家跑去问', '谁价高我就卖谁'],
      ['不是随便卖啦', '我会先看报价', '合适再出'],
    ];
  }
  if (/买车决策/.test(sceneName) || /RX350h|RX500h|差价/.test(text)) {
    return [
      ['RX350h 和 RX500h 主要还是看你需求', '差价大就先别急着冲高配'],
      ['如果你更在意预算', 'RX350h 可能更稳一点'],
      ['要是你真的很在意动力和配置', '我们再算 RX500h 的差价值不值'],
    ];
  }
  if (/搬家压力/.test(sceneName) || /搬家|东西太多/.test(text)) {
    return [
      ['搬家东西太多真的会累崩', '你先别一个人硬搬'],
      ['现在最重的是哪几箱', '需要我过去帮你搬一下吗'],
      ['先把必须带走的东西分出来', '剩下的慢慢来，别累死自己'],
    ];
  }
  if (/旅行规划/.test(sceneName) || /日本|攻略/.test(text)) {
    return [
      ['下周去日本还没做攻略的话', '先别慌，我们先定每天一个主线'],
      ['你先告诉我去东京还是大阪', '我帮你把美食和行程分开列'],
      ['攻略不用一次做完', '先把机票酒店和想吃的东西排出来'],
    ];
  }
  if (/加班/.test(sceneName) || /还在公司|十二点/.test(text)) {
    return [
      ['还在公司也太晚了', '十二点前你至少先吃点东西'],
      ['今天别熬太狠', '能收尾就先收，回家路上跟我说一声'],
      ['你现在先确认有没有吃饭', '别到十二点还空着肚子硬撑'],
    ];
  }
  if (/家庭冲突/.test(sceneName) || /跟我妈|吵架/.test(text)) {
    return [
      ['又跟你妈吵架了吗', '先跟我说说发生什么了'],
      ['我先不乱站队', '你慢慢讲，我听你这边的委屈'],
      ['你现在别急着继续吵', '先把刚刚最难受的点说出来'],
    ];
  }
  if (/失恋|被删/.test(sceneName) || /删了|拉黑/.test(text)) {
    return [
      ['她把你删了这一下肯定很难受', '你先别急着立刻去找她'],
      ['我先陪你把情绪稳住', '复不复合晚点再想'],
      ['你现在最难受的是被删这件事', '还是还有话没说完'],
    ];
  }
  if (/情绪低落/.test(sceneName) || /什么都不想做/.test(text)) {
    return [
      ['最近什么都不想做', '是发生什么了吗'],
      ['先不用逼自己立刻好起来', '你跟我说一点点也行'],
      ['今天先做一件很小的事就够了', '剩下的我陪你慢慢捡回来'],
    ];
  }
  if (/成绩庆祝/.test(sceneName) || /拿A|拿 A|成绩/.test(text)) {
    return [
      ['拿 A 了也太厉害了吧', '这必须认真夸一下'],
      ['你今天这个成绩很值得开心', '之前努力没白费'],
      ['恭喜你呀', '要不要奖励自己一点好吃的'],
    ];
  }
  if (/日常美食/.test(sceneName) || /火锅|撑死/.test(text)) {
    return [
      ['刚吃完火锅就撑死了', '你这是快乐过载了吧'],
      ['火锅好不好吃', '下次别只负责馋我'],
      ['你先慢慢消化一下', '但我得问一句，点的什么锅底'],
    ];
  }
  if (/冷淡回复/.test(sceneName) || hasRepeatedColdReplies(dialogue) || /嗯.*哦.*哈哈|嗯\s+哦\s+哈哈/.test(text)) {
    return [
      ['你这嗯哦哈哈三连', '我先不继续追问了'],
      ['那我先收一下', '等你想聊的时候再说'],
      ['我感觉你现在接话兴致不高', '那我先放轻一点'],
    ];
  }
  if (/夸照片/.test(sceneName) || /裙子|好看吗/.test(text)) {
    return [
      ['这条裙子挺适合你的', '不是那种随便好看的好看'],
      ['新买的裙子颜色很衬你', '整个人看起来更温柔一点'],
      ['好看', '而且是那种我会多看两眼的好看'],
    ];
  }
  if (/撒娇求陪/.test(sceneName) || /没人陪/.test(text)) {
    return [
      ['没人陪你啊', '那我今天先申请上岗一会儿'],
      ['我可以陪你', '但你要告诉我想让我怎么陪'],
      ['你这句没人陪我', '说得我有点想立刻出现'],
    ];
  }
  if (/吃醋/.test(sceneName) || /跟她聊挺多|跟他聊挺多/.test(text)) {
    return [
      ['你说我跟她聊挺多', '我先认真解释一下'],
      ['那只是正常聊天', '但你不舒服我会注意分寸'],
      ['我不想让你没安全感', '你在意的话我会讲清楚'],
    ];
  }
  if (/表白试探/.test(sceneName) || /喜欢一个人/.test(text)) {
    return [
      ['有点喜欢一个人啊', '那个人知道吗'],
      ['你说得这么认真', '我突然有点想猜是谁'],
      ['喜欢一个人这件事不用急', '但你可以先告诉我，他哪里让你心动'],
    ];
  }
  if (/生气/.test(sceneName) || /气死了/.test(text)) {
    return [
      ['你真的气死了的话', '先告诉我发生什么了'],
      ['先别憋着', '谁惹你了你慢慢骂给我听'],
      ['我先站在你这边听完', '等你气顺一点我们再想怎么处理'],
    ];
  }
  if (/失眠/.test(sceneName) || /三点|睡不着/.test(text)) {
    return [
      ['已经三点还睡不着', '先别继续刷手机了'],
      ['你现在把屏幕放远一点', '闭眼休息也算休息'],
      ['睡不着也别怪自己', '我陪你把情绪放轻一点'],
    ];
  }
  if (/工作压力/.test(sceneName) || /老板|骂我|不想干/.test(text)) {
    return [
      ['老板一直骂你真的很烦', '你先别急着把“不想干了”憋在心里'],
      ['先缓一下', '今天被骂这口气可以先跟我吐出来'],
      ['不想干很正常', '但我们先等情绪降下来再想下一步'],
    ];
  }
  if (/困死|好困|困了|不想写|作业|没写完/.test(text)) {
    return [
      ['先别硬撑', '眯十分钟再写会快很多'],
      ['作业先放一下', '你现在困到硬写也很折磨'],
      ['我陪你把最急的那一点拆出来', '先别一口气想完全部'],
      ['先把眼睛从题上挪开一下', '缓过来再写，不然只会更烦'],
    ];
  }
  if (/学习压力/.test(sceneName) || /midterm|第一题|做不出来|什么都不会/.test(text)) {
    return [
      ['midterm 快到了会慌很正常', '但不是你什么都不会'],
      ['第一题做不出来就先别死磕', '换一题找点手感'],
      ['卡住的时候先休息几分钟', '别硬撑到脑子更乱'],
    ];
  }
  if (/晚安/.test(sceneName) || /晚安|睡了|睡觉|困了/.test(text)) {
    return [
      ['晚安啦', '别偷偷熬夜'],
      ['那你先乖乖睡', '明天醒了告诉我'],
      ['晚安', '梦里也要给我留个位置'],
      ['快去睡吧', '我明早再来找你'],
    ];
  }
  if (/想你|梦到你|深夜聊天/.test(sceneName) || /想你了|想你|想我|想见你|梦到你/.test(text)) {
    return [
      ['我也有点想你', '刚好被你说出来了'],
      ['你这句有点犯规', '我本来还能忍一下的'],
      ['那你现在多说两句', '我听听想我到什么程度'],
      ['收到', '这条我先存起来开心一下'],
    ];
  }
  if (/感谢|谢谢/.test(sceneName) || /谢谢|谢啦|thank/i.test(text)) {
    return [
      ['不客气', '你这么认真谢我我会骄傲'],
      ['收到你的谢谢了', '但我更想听你说好一点了'],
      ['这点小事不用谢', '下次继续找我就行'],
      ['可以谢', '但别跟我太客气'],
    ];
  }
  if (/身体不舒服/.test(sceneName) || hasPhysicalDiscomfort(dialogue)) {
    return [
      ['你头痛又难受的话', '先别硬撑，量一下体温'],
      ['如果像感冒了', '先喝点水，能躺就躺一会儿'],
      ['头痛还持续的话告诉我', '我陪你看要不要吃点药'],
    ];
  }
  return [];
}

function getReplyGroundingReport(advice) {
  const dialogue = advice?.dialogue || [];
  const replies = Array.isArray(advice?.replies) ? advice.replies : [];
  const facts = extractConcreteFacts(dialogue);
  const sceneName = advice?.analysis?.scene || detectGroundedScene(dialogue)?.scene || '';
  const factDriven = isFactDrivenScene(sceneName);
  const genericReplies = replies.filter(isGenericReplyCandidate);
  const ungroundedReplies = facts.length
    ? replies.filter((reply) => !replyMatchesConcreteFact(reply, facts))
    : [];
  const fallback = buildGroundedFallbackReplies(dialogue, advice?.analysis || {});
  const needsRepair = Boolean(fallback.length) && (
    genericReplies.length > 0
    || (factDriven && ungroundedReplies.length > 0)
  );

  return {
    facts,
    scene: sceneName,
    fact_driven: factDriven,
    generic_count: genericReplies.length,
    ungrounded_count: ungroundedReplies.length,
    needs_repair: needsRepair,
  };
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

function buildJsonParseFallbackAdvice(rawOutput = '') {
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
  return {
    attitude_label: '解析异常',
    attitude_desc: '这次模型返回格式不完整，页面没有采用半截结果。请点“重新分析”，我会重新生成一版。',
    interest_score: 0,
    interest_level: '低意愿',
    interest_signals: [],
    conversation_mode: '礼貌回应',
    conversation_stage: '初次认识',
    analysis: {
      stage: 'ice_breaking',
      stage_label: RELATIONSHIP_STAGE_LABELS.ice_breaking,
      scene: '',
      scene_id: '',
      emotion: '',
      reply_intent: '',
      intimacy_score: 0,
    },
    relationship_memory_engine: relationshipMemory,
    relationship_stage: 'ice_breaking',
    intimacy_score: 0,
    attraction_score: 0,
    investment_balance: 'balanced',
    initiator: 'unclear',
    reply_risk: 'safe',
    risk_level: 'safe',
    next_best_move: '点击重新分析，重新生成完整结果',
    conversation_future: normalizeConversationFuture({}, { relationshipMemory, scene: null }),
    relationship_goal: relationshipGoal,
    coach_advice: normalizeCoachAdvice({}, { relationshipMemory, relationshipGoal, scene: null }),
    reply_explanation: [],
    next_5_moves: [],
    reply_strategy: '',
    flirt_level: '先别暧昧',
    is_chat_screenshot: true,
    non_chat_reply: '',
    chat_evidence: {},
    conversation_summary: '',
    chat_guide: {
      current_move: '点击重新分析，重新生成完整结果',
      next_steps: ['如果截图较长，可以裁剪聊天区域后再试。', '如果图片模糊，换一张更清晰的截图。'],
      avoid: '不要使用这次半截结果。',
    },
    next_topics: ['重新分析一次，或换一张更清晰/更短的截图。'],
    dialogue: [],
    suggest_stop: false,
    needs_retry: true,
    degraded: false,
    json_parse_failed: true,
    replies: [],
    stickers: [],
    sticker_match_intent: null,
    sticker_suggestions: [],
  };
}

function buildFailureUsageAdvice({ errorMessage = '', elapsedMs = 0 } = {}) {
  const advice = buildFreeTierFallbackAdvice();
  return {
    ...advice,
    attitude_label: '分析失败',
    attitude_desc: cleanText(errorMessage, 180) || '分析请求失败。',
    analysis_result_error: cleanText(errorMessage, 500),
    elapsed_ms: elapsedMs,
  };
}

function buildVisionTimeoutFallbackAdvice() {
  const advice = buildFreeTierFallbackAdvice();
  return {
    ...advice,
    attitude_label: '识图超时',
    attitude_desc: '截图已经收到，但 OpenAI Vision 分析超时了。这不是“非聊天截图”，只是本次识图太慢；请重新分析，或换一张更清晰、只保留聊天区域的截图。',
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

function cleanAttitudeLabel(value) {
  const label = cleanText(value, 16);
  return /舔狗|照镜子|卑微|备胎/.test(label) ? '' : label;
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
  const validDimensions = new Set(['LIGHTHEARTED', 'SINCERE', 'WARM_CARING', 'PLAYFUL', 'FLIRTY', 'DIRECT_ANSWER', 'INTELLECTUAL']);
  const hasExplicitStyleDimension = validDimensions.has(reply?.style_dimension);
  const styleDimension = hasExplicitStyleDimension ? reply.style_dimension : 'SINCERE';
  candidate.style_dimension = styleDimension;
  Object.defineProperty(candidate, '_style_dimension_inferred', {
    value: !hasExplicitStyleDimension,
    enumerable: false,
  });
  return candidate;
}

function makeReplyCandidate(messages, styleDimension = null) {
  const payload = styleDimension ? { messages, style_dimension: styleDimension } : { messages };
  return normalizeReplyCandidate(payload) || { text: '', messages: [], style_dimension: styleDimension || 'SINCERE' };
}

function isDirectionRepairScene(sceneName = '') {
  return DIRECTION_REPAIR_SCENE_PATTERN.test(sceneName || '');
}

function replyFollowsDirectionGuide(reply) {
  const text = cleanText(reply?.text || (Array.isArray(reply?.messages) ? reply.messages.join(' ') : reply), 220);
  return /回太冷|回复偏冷|补回来|我错了|不该|认真|不熟|找你说话|不打扰|不是不想理|陪你聊|扣分|变熟|只回一个|好好回|重新来/.test(text);
}

function alignRepliesWithGuide({ replies = [], dialogue = [], scene = null, hasDirectionRepair = false } = {}) {
  const sceneName = scene?.scene || '';
  if (!hasDirectionRepair && !isDirectionRepairScene(sceneName)) return replies;
  const hasBadAdvice = replies.some(isGenericReplyCandidate);
  const followsGuide = replies.some(replyFollowsDirectionGuide);
  if (replies.length >= 3 && followsGuide && !hasBadAdvice) return replies;

  const fallbackReplies = buildGroundedFallbackReplies(dialogue, scene || {});
  return fallbackReplies.length
    ? fallbackReplies.map((messages) => makeReplyCandidate(messages)).slice(0, 5)
    : replies;
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

function buildGroupChatAdvice() {
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
  return {
    attitude_label: '这是群聊截图',
    attitude_desc: '目前 yuchaolove 只支持双人聊天截图。请截取你和对方的私信对话后重新上传。',
    interest_score: 0,
    interest_level: '低意愿',
    interest_signals: [],
    conversation_mode: '礼貌回应',
    conversation_stage: '初次认识',
    analysis: {
      stage: 'ice_breaking',
      stage_label: '破冰期',
      scene: '',
      scene_id: '',
      emotion: '',
      reply_intent: '',
      intimacy_score: 0,
    },
    relationship_memory_engine: relationshipMemory,
    relationship_stage: 'ice_breaking',
    intimacy_score: 0,
    attraction_score: 0,
    investment_balance: 'balanced',
    initiator: 'unclear',
    reply_risk: 'safe',
    risk_level: 'safe',
    next_best_move: '',
    conversation_future: { next_reply_likely: '', second_reply_likely: '', third_reply_likely: '' },
    relationship_goal: relationshipGoal,
    coach_advice: { summary: '请上传私信截图', do: [], avoid: [] },
    reply_explanation: [],
    next_5_moves: ['请截取你和对方的私信截图重新上传。', '', '', '', ''],
    reply_strategy: '',
    flirt_level: '先别暧昧',
    is_chat_screenshot: true,
    is_group_chat: true,
    non_chat_reply: '这是群聊截图，请上传私信截图。',
    chat_evidence: {},
    conversation_summary: '',
    chat_guide: buildDefaultChatGuide(),
    next_topics: [],
    dialogue: [],
    suggest_stop: false,
    needs_retry: false,
    replies: [],
    sticker_match_intent: null,
    sticker_suggestions: [],
  };
}

function buildEmotionalDisclosureGuide() {
  return buildStageChatGuide('情绪陪伴');
}

function buildActiveCuriosityGuide() {
  return buildStageChatGuide('稳定了解');
}

const SCENE_LIBRARY_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'chat', 'scene-library.json');
const RELATIONSHIP_ENGINE_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'chat', 'relationship-engine.v1.json');
const INTENT_STRATEGY_MAP_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'chat', 'intent-strategy-map.json');
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
const INTENT_STRATEGY_MAP = loadIntentStrategyMap();
const STICKER_LIBRARY = loadStickerLibrary();
const STOCK_STICKER_CATALOG = loadStickerCatalog();
const STICKER_RECOMMENDATION_COUNT = 6;
const STICKER_EMOTIONS = new Set(['greeting', 'happy', 'laugh', 'shy', 'flirt', 'love', 'missing', 'miss_you', 'sad', 'cry', 'wronged', 'comfort', 'comforting', 'encourage', 'thanks', 'goodnight', 'angry', 'awkward', 'speechless', 'excited', 'proud', 'jealous', 'jealous_cute', 'surprised', 'thinking', 'sleepy', 'apology', 'waiting', 'acting_cute', 'tsundere', 'heart_flutter', 'morning', 'question', 'sulky']);
const STICKER_SCENARIOS = new Set(['greeting', 'studying', 'working', 'tired', 'good_morning', 'good_night', 'missing_you', 'apology', 'encouragement', 'celebration', 'teasing', 'flirting', 'confession', 'thanks', 'waiting', 'waiting_reply', 'reply_late', 'asking_attention', 'agree', 'refuse', 'speechless', 'angry_complaint', 'jealousy', 'hug', 'comfort', 'cute_acting', 'acting_cute', 'morning_greeting', 'late_night_chat', 'getting_home', 'heart_flutter', 'sulking', 'bye', 'safe_exit']);
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
const STICKER_CHARACTER_ORDER = ['white_mochi', 'hamster', 'cat', 'bunny', 'shiba'];
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
  morning: 'greeting',
  question: 'thinking',
  sulky: 'sad',
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
  jealous: ['jealous', 'jealous_cute', 'shy', 'love', 'comfort'],
  jealous_cute: ['jealous_cute', 'jealous', 'shy', 'love'],
  waiting: ['waiting', 'shy', 'miss_you', 'love'],
  acting_cute: ['acting_cute', 'shy', 'comfort', 'love'],
  tsundere: ['tsundere', 'shy', 'awkward', 'love'],
  heart_flutter: ['heart_flutter', 'love', 'shy'],
  question: ['question', 'thinking', 'awkward', 'surprised'],
  sulky: ['sulky', 'sad', 'cry', 'comfort'],
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
  waiting: ['waiting', 'waiting_reply', 'missing_you', 'flirting'],
  waiting_reply: ['waiting_reply', 'waiting', 'missing_you', 'flirting'],
  jealousy: ['jealousy', 'flirting', 'comfort'],
  acting_cute: ['acting_cute', 'cute_acting', 'hug', 'flirting'],
  cute_acting: ['cute_acting', 'acting_cute', 'hug', 'flirting'],
  morning_greeting: ['morning_greeting', 'good_morning', 'greeting'],
  late_night_chat: ['late_night_chat', 'good_night', 'missing_you', 'flirting'],
  getting_home: ['getting_home', 'greeting', 'comfort'],
  heart_flutter: ['heart_flutter', 'flirting', 'missing_you'],
  sulking: ['sulking', 'comfort', 'hug', 'flirting'],
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
  repair_cold_reply: {
    emotion: 'apology',
    secondary_emotions: ['comfort', 'shy', 'love'],
    scenario: ['apology', 'comfort', 'hug', 'flirting', 'asking_attention'],
    keywords: ['道歉', '哄你', '我在呢', '贴贴', '委屈', '抱抱', '补回来', '别扣分'],
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
  study_pressure_support: {
    emotion: 'comfort',
    secondary_emotions: ['encourage', 'sleepy', 'love'],
    scenario: ['comfort', 'hug', 'encouragement', 'studying'],
    keywords: ['抱抱', '摸头', '别硬撑', '休息一下', '我在呢', '加油', '喝水', '题卡住'],
    intensity: 3,
    avoid_emotions: ['angry', 'jealous'],
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

function loadIntentStrategyMap() {
  try {
    return JSON.parse(readFileSync(INTENT_STRATEGY_MAP_PATH, 'utf8'));
  } catch (error) {
    console.warn(`Intent strategy map failed to load: ${error.message}`);
    return {};
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

  if (scene.scene === '身体不舒服' && hasPhysicalDiscomfort(dialogue)) score += hasStudyPressureWithDiscomfort(dialogue) ? 20 : 80;
  if ((scene.scene === '工作压力' || scene.scene === '学习压力') && hasStudyStress(dialogue)) score += hasStudyPressureWithDiscomfort(dialogue) ? 95 : 45;
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
  if ((scene.scene === '工作压力' || scene.scene === '学习压力') && /好累|太累|累死|撑不住|不想上学|没写完|第一题|做不出来|midterm|最近的东西|头.*痛|好闷|里面好闷/.test(haystack)) score += 58;

  return score;
}

function buildSyntheticScene({ id, scene, variant = '通用', stage = 'daily_connection', triggers = [], psychology = '', goals = [], reply_strategy = [], sticker_strategy = [], next_topics = [] }) {
  return {
    id,
    scene,
    variant,
    stage,
    triggers,
    psychology,
    goals,
    reply_strategy,
    sticker_strategy,
    next_topics,
  };
}

function detectGroundedScene(dialogue = []) {
  const text = recentDialogueText(dialogue, 20);
  if (!text) return null;

  const directionScene = buildConversationDirectionScene(dialogue);
  if (directionScene) return directionScene;

  if (/爱回收|回收|二手商|竞价|出价|把包挂上去|包也收|谁高我卖谁|省时省心|一家家跑/.test(text)) {
    return buildSyntheticScene({
      id: 'resale_explain_001',
      scene: '二手回收解释',
      variant: '解释模式',
      stage: 'daily_connection',
      triggers: ['爱回收', '包', '竞价', '二手商出价', '谁高卖谁', '省时间'],
      psychology: '对方是在追问一个实际决策逻辑，回复要解释清楚平台、流程和为什么省事，不要转成情绪倾听。',
      goals: ['解释平台', '解释竞价流程', '说明省时间', '保留继续追问空间'],
      reply_strategy: ['说清是爱回收', '把包挂上去', '二手商同时出价', '谁价高卖谁', '合适再出'],
      sticker_strategy: ['收到', '思考', 'OK'],
      next_topics: ['可以补一句：我会先看报价，合适才卖。', '如果对方继续问，可以解释平台怎么验货。'],
    });
  }
  if (/RX350h|RX500h|差价|车型|买车|预算|油混|混动|需求/.test(text)) {
    return buildSyntheticScene({
      id: 'car_decision_001',
      scene: '买车决策',
      variant: '车型纠结',
      stage: 'daily_connection',
      triggers: ['RX350h', 'RX500h', '差价', '预算', '需求'],
      psychology: '对方在做选择，需要帮她把预算、需求和差价拆清楚，不适合只安慰。',
      goals: ['帮她拆需求', '比较差价', '降低选择焦虑'],
      reply_strategy: ['先确认预算', '问日常用途', '比较差价值不值'],
      sticker_strategy: ['思考', '收到', '加油'],
      next_topics: ['问她更在意动力还是预算。', '可以一起列一下用车场景。'],
    });
  }
  if (/搬家|东西太多|搬不完|快累死|累死了/.test(text)) {
    return buildSyntheticScene({
      id: 'moving_stress_001',
      scene: '搬家压力',
      variant: '东西多很累',
      stage: 'emotional_bonding',
      triggers: ['搬家', '东西太多', '累'],
      psychology: '对方在体力和琐事压力里，需要具体帮忙和情绪承接。',
      goals: ['接住疲惫', '提供帮忙', '拆任务'],
      reply_strategy: ['承认搬家很累', '问需不需要帮忙', '先处理最重/最急的东西'],
      sticker_strategy: ['抱抱', '加油', '别硬撑'],
      next_topics: ['问还有几箱。', '问要不要帮她叫车或搬重物。'],
    });
  }
  if (/日本|攻略|行程|下周去|旅游|旅行|机票|酒店|美食/.test(text)) {
    return buildSyntheticScene({
      id: 'travel_planning_001',
      scene: '旅行规划',
      variant: '没做攻略',
      stage: 'daily_connection',
      triggers: ['日本', '攻略', '行程', '美食'],
      psychology: '对方在分享计划和轻微求助，适合接旅行细节并一起规划。',
      goals: ['接住分享', '提供轻帮忙', '制造共同话题'],
      reply_strategy: ['接日本', '问城市/天数', '一起列美食和行程'],
      sticker_strategy: ['开心', '收到', '加油'],
      next_topics: ['问她去东京还是大阪。', '可以推荐先定每天一个主线。'],
    });
  }
  if (/还在公司|十二点|12点|加班|又得.*点|今晚很晚/.test(text)) {
    return buildSyntheticScene({
      id: 'overtime_001',
      scene: '加班',
      variant: '很晚还在公司',
      stage: 'emotional_bonding',
      triggers: ['还在公司', '十二点', '加班'],
      psychology: '对方在疲惫加班，需要被心疼，也需要吃饭、回家安全和别硬熬的提醒。',
      goals: ['心疼', '提醒吃饭', '关心安全回家'],
      reply_strategy: ['提到还在公司', '接住十二点', '问有没有吃饭', '提醒别熬太狠'],
      sticker_strategy: ['辛苦啦', '抱抱', '别硬撑'],
      next_topics: ['问她到家没。', '第二天问昨晚有没有补觉。'],
    });
  }
  if (/跟我妈.*吵架|跟妈妈.*吵架|跟家里.*吵架|又吵架|家里吵/.test(text)) {
    return buildSyntheticScene({
      id: 'family_conflict_001',
      scene: '家庭冲突',
      variant: '和家人吵架',
      stage: 'emotional_bonding',
      triggers: ['跟我妈吵架', '家里吵架'],
      psychology: '对方在家庭冲突里，不要急着站队，先问发生什么，让她把委屈说出来。',
      goals: ['询问发生什么', '承接情绪', '避免直接站队'],
      reply_strategy: ['问发生什么', '让她慢慢说', '先陪她稳住情绪'],
      sticker_strategy: ['抱抱', '我在呢', '摸头'],
      next_topics: ['问吵架的点是什么。', '等她说完再帮她判断要不要沟通。'],
    });
  }
  if (/删了|拉黑|分手|失恋|不理我了|不要我了/.test(text)) {
    return buildSyntheticScene({
      id: 'breakup_rejection_001',
      scene: '失恋被删',
      variant: '被删/被拒绝',
      stage: 'emotional_bonding',
      triggers: ['删了', '拉黑', '失恋'],
      psychology: '对方在被拒绝后的失落里，先接情绪和尊严，不要马上教复合。',
      goals: ['接住受伤', '稳住情绪', '不急着出主意'],
      reply_strategy: ['先承认很难受', '问她现在还好吗', '不要立刻教复合'],
      sticker_strategy: ['抱抱', '不哭啦', '我在呢'],
      next_topics: ['问她现在想不想说过程。', '提醒她先别立刻冲动联系。'],
    });
  }
  if (/最近什么都不想做|什么都不想做|没动力|提不起劲|不想动/.test(text)) {
    return buildSyntheticScene({
      id: 'low_mood_001',
      scene: '情绪低落',
      variant: '没动力',
      stage: 'emotional_bonding',
      triggers: ['最近什么都不想做', '没动力'],
      psychology: '对方不是要大道理，先问发生了什么，再给轻量陪伴。',
      goals: ['问发生什么', '接住低落', '降低压力'],
      reply_strategy: ['先问怎么了', '不要讲大道理', '陪她从很小一步开始'],
      sticker_strategy: ['抱抱', '我在呢', '摸头'],
      next_topics: ['问最近是不是发生了什么。', '建议先做一件很小的事。'],
    });
  }
  if (/拿A了|拿 A 了|拿了A|今天A了|成绩|考得好|过了/.test(text)) {
    return buildSyntheticScene({
      id: 'celebration_grade_001',
      scene: '成绩庆祝',
      variant: '拿A',
      stage: 'daily_connection',
      triggers: ['拿A', '成绩好'],
      psychology: '对方在分享好消息，需要真诚夸奖和一起开心。',
      goals: ['恭喜', '夸她', '一起开心'],
      reply_strategy: ['明确恭喜', '夸努力', '轻松庆祝'],
      sticker_strategy: ['开心', '夸夸', '鼓掌'],
      next_topics: ['问她怎么庆祝。', '顺手夸她之前的努力。'],
    });
  }
  if (/火锅|撑死了|吃撑|刚吃完|吃完/.test(text)) {
    return buildSyntheticScene({
      id: 'daily_food_001',
      scene: '日常美食',
      variant: '火锅吃撑',
      stage: 'daily_connection',
      triggers: ['火锅', '撑死了'],
      psychology: '这是轻松日常分享，不要误判成生病，顺着食物和吃撑开玩笑即可。',
      goals: ['接火锅', '轻松调侃', '延续日常'],
      reply_strategy: ['提到火锅', '接吃撑', '问好不好吃/下次带我'],
      sticker_strategy: ['开心', '吃饭', '哈哈哈'],
      next_topics: ['问她点了什么锅底。', '可以接下次一起吃。'],
    });
  }
  if (hasOpponentLowEngagement(dialogue)) {
    return buildSyntheticScene({
      id: 'cold_reply_001',
      scene: '冷淡回复',
      variant: '低接话',
      stage: 'ice_breaking',
      triggers: ['嗯', '哦', '哈哈'],
      psychology: '对方接话信号弱，需要降低推进强度，轻松收住，不要连续追问。',
      goals: ['降强度', '保留空间', '轻松接话'],
      reply_strategy: ['不追问', '轻松收尾', '给对方空间'],
      sticker_strategy: ['收到', '尴尬', 'OK'],
      next_topics: ['暂停推进。', '晚点换一个轻松日常再开。'],
    });
  }
  if (/裙子|新买的裙子|好看吗|自拍|照片|穿搭/.test(text)) {
    return buildSyntheticScene({
      id: 'compliment_photo_001',
      scene: '夸照片',
      variant: '新裙子',
      stage: 'push_pull_flirting',
      triggers: ['裙子', '好看吗', '照片'],
      psychology: '对方在寻求评价，要夸具体细节，不要只说好看。',
      goals: ['具体夸', '轻微暧昧', '制造下一句'],
      reply_strategy: ['夸裙子细节', '夸适合她', '轻轻升温'],
      sticker_strategy: ['害羞', '开心', '夸夸'],
      next_topics: ['问她是不是特意搭的。', '可以夸颜色/气质。'],
    });
  }
  if (/没人陪我|没人陪|陪我|不陪我/.test(text)) {
    return buildSyntheticScene({
      id: 'clingy_attention_001',
      scene: '撒娇求陪',
      variant: '没人陪',
      stage: 'push_pull_flirting',
      triggers: ['没人陪我', '陪我'],
      psychology: '对方在要陪伴和关注，适合温柔接住并轻微暧昧。',
      goals: ['给陪伴', '轻微暧昧', '继续互动'],
      reply_strategy: ['表示可以陪', '轻轻哄', '给下一句'],
      sticker_strategy: ['抱抱', '我在呢', '贴贴'],
      next_topics: ['问她想让你陪她做什么。', '可以轻轻说今晚先陪她一会儿。'],
    });
  }
  if (/你最近跟她聊挺多|跟她聊挺多|跟他聊挺多|你跟她|你跟他|吃醋/.test(text)) {
    return buildSyntheticScene({
      id: 'jealousy_reassure_001',
      scene: '吃醋',
      variant: '在意你和别人聊天',
      stage: 'push_pull_flirting',
      triggers: ['跟她聊挺多', '吃醋'],
      psychology: '对方在表达不安全感，应该安抚和解释，不能反问攻击。',
      goals: ['给安全感', '解释边界', '轻微哄'],
      reply_strategy: ['先安抚', '解释只是正常聊天', '明确更在意她'],
      sticker_strategy: ['抱抱', '哄哄你', '我在呢'],
      next_topics: ['如果她继续追问，透明说明聊天内容。', '之后减少让她不安的表达。'],
    });
  }
  if (/有点喜欢一个人|喜欢一个人|我喜欢上|有喜欢的人/.test(text)) {
    return buildSyntheticScene({
      id: 'confession_hint_001',
      scene: '表白试探',
      variant: '喜欢一个人',
      stage: 'push_pull_flirting',
      triggers: ['喜欢一个人'],
      psychology: '对方在试探或分享感情线，需要鼓励和轻微探问，不要压迫表态。',
      goals: ['鼓励', '试探', '轻微推进'],
      reply_strategy: ['问那个人知不知道', '给她安全空间', '轻轻试探是不是你'],
      sticker_strategy: ['害羞', '喜欢你', '偷看'],
      next_topics: ['问她喜欢那个人哪一点。', '如果氛围合适，轻轻试探“我能不能猜”。'],
    });
  }
  if (/我真的气死了|气死了|生气|火大|烦死/.test(text)) {
    return buildSyntheticScene({
      id: 'anger_001',
      scene: '生气',
      variant: '情绪上头',
      stage: 'emotional_bonding',
      triggers: ['气死了', '生气'],
      psychology: '对方情绪上头，先问发生什么并安抚，不要马上讲道理。',
      goals: ['问发生什么', '安抚情绪', '站在她这边听'],
      reply_strategy: ['先问怎么了', '让她骂出来', '再慢慢处理'],
      sticker_strategy: ['抱抱', '哄哄你', '别气'],
      next_topics: ['问是谁惹她了。', '等她讲完再帮她判断怎么回。'],
    });
  }
  if (/已经三点了|三点了|睡不着|失眠|还是睡不着/.test(text)) {
    return buildSyntheticScene({
      id: 'insomnia_specific_001',
      scene: '失眠',
      variant: '三点睡不着',
      stage: 'emotional_bonding',
      triggers: ['三点', '睡不着'],
      psychology: '对方深夜睡不着，需要降低刺激、少刷手机、闭眼休息。',
      goals: ['陪伴', '降低刺激', '帮助入睡'],
      reply_strategy: ['提到三点', '让她别刷手机', '闭眼休息', '轻轻陪一下'],
      sticker_strategy: ['晚安', '盖被子', '抱抱'],
      next_topics: ['明早问昨晚后来睡着了吗。', '不要深夜把话题聊兴奋。'],
    });
  }
  if (/老板.*骂|骂我|不想干了|不想干|工作/.test(text)) {
    return buildSyntheticScene({
      id: 'work_stress_boss_001',
      scene: '工作压力',
      variant: '老板责骂',
      stage: 'emotional_bonding',
      triggers: ['老板', '被骂', '不想干'],
      psychology: '对方在工作压力里，需要先接住被骂的委屈，再帮她缓一下。',
      goals: ['接住委屈', '降低冲动', '给具体缓冲'],
      reply_strategy: ['提到老板被骂', '让她先缓一下', '不要急着辞职决定'],
      sticker_strategy: ['抱抱', '辛苦啦', '别硬撑'],
      next_topics: ['问老板具体骂了什么。', '等她冷静后再聊要不要处理这份工作。'],
    });
  }
  if (/midterm|第一题|什么都不会|做不出来|题/.test(text)) {
    return buildSyntheticScene({
      id: 'study_pressure_001',
      scene: '学习压力',
      variant: '考试/题目卡住',
      stage: 'emotional_bonding',
      triggers: ['midterm', '第一题', '什么都不会', '做不出来'],
      psychology: '对方卡在考试/作业压力里，需要降低自责并给可执行的学习动作。',
      goals: ['降低自责', '拆题', '给学习动作'],
      reply_strategy: ['提到 midterm', '接第一题卡住', '建议先换题或休息', '别硬撑'],
      sticker_strategy: ['加油', '摸头', '别硬撑'],
      next_topics: ['问第一题卡在哪一步。', '建议先换一题找手感。'],
    });
  }
  if (hasPhysicalDiscomfort(dialogue)) {
    return buildSyntheticScene({
      id: 'body_discomfort_001',
      scene: '身体不舒服',
      variant: '头痛/感冒',
      stage: 'emotional_bonding',
      triggers: ['头痛', '难受', '感冒'],
      psychology: '对方身体不舒服，需要具体关心和行动建议。',
      goals: ['问清情况', '提醒休息喝水', '必要时量体温'],
      reply_strategy: ['提到头痛难受', '问是否感冒', '量体温', '休息喝水'],
      sticker_strategy: ['抱抱', '摸头', '盖被子', '我在呢'],
      next_topics: ['半小时后问有没有好一点。', '如果发烧建议量体温或吃药。'],
    });
  }
  return null;
}

function detectScene({ dialogue = [], text = '', modelAnalysis = {}, conversationStage = '轻松破冰' } = {}) {
  const explicitScene = cleanText(modelAnalysis?.scene, 40);
  const searchText = getSceneSearchText(dialogue, `${text} ${explicitScene}`);
  if (hasStudyPressureWithDiscomfort(dialogue)) {
    return normalizeSceneRecord({
      id: 'study_pressure_discomfort_001',
      scene: '学习压力',
      variant: '题目卡住+头痛闷',
      stage: 'emotional_bonding',
      triggers: ['第一题', '做不出来', 'midterm', '头痛', '头疼', '里面好闷', '闷', '想太多'],
      psychology: '对方不是单纯生病，而是在学习/考试压力里卡住，又叠加头痛和环境闷，需要先降压、换环境、短暂休息，再回到题目。',
      goals: ['接住烦躁', '降低自责', '给具体缓解动作', '陪她重新拆题'],
      reply_strategy: ['承认题卡住很烦', '接住头痛和闷的不舒服', '建议先放下第一题', '出去透气喝水', '头痛先休息十分钟', '等缓过来再回来做'],
      sticker_strategy: ['抱抱', '摸头', '别硬撑', '休息一下', '我在呢', '加油', '喝水'],
      next_topics: ['十分钟后问：头有没有没那么痛？', '等她缓过来后问：第一题卡在哪一步？', '如果她还在闷的地方，提醒她先换个空气好的位置。', '第二天可以轻轻追踪：后来那题写出来了吗？'],
    });
  }
  const groundedScene = detectGroundedScene(dialogue);
  if (groundedScene) return normalizeSceneRecord(groundedScene);
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
  if (/attention_seeking|wants_connection|playful_complaint|user_too_cold|needs_reassurance|hurt_by_cold_reply/.test(sceneName)) return 'shy';
  if (/身体不舒服|工作压力|学习压力|加班|搬家压力|家庭冲突|失恋|情绪低落|失眠|emo 动态|委屈/.test(sceneName)) return /哭|想哭|委屈|删|失恋/.test(text) ? 'sad' : 'comfort';
  if (sceneName === '晚安') return 'goodnight';
  if (sceneName === '早安') return 'greeting';
  if (/想你|梦到你|深夜聊天/.test(sceneName)) return 'miss_you';
  if (/撒娇|撒娇求陪|表白试探|夸照片|换发型/.test(sceneName)) return 'shy';
  if (/吃醋|查岗/.test(sceneName)) return 'jealous';
  if (sceneName === '生气') return 'angry';
  if (/分享歌曲|分享照片|发朋友圈|生日|节日|成绩庆祝|日常美食|旅行规划/.test(sceneName)) return 'happy';
  if (/邀约吃饭|邀约电影|约咖啡/.test(sceneName)) return 'excited';
  if (sceneName === '关系确认') return 'love';
  if (sceneName === '前任话题' || sceneName === '感情观' || /二手回收|买车决策/.test(sceneName)) return 'thinking';
  return 'happy';
}

function inferReplyIntentForScene(scene, emotion = '') {
  const sceneName = scene?.scene || '';
  if (/attention_seeking|wants_connection|playful_complaint|user_too_cold|needs_reassurance|hurt_by_cold_reply/.test(sceneName)) return 'repair_cold_reply';
  if (sceneName === '身体不舒服') return 'care_action_support';
  if (/工作压力|学习压力|加班|搬家压力/.test(sceneName)) return 'encourage_support';
  if (/失眠|emo 动态|委屈|情绪低落|家庭冲突|失恋/.test(sceneName)) return 'emotional_comfort';
  if (/二手回收/.test(sceneName)) return 'resale_explain';
  if (/买车决策/.test(sceneName)) return 'decision_support';
  if (/旅行规划/.test(sceneName)) return 'planning_support';
  if (/日常美食/.test(sceneName)) return 'playful_continue';
  if (/成绩庆祝/.test(sceneName)) return 'celebrate_together';
  if (/冷淡回复/.test(sceneName)) return 'deescalate_gracefully';
  if (sceneName === '晚安') return 'say_goodnight_back';
  if (sceneName === '早安') return 'warm_greeting';
  if (/想你|梦到你|深夜聊天/.test(sceneName)) return 'affectionate_reply';
  if (/撒娇|撒娇求陪/.test(sceneName)) return 'soften_flirty_conflict';
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
  const forceSceneStage = /attention_seeking|wants_connection|playful_complaint|user_too_cold|needs_reassurance|hurt_by_cold_reply/.test(scene?.scene || '');
  const emotion = forceSceneStage ? inferredEmotion : cleanText(rawAnalysis?.emotion, 32) || inferredEmotion;
  const inferredStage = scene?.stage || LEGACY_STAGE_TO_RELATIONSHIP_STAGE[conversationStage] || 'daily_connection';
  const stage = forceSceneStage ? inferredStage : RELATIONSHIP_STAGES.has(rawAnalysis?.stage) ? rawAnalysis.stage : inferredStage;
  const inferredReplyIntent = hasStudyPressureWithDiscomfort(dialogue)
    ? 'study_pressure_support'
    : inferReplyIntentForScene(scene, emotion);
  const rawReplyIntent = cleanText(rawAnalysis?.reply_intent, 48);
  const forceInferredIntent = hasStudyPressureWithDiscomfort(dialogue)
    || /attention_seeking|wants_connection|playful_complaint|user_too_cold|needs_reassurance|hurt_by_cold_reply/.test(scene?.scene || '');
  const replyIntent = forceInferredIntent
    ? inferredReplyIntent
    : (rawReplyIntent || inferredReplyIntent);
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
  const shouldIgnoreRaw = /attention_seeking|wants_connection|playful_complaint|user_too_cold|needs_reassurance|hurt_by_cold_reply/.test(scene?.scene || '');
  if (!shouldIgnoreRaw && Array.isArray(value)) pushUnique(topics, value.map((topic) => cleanText(topic, 120)));
  pushUnique(topics, normalizeCatalogList(scene?.next_topics).map((topic) => cleanText(topic, 120)));
  return topics.filter(Boolean).slice(0, 4);
}

function buildSceneChatGuide(scene, fallbackGuide) {
  if (!scene) return fallbackGuide;
  const strategy = normalizeCatalogList(scene.reply_strategy).join(' → ');
  const isDirectionRepairScene = /attention_seeking|wants_connection|playful_complaint|user_too_cold|needs_reassurance|hurt_by_cold_reply/.test(scene.scene || '');
  return normalizeChatGuide({
    current_move: `${scene.scene}：${strategy || scene.psychology}`,
    next_steps: normalizeCatalogList(scene.next_topics),
    avoid: isDirectionRepairScene
      ? '避免把这轮误判成对方低兴趣；她正在主动找你，问题是我方刚才回复太冷。'
      : scene.scene === '身体不舒服'
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
    'attention_seeking / wants_connection': ['apology', 'comfort', 'hug', 'flirting', 'asking_attention'],
    'playful_complaint / wants_connection': ['apology', 'comfort', 'hug', 'flirting', 'asking_attention'],
    'user_too_cold / attention_seeking': ['apology', 'comfort', 'hug', 'flirting', 'asking_attention'],
    'needs_reassurance / wants_connection': ['apology', 'comfort', 'hug', 'flirting', 'asking_attention'],
    'hurt_by_cold_reply / repair_needed': ['apology', 'comfort', 'hug', 'flirting', 'asking_attention'],
    身体不舒服: ['comfort', 'hug', 'good_night'],
    工作压力: ['encouragement', 'working', 'comfort'],
    学习压力: ['encouragement', 'studying', 'comfort'],
    加班: ['encouragement', 'comfort'],
    搬家压力: ['encouragement', 'comfort'],
    情绪低落: ['comfort', 'hug'],
    家庭冲突: ['comfort', 'hug'],
    失恋被删: ['comfort', 'hug'],
    二手回收解释: ['agree', 'thinking'],
    买车决策: ['thinking', 'agree'],
    旅行规划: ['celebration', 'agree'],
    成绩庆祝: ['celebration'],
    日常美食: ['celebration', 'agree'],
    冷淡回复: ['awkward', 'agree'],
    夸照片: ['celebration', 'flirting'],
    撒娇求陪: ['hug', 'flirting'],
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

function isShortLowEffortUserReply(message) {
  const text = cleanText(message?.text, 20);
  if (!text) return false;
  return USER_SHORT_REPLY_PATTERN.test(text)
    || USER_COLD_DEFENSIVE_PATTERN.test(text)
    || (text.length <= 2 && !/[?？]/.test(text));
}

function getOpponentConnectionIntentCount(messages) {
  return countPattern(messages, OTHER_CONNECTION_INTENT_PATTERN);
}

function getOpponentEmotionalProbeCount(messages) {
  return countPattern(messages, OTHER_EMOTIONAL_PROBE_PATTERN);
}

function isShortLowEffortOpponentReply(message) {
  const text = cleanText(message?.text, 24);
  if (!text) return false;
  if (OTHER_CONNECTION_INTENT_PATTERN.test(text) || OTHER_EMOTIONAL_PROBE_PATTERN.test(text)) return false;
  if (/[?？！!，,。]/.test(text)) return false;
  if (/表情|困|累|疼|痛|难受|不舒服|压力|烦|生气|想你|喜欢|哈哈哈哈/.test(text)) return false;
  return text.length <= 6;
}

function isUserPursuitMessage(message) {
  const text = cleanText(message?.text, 80);
  return /[?？]|在干嘛|怎么不回|为什么不回|不理我|不想聊|你是不是|到底|去哪|忙吗|专业|喜欢|爱好|做什么|回我/.test(text);
}

function hasOpponentLowEngagement(dialogue = []) {
  if (hasRecentEmotionalDisclosure(dialogue)) return false;
  const recent = (dialogue || []).slice(-10);
  const opponentMessages = recent.filter((message) => message.speaker === '对方');
  const userMessages = recent.filter((message) => message.speaker === '我');
  if (!opponentMessages.length || userMessages.length < 2) return false;
  if (getQuestionCount(opponentMessages) > 0) return false;
  if (getOpponentConnectionIntentCount(opponentMessages) > 0) return false;
  if (getOpponentEmotionalProbeCount(opponentMessages) > 0) return false;

  const latestOpponent = opponentMessages.at(-1);
  const recentOpponentTail = opponentMessages.slice(-2);
  const opponentShortCount = opponentMessages.filter(isShortLowEffortOpponentReply).length;
  const userPursuitCount = userMessages.filter(isUserPursuitMessage).length;
  const userIsDriving = userMessages.length >= opponentMessages.length
    || userMessages.length >= 3
    || userPursuitCount >= 2;
  const userIsPursuing = userPursuitCount >= 1 || userMessages.length >= 3;
  const opponentOnlyShortInTail = recentOpponentTail.every(isShortLowEffortOpponentReply);

  return isShortLowEffortOpponentReply(latestOpponent)
    && opponentOnlyShortInTail
    && opponentShortCount >= 1
    && userIsDriving
    && userIsPursuing;
}

function analyzeConversationDirection(dialogue = []) {
  const recent = (dialogue || []).slice(-10);
  const otherMessages = recent.filter((message) => message.speaker === '对方');
  const meMessages = recent.filter((message) => message.speaker === '我');
  const otherText = otherMessages.map((message) => message.text).join(' ');
  const meText = meMessages.map((message) => message.text).join(' ');
  const otherQuestionCount = getQuestionCount(otherMessages);
  const otherConnectionIntentCount = getOpponentConnectionIntentCount(otherMessages);
  const otherEmotionalProbeCount = getOpponentEmotionalProbeCount(otherMessages);
  const meShortReplyCount = meMessages.filter(isShortLowEffortUserReply).length;
  const otherInitiatedCount = otherMessages.filter((message) => (
    OTHER_CONNECTION_INTENT_PATTERN.test(message.text)
    || /[?？]|干嘛|吗|呢|怎么|为什么|为啥|找你/.test(message.text)
  )).length;
  const otherMessageCount = otherMessages.length;
  const meMessageCount = meMessages.length;
  const otherLowEngagement = hasOpponentLowEngagement(recent);
  const otherActivelySeeksConnection = otherConnectionIntentCount > 0
    || otherQuestionCount >= 2
    || otherEmotionalProbeCount > 0
    || otherInitiatedCount >= 2;
  const hasExplicitConnectionOrProbe = otherConnectionIntentCount > 0 || otherEmotionalProbeCount > 0;
  const userTooCold = otherActivelySeeksConnection && (
    (hasExplicitConnectionOrProbe && (meShortReplyCount >= 1 || USER_COLD_DEFENSIVE_PATTERN.test(meText)))
    || (!hasExplicitConnectionOrProbe && meShortReplyCount >= 2)
  );
  const needsReassurance = /那我不打扰你了|不打扰你了|你是不是很忙|是不是很忙/.test(otherText);
  const hurtByColdReply = /你就回我这个|你都不认真回|不认真回|算了|不说了/.test(otherText) && meShortReplyCount > 0;
  const playfulComplaint = /我俩很不熟吗|我们很不熟吗|很不熟吗|你最近怎么不找我|你最近都不找我|都不找我|有啊/.test(otherText);
  const attentionSeeking = (otherConnectionIntentCount > 0 || otherEmotionalProbeCount > 0) && !otherLowEngagement;
  const repairNeeded = userTooCold || needsReassurance || hurtByColdReply || playfulComplaint;

  return {
    recent,
    other_initiated_count: otherInitiatedCount,
    me_short_reply_count: meShortReplyCount,
    other_question_count: otherQuestionCount,
    other_emotional_probe_count: otherEmotionalProbeCount,
    other_connection_intent_count: otherConnectionIntentCount,
    other_message_count: otherMessageCount,
    me_message_count: meMessageCount,
    other_low_engagement: otherLowEngagement,
    other_actively_seeks_connection: otherActivelySeeksConnection,
    user_too_cold: userTooCold,
    needs_reassurance: needsReassurance,
    hurt_by_cold_reply: hurtByColdReply,
    playful_complaint: playfulComplaint,
    attention_seeking: attentionSeeking,
    repair_needed: repairNeeded,
  };
}

function getConversationDirectionSceneId(signals = {}) {
  if (signals.hurt_by_cold_reply) return 'hurt_by_cold_reply / repair_needed';
  if (signals.needs_reassurance) return 'needs_reassurance / wants_connection';
  if (signals.playful_complaint) return 'playful_complaint / wants_connection';
  if (signals.user_too_cold) return 'user_too_cold / attention_seeking';
  if (signals.attention_seeking) return 'attention_seeking / wants_connection';
  return '';
}

function buildConversationDirectionScene(dialogue = []) {
  const signals = analyzeConversationDirection(dialogue);
  const scene = getConversationDirectionSceneId(signals);
  if (!scene) return null;
  return buildSyntheticScene({
    id: scene.replace(/[^a-z_]+/g, '_').replace(/^_+|_+$/g, '') || 'attention_seeking_wants_connection',
    scene,
    variant: signals.hurt_by_cold_reply
      ? '对方被冷回复伤到'
      : signals.needs_reassurance
      ? '对方以退为进求确认'
      : signals.playful_complaint
      ? '轻微抱怨关系不够近'
      : '对方主动找你聊天',
    stage: 'push_pull_flirting',
    triggers: ['在干嘛', '找你说话', '我俩很不熟吗', '你不理我', '我方短回复'],
    psychology: '对方不是冷淡，而是在主动找你聊天、索要关注或试探关系；真正的问题是我方前面回复偏冷，需要轻松补救。',
    goals: ['承认刚才回得冷', '接住对方的关系试探', '主动给一个话题', '轻微暧昧但不过油'],
    reply_strategy: ['先补救', '承认刚才回太冷', '接住“熟不熟/找你说话”', '主动给话题', '别再只回一个字'],
    sticker_strategy: ['道歉', '哄你', '我在呢', '贴贴', '委屈', '抱抱'],
    next_topics: ['先承认刚才自己回得太冷。', '用轻松语气接住对方的关系试探。', '主动给一个话题，不要继续只回一个字。', '可以带一点玩笑和暧昧，但不要太油。'],
  });
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
  if (/attention_seeking|wants_connection|playful_complaint|user_too_cold|needs_reassurance|hurt_by_cold_reply/.test(scene?.scene || '')) return 'push_pull_flirting';
  if (scene?.stage === 'relationship_confirmation') return 'relationship_confirmation';
  if (scene?.stage === 'offline_invitation') return 'offline_invitation';
  if (signals.opponentAffection || signals.opponentCheckedIn || scene?.stage === 'push_pull_flirting') return 'push_pull_flirting';
  if (scene?.stage === 'emotional_bonding' || signals.opponentEmotionDisclosure) return 'emotional_bonding';
  if (attractionScore >= 58 || coachAnalysis?.stage === 'daily_connection') return 'daily_connection';
  return coachAnalysis?.stage || LEGACY_STAGE_TO_RELATIONSHIP_STAGE[conversationStage] || 'ice_breaking';
}

function inferReplyRisk({ stage, scene, signals, attractionScore, investmentBalance, suggestStop = false, emotionalDisclosure = false }) {
  if (/attention_seeking|wants_connection|playful_complaint|user_too_cold|needs_reassurance|hurt_by_cold_reply/.test(scene?.scene || '')) return 'too_cold';
  if (suggestStop || (investmentBalance === 'user_investing_more' && attractionScore < 45) || signals.userNeedy) return 'too_needy';
  if ((scene?.stage === 'emotional_bonding' || emotionalDisclosure || signals.opponentEmotionDisclosure) && /身体不舒服|emo 动态|委屈|失眠|压力/.test(scene?.scene || '')) return 'too_cold';
  if ((stage === 'ice_breaking' || stage === 'daily_connection') && signals.userPushy) return 'too_pushy';
  return 'safe';
}

function getNextBestMove({ stage, scene, riskLevel }) {
  if (/attention_seeking|wants_connection|playful_complaint|user_too_cold|needs_reassurance|hurt_by_cold_reply/.test(scene?.scene || '')) return '先承认刚才回得太冷，轻松接住对方的关系试探，再主动给一个话题。';
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
  // Session memory is disabled; infer this compatibility object from current dialogue only.
  rawMemory = null;
  const signals = getRelationshipSignals(context.dialogue);
  const directionSignals = analyzeConversationDirection(context.dialogue);
  const hasDirectionRepair = Boolean(directionSignals.repair_needed || directionSignals.attention_seeking);
  const investmentBalance = hasDirectionRepair
    ? 'other_person_investing_more'
    : ['user_investing_more', 'balanced', 'other_person_investing_more'].includes(rawMemory?.investment_balance)
    ? rawMemory.investment_balance
    : inferInvestmentBalance(signals);
  const attractionScore = hasDirectionRepair
    ? Math.max(68, clampScore(Number.isFinite(Number(rawMemory?.attraction_score)) ? rawMemory.attraction_score : inferAttractionScore(signals, context)))
    : clampScore(Number.isFinite(Number(rawMemory?.attraction_score))
    ? rawMemory.attraction_score
    : inferAttractionScore(signals, context));
  const inferredStage = inferRelationshipStageFromMemory({
    coachAnalysis: context.coachAnalysis,
    scene: context.scene,
    signals,
    attractionScore,
    conversationStage: context.conversationStage,
  });
  const relationshipStage = hasDirectionRepair
    ? inferredStage
    : RELATIONSHIP_STAGES.has(rawMemory?.relationship_stage) ? rawMemory.relationship_stage : inferredStage;
  const intimacyScore = clampScore(Number.isFinite(Number(rawMemory?.intimacy_score))
    ? rawMemory.intimacy_score
    : inferIntimacyScore({ stage: relationshipStage, attractionScore, signals, emotionalDisclosure: context.emotionalDisclosure }));
  const initiator = hasDirectionRepair
    ? 'other_person'
    : ['user', 'other_person', 'balanced', 'unclear'].includes(rawMemory?.initiator)
    ? rawMemory.initiator
    : inferInitiator(signals);
  const riskLevel = hasDirectionRepair
    ? 'too_cold'
    : ['too_needy', 'too_cold', 'too_pushy', 'safe'].includes(rawMemory?.risk_level)
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
    next_best_move: hasDirectionRepair
      ? getNextBestMove({ stage: relationshipStage, scene: context.scene, riskLevel })
      : cleanText(rawMemory?.next_best_move, 140) || getNextBestMove({ stage: relationshipStage, scene: context.scene, riskLevel }),
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
  if (/attention_seeking|wants_connection|playful_complaint|user_too_cold|needs_reassurance|hurt_by_cold_reply/.test(scene?.scene || '')) {
    return {
      summary: '对方在主动找你聊天并索要关注，不是低兴趣；我方前面回复偏冷，下一步要轻松补救。',
      do: [
        '先承认刚才回得太冷。',
        '接住对方“熟不熟/不理我”的关系试探。',
        '主动给一个话题，让她有台阶继续聊。',
      ],
      avoid: [
        '避免把这轮误判成对方低兴趣。',
        '不要继续只回一个字。',
      ],
    };
  }
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
  const defaults = scene?.id === 'study_pressure_discomfort_001'
    ? ['第1步：先关心头痛和闷的状态。', '第2步：让她先放下第一题，出去透口气喝点水。', '第3步：十分钟后追踪头有没有没那么痛。', '第4步：等她缓过来，再陪她拆第一题卡在哪一步。', '第5步：后续轻轻问 midterm 那部分后来有没有顺一点。']
    : /attention_seeking|wants_connection|playful_complaint|user_too_cold|needs_reassurance|hurt_by_cold_reply/.test(scene?.scene || '')
    ? ['第1步：先承认刚才自己回得太冷。', '第2步：用轻松语气接住“熟不熟/不理我”的关系试探。', '第3步：主动给一个话题，不要继续只回一个字。', '第4步：可以带一点玩笑和暧昧，但不要太油。', '第5步：如果对方接住，再顺着她想聊的方向展开。']
    : scene?.scene === '身体不舒服'
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

  // 优先根据 sticker 自身 emotion 返回文字，不允许 intent keywords 覆盖
  const stickerPrimaryEmotion = normalizeCatalogEmotion(sticker?.emotion).primary;
  const stickerEmotionText = {
    thinking: '想想',
    goodnight: '晚安',
    sleepy: '晚安',
    greeting: '你好呀',
    laugh: '哈哈哈',
    happy: '开心',
    angry: '哼',
    awkward: '啊这',
    surprised: '欸？',
    apology: '对不起',
    encourage: '加油',
    thanks: '谢谢',
    wronged: '委屈',
    cry: '哭哭',
    sad: '哭哭',
    jealous: '吃醋了',
    jealous_cute: '小醋包',
    proud: '嗯哼',
    waiting: '等你回我',
    acting_cute: '抱抱我',
    tsundere: '才没有',
    heart_flutter: '心动了',
    question: '啊？',
    sulky: '不理你了',
  }[stickerPrimaryEmotion];
  if (stickerEmotionText) return stickerEmotionText;

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
  if (/peek|偷看/.test(text)) return '偷看一下';
  if (/waiting|等回复|等你/.test(text)) return '等你回我';
  if (/jealous|吃醋|查岗|小醋包/.test(text)) return '小醋包';
  if (/acting_cute|cute_acting|撒娇|蹭/.test(text)) return '抱抱我';
  if (/tsundere|嘴硬|才没有/.test(text)) return '才没有';
  if (/heart_flutter|心动|犯规/.test(text)) return '心动了';
  if (/morning|早安/.test(text)) return '早安呀';
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
  const directionSignals = analyzeConversationDirection(dialogue);
  if (directionSignals.repair_needed || directionSignals.attention_seeking) return 'repair_cold_reply';
  if (hasStudyPressureWithDiscomfort(dialogue)) return 'study_discomfort';
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
  const directionSignals = analyzeConversationDirection(dialogue);
  const flirtyContext = conversationStage === '暧昧升温'
    || conversationMode === '轻松暧昧'
    || flirtLevel === '轻微暧昧'
    || flirtLevel === '自然升温'
    || hasPlayfulFlirt(dialogue)
    || /想你|喜欢|嘴硬|亲亲|钓|犯规|讨厌你/.test(recentText);

  if (directionSignals.repair_needed || directionSignals.attention_seeking) return 'repair_cold_reply';
  if (suggestStop) return 'deescalate_gracefully';
  if (/讨厌你|不喜欢你|烦你|我生气了|气死我了|哼/.test(latestOpponentText) && flirtyContext) {
    return 'soften_flirty_conflict';
  }
  if (/晚安|睡了|睡觉|早点睡|先睡|好梦/.test(latestOpponentText)) return 'say_goodnight_back';
  if (/哈哈哈|哈哈|笑死|乐疯|嘿嘿|嘻嘻/.test(latestOpponentText)) return 'playful_continue';
  if (/谢谢|谢啦|谢了|感谢|辛苦你/.test(latestOpponentText)) return 'accept_thanks';
  if (/好累|太累|累死|我.{0,3}累|好困|太困|困死|撑不住/.test(latestOpponentText)) return 'comfort_support';
  if (/想你了|想你|想我|想见你|有点想/.test(latestOpponentText)) return 'affectionate_reply';

  if (hasStudyPressureWithDiscomfort(dialogue)) return 'study_pressure_support';
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
  if (Array.isArray(sticker.qa_flags) && sticker.qa_flags.length) {
    const hardFlags = ['species_mismatch', 'ghost_artifact', 'style_incompatible'];
    const hasHardFlag = sticker.qa_flags.some((flag) => hardFlags.some((prefix) => String(flag).includes(prefix)));
    score -= hasHardFlag ? 90 : Math.min(36, sticker.qa_flags.length * 12);
  }
  if (intent.context === 'study_discomfort' && /umbrella|伞|保暖|blanket|盖被子|取暖/.test(searchableText)) {
    score -= 36;
  }
  if (intent.context === 'study_discomfort' && /pat|摸头|hug|抱|hard|别硬撑|tired|休息|drink|喝水|cheer|加油|我在/.test(searchableText)) {
    score += 18;
  }
  if (intent.context === 'repair_cold_reply' && /apology|sorry|道歉|对不起|hug|抱|comfort|我在|贴贴|哄|委屈|shy|害羞|love|喜欢|flirt/.test(searchableText)) {
    score += 24;
  }
  if (intent.context === 'repair_cold_reply' && /safe_exit|bye|先撤|不打扰|冷淡|停止|umbrella|伞|保暖/.test(searchableText)) {
    score -= 42;
  }
  if (intent.reply_intent === 'say_goodnight_back') {
    const isGoodnightSticker = stickerEmotion.primary === 'goodnight'
      || stickerScenario.includes('good_night')
      || /晚安|好梦|睡觉|睡觉觉|早睡|别熬夜|good.?night|sleep/.test(searchableText);
    if (isGoodnightSticker) score += 34;
    if (stickerEmotion.primary === 'comfort' && !isGoodnightSticker) score -= 28;
    if (/早安|早上好|good_morning|morning/.test(searchableText)) score -= 36;
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
    scene: normalizeCatalogList(sticker.scene),
    intent: normalizeCatalogList(sticker.intent),
    intent_tags: normalizeCatalogList(sticker.intent),
    generic: sticker.generic === true,
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

// ── 语义场景匹配：先判断截图场景，再只在同场景库存里筛选 ──────────────
// 每个场景定义：触发模式（按对方最后一条/关键消息匹配）+ 允许的库存 scene 标签
const SEMANTIC_STICKER_SCENES = [
  { id: '晚安', patterns: /晚安|睡了|去睡|先睡|早点睡|睡觉|好梦|困死|要睡/, tags: ['晚安', '睡觉', '结束聊天'] },
  { id: '早安', patterns: /早安|早上好|刚醒|早呀|睡醒/, tags: ['早安', '打招呼'] },
  { id: '想念', patterns: /想你|想我|想见你|有点想/, tags: ['想念', '撒娇', '亲密', '暧昧'] },
  { id: '感谢', patterns: /谢谢|感谢|多谢|辛苦你/, tags: ['感谢'] },
  {
    id: '事实解释',
    patterns: /爱回收|回收|二手商|竞价|出价|谁高|谁价高|省时省心|一家家跑|包也收|挂上去|平台|流程|报价|验货|模式|我挺喜欢/,
    tags: ['日常接话', '倾听', '无语', '吐槽', '惊叹'],
    emotions: ['thinking', 'awkward', 'surprised', 'happy'],
    scenarios: ['agree', 'speechless', 'teasing'],
    allowGeneric: true,
    genericTextPattern: /^(原来如此|有点意思|真的吗|好家伙|这么巧|我信了)$/,
  },
  { id: '安慰', patterns: /难过|想哭|哭了|委屈|心情不好|emo|崩溃|难受|不舒服|生病|发烧|头疼|肚子疼|好累|太累|累死|心累|压力|焦虑|烦死|好烦|失眠|睡不着|被骂|骂我|挨骂|不想干|不想上班|想辞职|辞职|被开除|失业|加班|还在公司|十二点|通宵|考砸|挂科|分手|被删|把我删|删了我|拉黑|搬家|吵架|不想做|提不起劲|没动力|没劲|好丧|心情差|低落/, tags: ['安慰', '关心'] },
  { id: '求陪伴', patterns: /没人陪|没人理|陪陪我|陪我|想人陪|一个人好无聊|孤单|孤独|想找你说话/, tags: ['安慰', '亲密', '想念'], emotions: ['comfort', 'love', 'miss_you'], scenarios: ['comfort', 'hug', 'missing_you'] },
  { id: '鼓励', patterns: /考试|面试|紧张|怕考|加油|冲刺|ddl|要上场|比赛/, tags: ['鼓励', '夸夸', '关心'] },
  { id: '暧昧试探', patterns: /你是不是对谁都|会不会一直|我重要吗|喜欢你|喜欢我|你喜欢|心动|撩|暗示|暧昧|对你例外/, tags: ['暧昧', '心动', '想念', '亲密', '拉扯'] },
  { id: '吃醋哄人', patterns: /生气|气死|哼|吃醋|酸了|不理你|不理我了|你哄|解释|你变了|讨厌你|跟她聊|跟他聊|聊挺多|和她聊|和他聊|她是谁|他是谁|安全感/, tags: ['吃醋', '撒娇', '闹脾气', '安慰'] },
  { id: '大笑', patterns: /哈哈|笑死|太好笑|笑不活|乐死/, tags: ['大笑', '玩笑', '搞怪'] },
  { id: '庆祝', patterns: /拿A|拿 A|过了|通过|考上|成功|中了|offer|涨了|好消息|搞定/, tags: ['庆祝', '夸夸', '开心', '鼓励'] },
  { id: '道别出行', patterns: /拜拜|再见|先走了|出发|到家|路上|回家了|下班了/, tags: ['告别', '出行'] },
  { id: '撒娇卖萌', patterns: /求你|拜托|嘛$|人家|可爱|卖萌|奖励我/, tags: ['卖萌', '撒娇', '亲密'] },
  { id: '等待回应', patterns: /在吗|在不在|怎么不理|快回|等你回/, tags: ['等待', '想念', '日常'] },
  { id: '确认回应', patterns: /^(好的?|好呀|好啊|嗯+|哦+|行|可以|没问题|约好了|明天见|说定了|一言为定|收到)[~！!。.]?$|明天.{0,4}见|就这么定/, tags: ['确认', '回应', '告别'], allowGeneric: true },
  { id: '日常分享', patterns: /跟你说|和你说|你看|给你看|发现了|我发现|买了|去了趟|吃了个|看了个|拍的/, tags: ['开心', '夸夸', '大笑', '玩笑'] },
];
const SEMANTIC_STICKER_HIGH_MATCH_THRESHOLD = 0.8;
const SEMANTIC_STICKER_MIN_COUNT = 3;

function classifySemanticStickerScene(dialogue = []) {
  const latest = getLatestOpponentText(dialogue);
  const recent = recentDialogueText(dialogue, 6);
  for (const scene of SEMANTIC_STICKER_SCENES) {
    if (latest && scene.patterns.test(latest)) return scene;
  }
  for (const scene of SEMANTIC_STICKER_SCENES) {
    if (recent && scene.patterns.test(recent)) return scene;
  }
  return null;
}

function stickerMatchesSemanticScene(sticker, scene) {
  const stickerScenes = normalizeCatalogList(sticker.scene);
  const stickerIntent = normalizeCatalogList(sticker.intent);
  const stickerText = cleanText(sticker.text, 40);
  return stickerScenes.some((tag) => scene.tags.includes(tag))
    || stickerIntent.some((tag) => normalizeCatalogList(scene.intentTags).includes(tag))
    || normalizeCatalogList(scene.textMatches).some((text) => stickerText.includes(text));
}

function semanticSceneAllowsGenericSticker(sticker, scene) {
  if (sticker.generic !== true) return true;
  if (scene.allowGeneric !== true) return false;
  const stickerText = cleanText(sticker.text, 40);
  if (scene.genericTextPattern && !scene.genericTextPattern.test(stickerText)) return false;
  if (scene.blockedGenericTextPattern && scene.blockedGenericTextPattern.test(stickerText)) return false;
  return true;
}

function scoreSemanticSceneMatch(sticker, scene) {
  const stickerScenes = normalizeCatalogList(sticker.scene);
  const stickerIntent = normalizeCatalogList(sticker.intent);
  const stickerEmotion = normalizeCatalogEmotion(sticker.emotion);
  const stickerScenario = normalizeCatalogList(sticker.scenario);
  const stickerText = cleanText(sticker.text, 40);
  let score = 0;

  if (stickerScenes.some((tag) => scene.tags.includes(tag))) score += 0.6;
  if (stickerScenes[0] && scene.tags[0] && stickerScenes[0] === scene.tags[0]) score += 0.05;
  if (stickerIntent.some((tag) => normalizeCatalogList(scene.intentTags).includes(tag))) score += 0.15;
  if (scene.genericTextPattern?.test(stickerText)
    || normalizeCatalogList(scene.textMatches).some((text) => stickerText.includes(text))) {
    score += 0.2;
  }
  if (normalizeCatalogList(scene.emotions).includes(stickerEmotion.primary)) score += 0.1;
  if (stickerScenario.some((scenario) => normalizeCatalogList(scene.scenarios).includes(scenario))) score += 0.1;
  return Math.min(1, Math.round(score * 100) / 100);
}

function filterSemanticStickerCandidates(scored, count, semanticScene) {
  if (!semanticScene) {
    const top = Math.max(...scored.map((s) => s.score));
    return scored.filter((s) => s.score >= top * SEMANTIC_STICKER_HIGH_MATCH_THRESHOLD);
  }

  const sorted = scored.slice().sort(sortScoredStockStickers);
  const highMatches = sorted.filter((entry) => entry.semanticScore >= SEMANTIC_STICKER_HIGH_MATCH_THRESHOLD);
  const minCount = Math.min(SEMANTIC_STICKER_MIN_COUNT, count, sorted.length);
  if (highMatches.length >= minCount) return highMatches;

  const highIds = new Set(highMatches.map((entry) => entry.sticker.id));
  return [
    ...highMatches,
    ...sorted.filter((entry) => !highIds.has(entry.sticker.id)).slice(0, minCount - highMatches.length),
  ];
}

function recommendStockStickers(intent, count = STICKER_RECOMMENDATION_COUNT, dialogue = []) {
  if (!intent || !STOCK_STICKER_CATALOG.length) return [];
  const usable = STOCK_STICKER_CATALOG.filter((sticker) => sticker?.file && sticker.static !== false);
  const semanticScene = classifySemanticStickerScene(dialogue);

  let pool;
  if (semanticScene) {
    // 场景先行：只在同场景库存里选；泛用确认类表情只在确认/分享场景出现
    pool = usable.filter((sticker) => stickerMatchesSemanticScene(sticker, semanticScene)
      && semanticSceneAllowsGenericSticker(sticker, semanticScene));
  } else {
    // 无明确场景：只在"轻反应"表情族里选（夸夸/惊叹/接话/大笑/搞怪），
    // 排除泛用确认类和强场景类（晚安/吃醋/鼓励冲刺等需要明确语境的）
    const REACTION_TAGS = ['夸夸', '惊叹', '开心', '大笑', '玩笑', '搞怪', '无语', '吐槽', '日常接话', '倾听', '卖萌'];
    pool = usable.filter((sticker) => !sticker.generic
      && normalizeCatalogList(sticker.scene).some((tag) => REACTION_TAGS.includes(tag)));
  }
  if (!pool.length) return [];

  const scored = pool.map((sticker) => {
    const semanticScore = semanticScene ? scoreSemanticSceneMatch(sticker, semanticScene) : 0;
    return {
      sticker,
      score: scoreStockSticker(sticker, intent)
        + (semanticScene ? semanticScore * 60 : 0)
        + (semanticScene && normalizeCatalogList(sticker.scene)[0] === semanticScene.tags[0] ? 30 : 0),
      semanticScore,
    };
  });

  // 宁缺毋滥：场景命中即为高匹配；无场景时按相对分数截断，低相关不展示
  const candidates = filterSemanticStickerCandidates(scored, count, semanticScene);
  const picked = selectDiverseStockStickers(candidates, Math.min(count, candidates.length));
  return picked.map(({ sticker, score }, index) => toStockStickerSuggestion(sticker, score, intent, index));
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
  return recommendStockStickers(intent, STICKER_RECOMMENDATION_COUNT, dialogue);
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
      const confidence = ['high', 'medium', 'low'].includes(message?.confidence)
        ? message.confidence
        : 'low';
      return speaker ? { side, speaker, text, confidence } : null;
    }
    const confidence = ['high', 'medium', 'low'].includes(message?.confidence)
      ? message.confidence
      : 'high';
    return { side, speaker: side === 'left' ? '对方' : '我', text, confidence };
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

function hasEnvironmentDiscomfort(dialogue) {
  return dialogue.filter((message) => message.speaker === '对方').slice(-6).some((message) => ENVIRONMENT_DISCOMFORT_PATTERN.test(message.text));
}

function hasStudyPressureWithDiscomfort(dialogue) {
  const recentOpponentText = dialogue
    .filter((message) => message.speaker === '对方')
    .slice(-8)
    .map((message) => message.text)
    .join(' ');
  const hasSpecificStudyBlock = STUDY_STRESS_PATTERN.test(recentOpponentText)
    || /第一题|题目|做不出来|卡住|想太多|midterm|最近的东西/i.test(recentOpponentText);
  const hasBodyOrEnvironmentIssue = PHYSICAL_DISCOMFORT_PATTERN.test(recentOpponentText)
    || ENVIRONMENT_DISCOMFORT_PATTERN.test(recentOpponentText);
  return hasSpecificStudyBlock && hasBodyOrEnvironmentIssue;
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

function buildConversationDirectionSignals(signals = {}) {
  const items = [];
  if (signals.other_initiated_count > 0) items.push('对方主动找你聊天');
  if (signals.other_question_count > 0) items.push('对方连续发问开启话题');
  if (signals.other_connection_intent_count > 0) items.push('对方明确说想找你说话');
  if (signals.other_emotional_probe_count > 0) items.push('对方在试探关系和索要关注');
  if (signals.me_short_reply_count > 0) items.push('我方前面回复偏短偏冷');
  return items.length ? items.slice(0, 4) : ['对方有主动连接信号'];
}

function asksForPersonalDetail(text) {
  return /喜欢做什么|什么爱好|爱好吗|喜欢什么|学什么|什么专业|哪些课|哪门课|喜欢吃什么|吃什么|住哪里|哪里人|周末做什么|平时做什么/.test(text);
}

function hasRepeatedColdReplies(dialogue) {
  return hasOpponentLowEngagement(dialogue);
}

function needsReplyRefinement(advice) {
  if (!advice?.is_chat_screenshot || advice.needs_retry) return false;

  const replies = Array.isArray(advice.replies) ? advice.replies : [];
  const groundingReport = getReplyGroundingReport(advice);
  if (groundingReport.needs_repair) return true;
  if (advice.suggest_stop) return false;
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
  const studyPressureWithDiscomfort = hasStudyPressureWithDiscomfort(advice.dialogue || []);
  const mishandlesDisclosure = (advice.conversation_mode === '情绪倾诉' || hasRecentEmotionalDisclosure(advice.dialogue || []))
    && replies.some((reply) => {
      if (studyPressureWithDiscomfort) {
        return /早点睡|早点休息|多喝.{0,2}热水|身体.{0,2}重要|照顾好自己|有需要.{0,6}告诉我|调整好状态|宝宝|乖|想你|抱抱|我照顾你|你现在感觉还好吗|有没有哪里特别不舒服/.test(reply.text)
          && !/第一题|题|midterm|最近的东西|头痛|头疼|闷|透口气|出去走|休息十分钟|先放一下/.test(reply.text);
      }
      return /早点睡|早点休息|先休息一下|优先休息|不要熬夜|别熬夜|多喝.{0,2}热水|身体.{0,2}重要|照顾好自己|别太勉强|别逼自己|放松一下|别太焦虑|太辛苦|也太难受|有需要.{0,6}告诉我|调整好状态|宝宝|乖|想你|抱抱|我照顾你/.test(reply.text);
    });
  const recentText = recentDialogueText(advice.dialogue || []);
  const directionSignals = analyzeConversationDirection(advice.dialogue || []);
  const directionContext = directionSignals.repair_needed || directionSignals.attention_seeking;
  const badSpaceAdvice = directionContext
    && [
      ...replies.map((reply) => reply.text),
      advice.attitude_desc || '',
      advice.reply_strategy || '',
      advice.chat_guide?.current_move || '',
      advice.chat_guide?.avoid || '',
      ...(advice.chat_guide?.next_steps || []),
      ...(advice.next_topics || []),
    ].some((item) => BAD_SPACE_ADVICE_PATTERN.test(item));
  const directionLacksRepair = directionContext
    && !replies.some((reply) => /回太冷|补回来|我错了|不该|认真|不熟|找你说话|不打扰|不是不想理|陪你聊|扣分/.test(reply.text));
  const flirtyConflict = /讨厌你|不喜欢你|烦你|我生气了|气死我了|哼/.test(latestOpponentText);
  const flirtyConflictLacksSoften = flirtyConflict
    && !replies.some((reply) => /认错|哄|别气|站好|骂|讨厌得|回来|补偿|让你骂|哄回来/.test(reply.text));
  const tiredHomeworkContext = /困死|好困|困了|不想写|作业|没写完/.test(recentText);
  const tiredHomeworkLacksAction = tiredHomeworkContext
    && !replies.some((reply) => /眯十分钟|先睡|先放|拆出来|最急|硬撑|休息.{0,6}再写|陪你.{0,8}拆/.test(reply.text));
  const explicitDimensionReplies = replies.filter((reply) => reply?._style_dimension_inferred !== true);
  const uniqueDimensions = new Set(
    explicitDimensionReplies.map((reply) => reply.style_dimension).filter(Boolean),
  );
  const hasPoorDiversity = replies.length >= 3 && explicitDimensionReplies.length >= 3 && uniqueDimensions.size < 3;
  // 检测书面语/写作文风格
  const hasEssayStyle = replies.some((reply) => {
    const text = reply.text || '';
    // 句号结尾是书面语信号（微信里几乎不用句号）
    const endsWithPeriod = /[。.]$/.test(text.trim()) || text.split('\n').some((line) => /[。.]$/.test(line.trim()));
    // 旁白式分析语句
    const hasNarration = /看来|可见|由此|不难看出|这说明|这表明|对方可能|她可能是|他可能是|可能是因为|应该是因为|估计是因为/.test(text);
    return endsWithPeriod || hasNarration;
  });

  return hasTooFewReplies
    || questionCount > 1
    || hasTemplateLanguage
    || inventsUnsupportedColdEvidence
    || hasReversedComfortPerspective
    || hasOverlongReplies
    || hasFlatPlayfulReplies
    || evadesDirectQuestion
    || inventsPersonalDetails
    || badSpaceAdvice
    || directionLacksRepair
    || mishandlesDisclosure
    || flirtyConflictLacksSoften
    || tiredHomeworkLacksAction
    || hasPoorDiversity
    || hasEssayStyle;
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
  const dialogue = advice.dialogue || [];
  const groundingReport = getReplyGroundingReport(advice);
  const directionSignals = analyzeConversationDirection(dialogue);
  if (directionSignals.repair_needed || directionSignals.attention_seeking || isDirectionRepairScene(advice.analysis?.scene || '')) {
    const guideAlignedReplies = alignRepliesWithGuide({
      replies: Array.isArray(advice.replies) ? advice.replies : [],
      dialogue,
      scene: advice.analysis || {},
      hasDirectionRepair: directionSignals.repair_needed || directionSignals.attention_seeking,
    });
    if (guideAlignedReplies !== advice.replies) {
      return {
        ...advice,
        replies: guideAlignedReplies,
      };
    }
  }

  if (groundingReport.needs_repair) {
    const fallbackReplies = buildGroundedFallbackReplies(dialogue, advice.analysis || {});
    if (fallbackReplies.length) {
      return {
        ...advice,
        replies: fallbackReplies.map((messages) => makeReplyCandidate(messages)).slice(0, 5),
      };
    }
  }

  if (
    REFLECTIVE_PROBE_PATTERN.test(latestOpponentText)
    && Array.isArray(advice.replies)
    && advice.replies.length >= 3
    && !advice.replies.some(isGenericReplyCandidate)
  ) {
    // 情感试探提问（你为什么喜欢我/我重要吗等）：模型按 Reflective Intelligence 生成的
    // 思考型回复是有效输出，不要被下方的拉扯/撤回等兜底分支整组替换。
    return advice;
  }

  if (hasStudyPressureWithDiscomfort(dialogue)) {
    return {
      ...advice,
      replies: [
        makeReplyCandidate(['先别逼自己了', '这题卡住真的会很烦', '你先出去透口气']),
        makeReplyCandidate(['不是你不行', '是脑子已经太累了', '先把第一题放一下']),
        makeReplyCandidate(['里面闷的话先出去走一下', '题目可以晚点再想', '你现在先把自己缓过来最重要']),
        makeReplyCandidate(['头痛就别一直硬盯着题了', '先休息十分钟', '等没那么痛了再回来做']),
        makeReplyCandidate(['midterm 的东西先不用全塞进脑子里', '我们先把最近的那部分捋清楚', '我陪你一点点拆']),
      ],
    };
  }

  if (/讨厌你|不喜欢你|烦你|我生气了|气死我了|哼/.test(latestOpponentText)) {
    return {
      ...advice,
      replies: [
        makeReplyCandidate(['那我先认错半秒', '再认真哄你']),
        makeReplyCandidate(['你讨厌得这么认真', '我都有点想笑了']),
        makeReplyCandidate(['好好好', '我先站好让你骂两句']),
        makeReplyCandidate(['那我今天的任务', '就是把你哄回来一点']),
      ],
    };
  }

  if (/困死|好困|困了|不想写|作业|没写完/.test(recentDialogueText(dialogue))) {
    return {
      ...advice,
      replies: [
        makeReplyCandidate(['先别硬撑', '眯十分钟再写会快很多']),
        makeReplyCandidate(['作业先放一下', '你现在困到硬写也很折磨']),
        makeReplyCandidate(['我陪你把最急的那一点拆出来', '先别一口气想完全部']),
        makeReplyCandidate(['先把眼睛从题上挪开一下', '缓过来再写，不然只会更烦']),
      ],
    };
  }

  if (hasRecentEmotionalDisclosure(dialogue)) {
    return {
      ...advice,
      replies: hasPhysicalDiscomfort(dialogue)
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

  if (
    !REFLECTIVE_PROBE_PATTERN.test(latestOpponentText)
    && /为什么|怎么(?:知道|确定|就确定|看出来)|如何|凭什么|哪里猜错|你不是.{0,12}吗/.test(latestOpponentText)
  ) {
    return {
      ...advice,
      replies: [
        makeReplyCandidate(['我瞎猜的，那我撤回'], 'DIRECT_ANSWER'),
        makeReplyCandidate(['那我判断错了', '你还是愿意理我的'], 'PLAYFUL'),
        makeReplyCandidate(['好吧，是我下结论太早了'], 'SINCERE'),
        makeReplyCandidate(['我先收回刚刚那句', '是我想多了'], 'WARM_CARING'),
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

async function logUsage({
  req,
  advice,
  imageParts,
  metadata = {},
  model = '',
  degraded = false,
  status = '',
  errorMessage = '',
  elapsedMs = 0,
}) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase usage logging skipped: missing SUPABASE_URL or service role key.', {
      has_supabase_url: Boolean(supabaseUrl),
      has_supabase_key: Boolean(supabaseKey),
    });
    return;
  }
  const supabaseHost = getUrlHost(supabaseUrl);
  if (!supabaseHost) {
    console.warn('Supabase usage logging skipped: invalid SUPABASE_URL.', {
      has_supabase_url: Boolean(supabaseUrl),
      supabase_url_length: String(supabaseUrl).length,
      has_supabase_key: Boolean(supabaseKey),
    });
    return;
  }

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
    const usageStatus = status || (degraded || advice?.needs_retry || advice?.json_parse_failed ? 'failed' : 'success');
    const usageErrorMessage = cleanText(errorMessage || advice?.analysis_result_error || '', 500);
    const analysis = advice?.analysis || {};
    const relationshipStage = analysis.stage
      || advice?.relationship_stage
      || advice?.relationship_memory_engine?.relationship_stage
      || '';
    const scene = analysis.scene || '';
    const replyIntent = analysis.reply_intent || advice?.sticker_match_intent?.reply_intent || '';
    const stickerIds = extractUsageStickerIds(advice);
    const extractedText = buildDebugExtractedText(advice);

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
        const body = await uploadRes.text().catch(() => '');
        console.warn(`Supabase screenshot upload failed with ${uploadRes.status}: ${cleanText(body, 180)}`);
      }
    }

    const usagePayload = {
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
      target_person_label: metadata.target_person_label || '',
      background_text: metadata.background_text || '',
      browser_language: metadata.browser_language || '',
      client_timezone: metadata.client_timezone || '',
      image_count: imageParts.length,
      storage_paths: imageRecords.map((image) => image.path),
      image_urls: imageRecords.map((image) => image.url),
      images: imageRecords,
      model,
      degraded,
      status: usageStatus,
      error_message: usageErrorMessage,
      elapsed_ms: Number.isFinite(Number(elapsedMs)) ? Number(elapsedMs) : null,
      extracted_text: extractedText,
      scene,
      reply_intent: replyIntent,
      sticker_ids: stickerIds,
      attitude_label: advice.attitude_label || '',
      attitude_desc: advice.attitude_desc || '',
      interest_score: Number.isFinite(Number(advice.interest_score)) ? Number(advice.interest_score) : null,
      interest_level: advice.interest_level || '',
      conversation_mode: advice.conversation_mode || '',
      conversation_stage: advice.conversation_stage || '',
      relationship_stage: relationshipStage,
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
        log_schema_version: 2,
      },
    };

    const logRes = await fetch(`${supabaseUrl}/rest/v1/usage_logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(usagePayload),
    });
    if (!logRes.ok) {
      const body = await logRes.text().catch(() => '');
      console.warn(`Supabase usage log insert failed with ${logRes.status}: ${cleanText(body, 240)}`);
      await retryLegacyUsageLog({
        supabaseUrl,
        supabaseKey,
        usagePayload,
        failureSummary: cleanText(body, 240),
      });
    }
  } catch (err) {
    console.warn('logUsage failed:', {
      message: cleanText(err?.message || '', 240),
      cause: cleanText(err?.cause?.message || '', 240),
      code: cleanText(err?.code || err?.cause?.code || '', 80),
      supabase_host: supabaseHost,
      has_supabase_url: Boolean(supabaseUrl),
      supabase_url_length: String(supabaseUrl).length,
      has_supabase_key: Boolean(supabaseKey),
    });
  }
}

function extractUsageStickerIds(advice) {
  const values = [
    ...(Array.isArray(advice?.stickers) ? advice.stickers : []),
    ...(Array.isArray(advice?.sticker_suggestions) ? advice.sticker_suggestions : []),
  ];
  return values
    .map((item) => cleanText(item?.id || item?.file || item?.text, 120))
    .filter(Boolean)
    .slice(0, 12);
}

async function retryLegacyUsageLog({ supabaseUrl, supabaseKey, usagePayload, failureSummary }) {
  const {
    status,
    error_message,
    elapsed_ms,
    extracted_text,
    scene,
    reply_intent,
    sticker_ids,
    background_text,
    ...legacyPayload
  } = usagePayload;
  const requestMetadata = {
    ...(legacyPayload.request_metadata || {}),
    background_text,
    status,
    error_message,
    elapsed_ms,
    extracted_text,
    scene,
    reply_intent,
    sticker_ids,
    log_schema_version: 2,
    full_payload_insert_failed: true,
    full_payload_insert_error: failureSummary,
  };
  const retryPayload = {
    ...legacyPayload,
    analysis_result: {
      ...(legacyPayload.analysis_result || {}),
      usage_log_status: status,
      usage_log_error_message: error_message,
      usage_log_elapsed_ms: elapsed_ms,
      usage_log_scene: scene,
      usage_log_reply_intent: reply_intent,
      usage_log_sticker_ids: sticker_ids,
    },
    request_metadata: requestMetadata,
  };
  const retryRes = await fetch(`${supabaseUrl}/rest/v1/usage_logs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
      'apikey': supabaseKey,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(retryPayload),
  });
  if (!retryRes.ok) {
    const body = await retryRes.text().catch(() => '');
    console.warn(`Supabase legacy usage log retry failed with ${retryRes.status}: ${cleanText(body, 240)}`);
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

function getUrlHost(value) {
  try {
    return new URL(value).host;
  } catch {
    return '';
  }
}

function buildStoragePath({ visitorId, index, ext }) {
  const day = new Date().toISOString().slice(0, 10);
  const safeVisitorId = visitorId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'unknown';
  return `screenshots/${day}/${safeVisitorId}-${Date.now()}-${index}.${ext}`;
}

export { CHAT_ADVICE_SCHEMA, CHAT_SCENE_LIBRARY, EXTRACTION_IMAGE_DETAIL, EXTRACTION_MAX_COMPLETION_TOKENS, EXTRACTION_SCHEMA, EXTRACTION_SYSTEM_PROMPT, GENERIC_REPLY_TEMPLATE_PATTERN, IMAGE_READING_RULES, INTENT_DETECTION_SCHEMA, INTENT_DETECTION_SYSTEM_PROMPT, INTENT_MAX_COMPLETION_TOKENS, INTENT_STRATEGY_MAP, MODELS, PRIMARY_IMAGE_DETAIL, PRIMARY_MAX_COMPLETION_TOKENS, PRIMARY_OPENAI_TIMEOUT_MS, REFLECTIVE_INTELLIGENCE_NOTE, REPLY_COACH_SYSTEM_PROMPT, REPLY_PERSPECTIVE_EXAMPLES, REPLY_REFINEMENT_SCHEMA, REFINEMENT_MAX_COMPLETION_TOKENS, STYLE_DIMENSION_NOTE, analyzeConversationDirection, buildActiveCuriosityGuide, buildEmotionalDisclosureGuide, buildFreeTierFallbackAdvice, buildGroupChatAdvice, buildGroundedFallbackReplies, buildIntentPrefix, buildRegeneratePrefix, buildReplyRefinementPrompt, buildStageChatGuide, buildStickerMatchIntent, buildUserProfilePrefix, classifySemanticStickerScene, detectConversationIntent, detectScene, extractConcreteFacts, extractDialogueFromImages, extractFirstJsonObject, getReplyGroundingReport, getRequestParts, getStickerContext, hasActiveCuriosity, hasHappyEmotion, hasRecentEmotionalDisclosure, hasRepeatedColdReplies, hasStudyStress, inferConversationStage, isRetryableModelError, isVerifiedChatScreenshot, logUsage, mergeRefinedReplies, needsReplyRefinement, normalizeChatGuide, normalizeClientMetadata, normalizeConversationMode, normalizeConversationStage, normalizeDialogue, normalizeChatEvidence, normalizeReplyCandidate, normalizeStickerSuggestions, normalizeUserProfile, parseAdvice, recommendStockStickers, repairReplyCandidates, requestOpenAIAdvice, requestOpenAIReplyRefinement, safeJsonParse, scoreStockSticker };
