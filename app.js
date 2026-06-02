/* yuchaolove - app.js */

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILE_COUNT = 6;
const MAX_TOTAL_IMAGE_BASE64_LENGTH = 3_800_000;
const ALLOWED_FILE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

let uploadedImages = [];

document.getElementById('fileInput').addEventListener('change', handleFileUpload);

async function handleFileUpload(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;

  const validationMessage = validateFiles(files, uploadedImages.length);
  if (validationMessage) {
    showToast(validationMessage);
    event.target.value = '';
    return;
  }

  try {
    setSubmitState(true, '正在处理截图...');
    const addedImages = await optimizeUploads(files, uploadedImages.length + files.length);
    const combinedImages = [...uploadedImages, ...addedImages];
    if (getTotalBase64Length(combinedImages) > MAX_TOTAL_IMAGE_BASE64_LENGTH) {
      throw new Error('截图总量较大，请减少张数或裁剪后再上传');
    }
    uploadedImages = combinedImages;
    renderPreviewGallery();
    document.getElementById('previewBox').style.display = 'flex';
    document.getElementById('uploadZone').style.display = 'none';
    document.getElementById('results').style.display = 'none';
    event.target.value = '';
    setSubmitState(false, '开始分析');
  } catch (error) {
    event.target.value = '';
    setSubmitState(uploadedImages.length === 0, uploadedImages.length ? '开始分析' : '上传截图后开始分析');
    showToast(error.message || '截图处理失败，请重试');
  }
}

function renderPreviewGallery() {
  const gallery = document.getElementById('previewGallery');
  gallery.replaceChildren();
  uploadedImages.forEach((image, index) => {
    const item = document.createElement('div');
    item.className = 'preview-thumb';

    const thumbnail = document.createElement('img');
    thumbnail.src = image.previewUrl;
    thumbnail.alt = `截图 ${index + 1}`;

    const order = document.createElement('span');
    order.textContent = `${index + 1}`;

    item.append(thumbnail, order);
    gallery.appendChild(item);
  });

  document.getElementById('previewName').textContent =
    `${uploadedImages.length} 张截图 · 将按左侧顺序分析`;
  document.getElementById('previewSize').textContent =
    `处理后约 ${(getTotalBase64Length(uploadedImages) * 0.75 / 1024).toFixed(0)} KB`;
  document.getElementById('addScreenshotBtn').hidden = uploadedImages.length >= MAX_FILE_COUNT;
}

function openFilePicker() {
  document.getElementById('fileInput').click();
}

function resetUpload() {
  uploadedImages = [];
  document.getElementById('previewGallery').replaceChildren();
  document.getElementById('uploadZone').style.display = 'block';
  document.getElementById('previewBox').style.display = 'none';
  document.getElementById('fileInput').value = '';
  document.getElementById('results').style.display = 'none';
  setSubmitState(true, '上传截图后开始分析');
}

function scrollToApp() {
  document.getElementById('app-section').scrollIntoView({ behavior: 'smooth' });
}

async function analyze() {
  if (!uploadedImages.length) return;

  setSubmitState(true, '分析中...');
  document.getElementById('loadingState').style.display = 'block';
  document.getElementById('results').style.display = 'none';

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{
          role: 'user',
          content: [
            ...uploadedImages.map((image) => ({
              type: 'image',
              source: {
                type: 'base64',
                media_type: image.mediaType,
                data: image.base64,
              },
            })),
            { type: 'text', text: buildPrompt(uploadedImages.length) },
          ],
        }],
      }),
    });

    const data = await response.json();
    if (!response.ok || data.error) {
      throw new Error(data.error || '分析服务暂时不可用');
    }

    const rawText = data.content?.map((part) => part.text || '').join('') || '';
    const parsed = parseAdvice(rawText);
    renderResults(parsed);
  } catch (error) {
    console.error('Analyze failed:', error);
    renderRetryNotice('分析服务暂时繁忙，请稍后再试。你的截图没有问题。');
  } finally {
    document.getElementById('loadingState').style.display = 'none';
    setSubmitState(false, '重新分析');
  }
}

function buildPrompt(imageCount) {
  const context = document.getElementById('contextInput').value.trim();

  return `你是一位克制、真实、擅长理解聊天上下文的回复顾问。

请完整阅读上传的 ${imageCount} 张聊天截图。截图已按照聊天时间从早到晚排列；如果有重叠消息，合并时去重。

【先判断图片类型】
- 先判断上传内容中是否至少有一张真正的聊天截图：应能看到聊天气泡、对话列表或清晰的双方消息。
- 只有明确看到聊天气泡、聊天界面或成组的消息块，才可以将 is_chat_screenshot 设为 true。普通文字排版不是聊天记录。
- 支持微信、短信、iMessage、WhatsApp、Instagram 私信、Messenger、Telegram、LINE、QQ、Discord、Slack 私信等常见聊天软件。不要依赖某个 App 的名称、颜色或主题。
- 浅色和深色模式都可能是聊天截图。截图可以被裁剪，也可以包含时间、昵称、头像、系统提示、已读状态、表情反应或不完整的顶部消息。
- 如果画面中有多个左右对齐的消息气泡，无论气泡是绿色、蓝色、灰色、紫色还是其他颜色，都应当识别为聊天截图并提取可见对话。
- Discord、Slack 私信等界面可能使用单列消息流而不是左右气泡。如果画面明确显示发送者名称、头像归属或其他可见身份标记，也应当识别为聊天截图。
- 作业题目、PDF、网页、代码、笔记、文档、邮件正文、表格、风景、食物和普通照片都不是聊天截图，即使画面中有很多文字。
- 如果所有图片都不是聊天截图，将 is_chat_screenshot 设为 false，dialogue 和 replies 返回空数组。用 non_chat_reply 写一句轻松、友好的提示，告诉用户换一张聊天截图。可以结合画面做一点幽默，但不要冒犯，也不要编造感情分析。
- 如果多张图片中只有部分是聊天截图，将 is_chat_screenshot 设为 true，只分析有效聊天截图，忽略无关图片。

【必须先正确区分双方】
- 对常见左右气泡聊天界面，画面左边的气泡是“对方”发出的，画面右边的气泡是“我”发出的。这是默认硬规则，除非截图有非常明确的反向标识。
- 对单列消息流界面，仅在画面明确显示发送者名称、头像归属或身份标记时判断双方。此时 side 填写 feed，speaker 根据可见身份标记填写“对方”或“我”。无法可靠区分时，将 needs_retry 设为 true，不要猜。
- 不要把右侧“我”提出的问题误认为对方的问题，也不要替对方回答我自己刚问的问题。
- 忽略时间、日期、头像、昵称、系统提示、拍一拍等非消息内容。
- 先在内部按从上到下、从旧到新还原对话，再结合整段聊天判断。不要只围绕最后一句生成模板。
- 判断对方态度时，只使用“对方”发出的内容作为主要证据；“我”的内容只用于理解上下文。
- 先输出 dialogue。左右气泡界面的 side 只能根据气泡几何位置填写为 left 或 right，不要根据句子内容猜发送者。speaker 必须严格使用固定映射：left = 对方，right = 我。只有单列消息流才使用 side = feed。
- 不要把“左侧气泡 = 对方发出”“右侧气泡 = 我发出”或类似的辅助说明当成真实聊天消息。

【任务一：判断态度】
- 不要把“有回复”直接等同于“有好感”。先判断对方是在礼貌回应、愿意接话、轻微好感，还是主动升温。
- 重点观察对方是否主动提问、连续发多条、自然延伸话题、接梗、使用表情包、回看前文、关心我、轻微调侃我。这些才是更有价值的回球信号。
- 回复间隔只能作为弱信号。不要因为一次晚回就断定冷淡，也不要因为回复快就擅自认定喜欢。
- 用 interest_score 给出 0 到 100 的互动意愿分数；用 interest_level 选择：低意愿、礼貌回应、愿意接话、轻微好感、主动升温。
- 用 interest_signals 写出最多 4 个来自截图的具体依据，不要写空泛结论。
- 给出 8 字以内的态度标签，用 100 字以内说明判断依据和下一步节奏。
- 用 reply_strategy 写一句明确策略：现在应该轻松接话、顺着梗升温、留一个回球点，还是先停一下。
- 用 flirt_level 选择当前暧昧上限：先别暧昧、轻松接话、轻微暧昧、自然升温。
- 用 conversation_summary 简洁复述最近的关键对话，明确标注“对方：”和“我：”，让我可以确认你没有读反左右两边。
- 如果对方连续敷衍、没有反问、明显不想继续聊，将 suggest_stop 设为 true。
- 如果截图文字无法可靠读取，将 needs_retry 设为 true，不要猜测，不要编造聊天内容。

【任务二：生成 3 到 5 条可直接发送的回复】
- 不要让用户预先选择回复风格。先根据整段聊天判断对方真实态度，再自动决定回复尺度。
- 必须接住截图中对方最近的反应，同时参考整段聊天里的共同梗、昵称、细节和情绪。
- 候选回复永远是“我”准备发给“对方”的话。先确认对方最后一句的真实方向，不要把谁关心谁、谁哄谁、谁问谁理解反。
- 像真人聊天，通常控制在 8 到 28 个字。口语化、有一点个人感，不写礼貌客服话术。
- 每条只放一个重点，给对方留一个轻松回球点。不要连续追问，不要一次问两个问题。
- 所有候选中最多一条使用问号。至少两条是自然陈述。不要把对方原句重复一遍再反问。
- 如果对方处于“礼貌回应”，不强行暧昧；如果是“愿意接话”，可以轻微暧昧；如果已经“主动升温”，可以自然回球，但不要突然告白。
- flirt_level 是暧昧上限，不是必须完成的任务。对方只是在认真提问、澄清或解释时，先正常回答，不要为了暧昧而绕开问题。
- 如果对方最后一句在问“为什么”“怎么知道”“怎么确定”或类似澄清问题，至少两条候选要真正回应问题。不要全部改成调情、卖关子或反问。
- 轻松聊天里的追问，不要写成长解释、情感分析或辩解。优先简短承认误判，再自然接住对方。不要编造截图里没有出现的“回复慢”“不积极”等依据。
- 避免模板句：少用“听起来”“感觉你”“那你平时”“有需要告诉我”“调整好状态”“看来”。
- 避免油腻句：不要凭空说想她、梦到她、心动、命中注定、只对她例外，也不要突然叫宝宝。
- 不要给每条回复套风格标签，也不要额外解释回复。
- 如果 suggest_stop 为 true，不要继续采访式追问，也不要硬开新话题。推荐体面收尾、暂停发送或轻松退场。
- 如果 needs_retry 为 true，replies 返回空数组。

${context ? `【补充背景】${context}` : ''}

只返回 JSON，不要返回 Markdown：
{
  "attitude_label": "态度标签",
  "attitude_desc": "具体分析和策略建议",
  "interest_score": 68,
  "interest_level": "愿意接话",
  "interest_signals": ["会顺着共同梗继续聊", "主动回问"],
  "reply_strategy": "顺着她最后一句轻松回球，留一点自然暧昧。",
  "flirt_level": "轻微暧昧",
  "is_chat_screenshot": true,
  "non_chat_reply": "",
  "chat_evidence": {
    "image_kind": "chat",
    "has_message_bubbles": true,
    "has_chat_ui": true,
    "has_two_sided_layout": true
  },
  "conversation_summary": "对方：...；我：...；对方：...",
  "dialogue": [
    {"side": "left", "speaker": "对方", "text": "左侧气泡内容"},
    {"side": "right", "speaker": "我", "text": "右侧气泡内容"},
    {"side": "feed", "speaker": "对方", "text": "单列消息流内容，仅在界面明确标记发送者时使用"}
  ],
  "suggest_stop": false,
  "needs_retry": false,
  "replies": [
    {"text": "回复内容1"},
    {"text": "回复内容2"},
    {"text": "回复内容3"}
  ]
}`;
}

function parseAdvice(rawText) {
  const data = JSON.parse(extractFirstJsonObject(rawText));
  const dialogue = normalizeDialogue(data.dialogue);
  const chatEvidence = normalizeChatEvidence(data.chat_evidence);
  const isChatScreenshot = isVerifiedChatScreenshot(data, dialogue, chatEvidence);
  const verifiedDialogue = isChatScreenshot ? dialogue : [];
  return {
    attitude_label: isChatScreenshot ? cleanText(data.attitude_label, 12) || '态度待判断' : '这不是聊天截图',
    attitude_desc:
      (isChatScreenshot ? cleanText(data.attitude_desc, 180) : '')
      || (isChatScreenshot ? '请结合对方后续行动继续观察。' : '我还没看到可以分析的聊天内容。'),
    interest_score: isChatScreenshot ? clampScore(data.interest_score) : 0,
    interest_level: isChatScreenshot ? normalizeInterestLevel(data.interest_level) : '低意愿',
    interest_signals: isChatScreenshot ? normalizeSignals(data.interest_signals) : [],
    reply_strategy: isChatScreenshot ? cleanText(data.reply_strategy, 100) : '',
    flirt_level: isChatScreenshot ? normalizeFlirtLevel(data.flirt_level) : '先别暧昧',
    is_chat_screenshot: isChatScreenshot,
    non_chat_reply: cleanText(data.non_chat_reply, 120) || getDefaultNonChatReply(),
    chat_evidence: chatEvidence,
    conversation_summary: isChatScreenshot
      ? buildDialogueSummary(verifiedDialogue) || cleanText(data.conversation_summary, 260)
      : '',
    dialogue: verifiedDialogue,
    suggest_stop: isChatScreenshot && (Boolean(data.suggest_stop) || hasRepeatedColdReplies(verifiedDialogue)),
    needs_retry: isChatScreenshot && Boolean(data.needs_retry),
    degraded: Boolean(data.degraded),
    replies: isChatScreenshot && Array.isArray(data.replies)
      ? data.replies
          .map((reply) => ({
            text: cleanText(reply?.text, 80),
          }))
          .filter((reply) => reply.text)
          .slice(0, 5)
      : [],
  };
}

function extractFirstJsonObject(rawText) {
  const cleaned = rawText.replace(/```json|```/gi, '').trim();
  const start = cleaned.indexOf('{');
  if (start < 0) throw new Error('返回内容格式不正确');

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

  throw new Error('返回内容格式不正确');
}

function renderResults(data) {
  document.getElementById('attitudeBadge').textContent = data.attitude_label;
  document.getElementById('attitudeDesc').textContent = data.attitude_desc;
  document.getElementById('interestLevel').textContent = `${data.interest_level} · ${data.interest_score}`;
  document.getElementById('replyStrategy').textContent = data.reply_strategy || '结合对方后续反应调整节奏';
  document.getElementById('flirtLevel').textContent = data.flirt_level;
  const insights = document.getElementById('insightGrid');
  insights.classList.toggle('show', Boolean(data.is_chat_screenshot && !data.needs_retry));
  const signals = document.getElementById('interestSignals');
  signals.replaceChildren();
  data.interest_signals.forEach((signal) => {
    const item = document.createElement('span');
    item.textContent = signal;
    signals.appendChild(item);
  });
  signals.classList.toggle('show', Boolean(data.is_chat_screenshot && data.interest_signals.length));
  const summary = document.getElementById('conversationSummary');
  summary.textContent = data.conversation_summary || '';
  summary.classList.toggle('show', Boolean(data.conversation_summary));

  const list = document.getElementById('replyList');
  list.replaceChildren();

  if (!data.is_chat_screenshot) {
    list.appendChild(createSystemCard('识图小提示', data.non_chat_reply || getDefaultNonChatReply(), '#c96b52'));
  } else if (data.suggest_stop) {
    list.appendChild(createSystemCard('止损提醒', '舔狗照照镜子：对方连续短回，先别硬聊了。停一下，等对方愿意主动再说。', '#e57373'));
  }

  if (!data.is_chat_screenshot) {
    list.appendChild(createSystemCard('下一步', '换一张能看到左右聊天气泡的截图，我再认真帮你读空气。', '#e8927c'));
  } else if (data.needs_retry || data.degraded) {
    list.appendChild(createSystemCard('请稍后重试', '免费分析通道暂时繁忙，或者截图不够清晰。本次没有猜测内容，请稍后重新分析。', '#c96b52'));
  } else if (data.suggest_stop) {
    list.appendChild(createSystemCard('建议动作', '先不要继续发消息。看对方之后会不会主动回来，比继续找话题更有参考价值。', '#c96b52'));
  } else {
    data.replies.forEach((reply, index) => {
      list.appendChild(createReplyCard(reply, index));
    });
  }

  document.getElementById('results').style.display = 'block';
  document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderRetryNotice(message) {
  renderResults({
    attitude_label: '暂时无法分析',
    attitude_desc: message,
    interest_score: 0,
    interest_level: '低意愿',
    interest_signals: [],
    reply_strategy: '',
    flirt_level: '先别暧昧',
    is_chat_screenshot: true,
    non_chat_reply: '',
    chat_evidence: {},
    conversation_summary: '',
    suggest_stop: false,
    needs_retry: true,
    degraded: true,
    replies: [],
  });
}

function createReplyCard(reply, index) {
  const card = document.createElement('div');
  card.className = 'reply-card';
  card.style.animationDelay = `${index * 0.08}s`;

  const text = document.createElement('div');
  text.className = 'reply-text';
  text.textContent = reply.text;

  const copy = document.createElement('div');
  copy.className = 'reply-copy';
  copy.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2 2v1"/></svg>点击复制';

  card.appendChild(text);
  card.appendChild(copy);
  card.addEventListener('click', () => copyText(reply.text));
  return card;
}

function createSystemCard(tagText, message, color) {
  const card = document.createElement('div');
  card.className = 'reply-card';
  card.style.cssText = `border-left: 3px solid ${color}; background: #fff8f6; cursor: default;`;

  const tag = document.createElement('span');
  tag.className = 'reply-tag';
  tag.style.cssText = `background: ${color}; color: #fff;`;
  tag.textContent = tagText;

  const text = document.createElement('div');
  text.className = 'reply-text';
  text.textContent = message;

  card.append(tag, text);
  return card;
}

function copyText(text) {
  navigator.clipboard.writeText(text).catch(() => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  });
  showToast('已复制，去发送吧');
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 2200);
}

function setSubmitState(disabled, text) {
  document.getElementById('submitBtn').disabled = disabled;
  document.getElementById('btnText').textContent = text;
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

function normalizeSignals(signals) {
  if (!Array.isArray(signals)) return [];
  return signals.map((signal) => cleanText(signal, 28)).filter(Boolean).slice(0, 4);
}

function getDefaultNonChatReply() {
  return '这张图挺有故事，但我还没看到你们聊天。换张聊天截图，我再帮你读空气。';
}

function validateFiles(files, existingCount = 0) {
  if (existingCount + files.length > MAX_FILE_COUNT) return `最多上传 ${MAX_FILE_COUNT} 张截图`;
  if (files.some((file) => !ALLOWED_FILE_TYPES.has(file.type))) return '请上传 JPG、PNG 或 WEBP 截图';
  if (files.some((file) => file.size > MAX_FILE_SIZE)) return '单张截图不能超过 10MB';
  return '';
}

async function optimizeUploads(files, totalFileCount = files.length) {
  let images = await Promise.all(files.map((file) => prepareImage(file, totalFileCount)));
  if (getTotalBase64Length(images) <= MAX_TOTAL_IMAGE_BASE64_LENGTH) return images;

  images = await Promise.all(files.map((file) => prepareImage(file, totalFileCount, true)));
  if (getTotalBase64Length(images) > MAX_TOTAL_IMAGE_BASE64_LENGTH) {
    throw new Error('截图总量较大，请减少张数或裁剪后再上传');
  }
  return images;
}

async function prepareImage(file, fileCount, forceCompression = false) {
  const originalUrl = await readFileAsDataUrl(file);
  const image = await loadImage(originalUrl);
  const shouldCompress = forceCompression || fileCount > 1 || file.size > 900 * 1024;
  const maxEdge = forceCompression ? 1400 : shouldCompress ? 1900 : 2200;
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
  if (!shouldCompress && scale === 1) return getImagePayload(originalUrl, file.name);

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const compressedUrl = canvas.toDataURL('image/webp', forceCompression ? 0.76 : shouldCompress ? 0.88 : 0.94);
  return getImagePayload(compressedUrl, file.name);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('截图读取失败，请重新上传'));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('截图格式无法读取'));
    image.src = dataUrl;
  });
}

function getImagePayload(dataUrl, name) {
  const [header, base64] = dataUrl.split(',');
  const mediaType = header.match(/^data:([^;]+);base64$/)?.[1];
  if (!mediaType || !base64) throw new Error('截图格式无法读取');
  return { base64, mediaType, name, previewUrl: dataUrl };
}

function getTotalBase64Length(images) {
  return images.reduce((sum, image) => sum + image.base64.length, 0);
}

function normalizeDialogue(messages) {
  if (!Array.isArray(messages)) return [];

  return messages
    .map((message) => {
      const side = ['left', 'right', 'feed'].includes(message?.side) ? message.side : '';
      const text = cleanText(message?.text, 100);
      if (!side || !text || isHelperText(text)) return null;
      if (side === 'feed') {
        const speaker = message?.speaker === '对方' || message?.speaker === '我' ? message.speaker : '';
        return speaker ? { side, speaker, text } : null;
      }
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

function hasRepeatedColdReplies(dialogue) {
  const recentReplies = dialogue
    .filter((message) => message.speaker === '对方')
    .slice(-3);

  return recentReplies.length === 3
    && recentReplies.every((message) => message.text.length <= 6 && !/[?？]/.test(message.text));
}

function normalizeChatEvidence(evidence) {
  return {
    image_kind: cleanText(evidence?.image_kind, 24),
    has_message_bubbles: evidence?.has_message_bubbles === true,
    has_chat_ui: evidence?.has_chat_ui === true,
    has_two_sided_layout: evidence?.has_two_sided_layout === true,
  };
}

function isVerifiedChatScreenshot(data, dialogue, evidence) {
  const hasTwoSidedDialogue = dialogue.some((message) => message.side === 'left')
    && dialogue.some((message) => message.side === 'right');
  const hasVisualEvidence = evidence.has_message_bubbles
    || evidence.has_chat_ui
    || (evidence.has_two_sided_layout && hasTwoSidedDialogue);

  if (!hasVisualEvidence || dialogue.length < 2) return false;
  if (data.is_chat_screenshot === false && !hasTwoSidedDialogue) return false;
  return true;
}

function isHelperText(text) {
  return /左侧气泡|右侧气泡|对方发出|我发出|顺序从旧到新/.test(text);
}
