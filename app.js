/* yuchaolove - app.js */

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILE_COUNT = 6;
const MAX_TOTAL_IMAGE_BASE64_LENGTH = 3_800_000;
const ALLOWED_FILE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const EMOTIONAL_DISCLOSURE_PATTERN = /困死|好困|太困|困了|很困|累死|好累|太累|累了|很累|疼|痛|难受|不舒服|烦|焦虑|压力|不想上学|不想去|没写完|睡不着|崩溃|想哭|生病|发烧|胃疼|肚子疼|头疼/;
const PHYSICAL_DISCOMFORT_PATTERN = /疼|痛|难受|不舒服|生病|发烧|胃疼|肚子疼|头疼/;
const STUDY_STRESS_PATTERN = /考试|考完|考砸|复习|作业|没写完|论文|ddl|期中|期末|测验|quiz|midterm|final/i;
const HAPPY_EMOTION_PATTERN = /哈哈|开心|好耶|太好了|笑死|嘿嘿|嘻嘻|期待|成功|过了|收到|喜欢|可以呀|行呀|耶/;

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
    hideStickerPanel();
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

function hideStickerPanel() {
  const panel = document.getElementById('stickerPanel');
  if (panel) panel.style.display = 'none';
  if (typeof cancelStickerRender === 'function') cancelStickerRender();
  if (typeof closeStickerModal === 'function') closeStickerModal();
}

function resetUpload() {
  uploadedImages = [];
  document.getElementById('previewGallery').replaceChildren();
  document.getElementById('uploadZone').style.display = 'block';
  document.getElementById('previewBox').style.display = 'none';
  document.getElementById('fileInput').value = '';
  document.getElementById('results').style.display = 'none';
  hideStickerPanel();
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
  hideStickerPanel();

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
  return `请分析上传的 ${imageCount} 张图片。截图已经按聊天时间从早到晚排列。
按系统规则识别有效聊天截图、还原 dialogue、判断态度，并生成自然可发送的回复。
表情包只给 3 个最贴合当前聊天的创意，页面会自动补足到 6 个。
${context ? `补充背景：${context}` : ''}
只返回符合 schema 的 JSON。`;
}

function parseAdvice(rawText) {
  const data = JSON.parse(extractFirstJsonObject(rawText));
  const dialogue = normalizeDialogue(data.dialogue);
  const chatEvidence = normalizeChatEvidence(data.chat_evidence);
  const isChatScreenshot = isVerifiedChatScreenshot(data, dialogue, chatEvidence);
  const verifiedDialogue = isChatScreenshot ? dialogue : [];
  const emotionalDisclosure = isChatScreenshot && hasRecentEmotionalDisclosure(verifiedDialogue);
  const activeCuriosity = isChatScreenshot && !emotionalDisclosure && hasActiveCuriosity(verifiedDialogue);
  const suggestStop = isChatScreenshot && !emotionalDisclosure && (Boolean(data.suggest_stop) || hasRepeatedColdReplies(verifiedDialogue));
  const conversationStage = inferConversationStage(data.conversation_stage, { emotionalDisclosure, activeCuriosity, suggestStop });
  return {
    attitude_label: isChatScreenshot ? (emotionalDisclosure ? '愿意倾诉' : activeCuriosity ? '主动了解' : cleanText(data.attitude_label, 12) || '态度待判断') : '这不是聊天截图',
    attitude_desc: emotionalDisclosure
      ? '对方在连续表达自己的疲惫、不舒服或压力，也愿意补充细节。这是在向你倾诉，不是敷衍，但不能直接换算成好感分数。目前更适合先接住情绪，不急着升温。'
      : activeCuriosity
        ? '对方连续主动问你的情况，也会顺着前一个答案继续展开。她至少愿意了解你，先认真回答一个具体点，再看她会不会继续接球。'
        : (isChatScreenshot ? cleanText(data.attitude_desc, 180) : '')
          || (isChatScreenshot ? '请结合对方后续行动继续观察。' : '我还没看到可以分析的聊天内容。'),
    interest_score: isChatScreenshot ? (emotionalDisclosure ? Math.min(45, clampScore(data.interest_score)) : activeCuriosity ? Math.max(62, clampScore(data.interest_score)) : clampScore(data.interest_score)) : 0,
    interest_level: isChatScreenshot ? (emotionalDisclosure ? '愿意倾诉' : activeCuriosity ? '愿意接话' : normalizeInterestLevel(data.interest_level)) : '低意愿',
    interest_signals: isChatScreenshot ? (emotionalDisclosure ? buildEmotionalDisclosureSignals(verifiedDialogue) : activeCuriosity ? buildActiveCuriositySignals() : normalizeSignals(data.interest_signals)) : [],
    conversation_mode: isChatScreenshot ? (emotionalDisclosure ? '情绪倾诉' : activeCuriosity ? '主动了解' : normalizeConversationMode(data.conversation_mode)) : '礼貌回应',
    conversation_stage: isChatScreenshot ? conversationStage : '初次认识',
    reply_strategy: isChatScreenshot ? (emotionalDisclosure ? '先回应她现在的不舒服，给她一点喘息空间，等她愿意继续说再慢慢接话。' : activeCuriosity ? '先认真回答她最后的问题，给一个真实细节，再顺着她的反应慢慢展开。' : cleanText(data.reply_strategy, 100)) : '',
    flirt_level: isChatScreenshot ? (emotionalDisclosure ? '先别暧昧' : normalizeFlirtLevel(data.flirt_level)) : '先别暧昧',
    is_chat_screenshot: isChatScreenshot,
    non_chat_reply: cleanText(data.non_chat_reply, 120) || getDefaultNonChatReply(),
    chat_evidence: chatEvidence,
    conversation_summary: isChatScreenshot
      ? buildDialogueSummary(verifiedDialogue) || cleanText(data.conversation_summary, 260)
      : '',
    chat_guide: isChatScreenshot ? (emotionalDisclosure ? buildEmotionalDisclosureGuide() : activeCuriosity ? buildActiveCuriosityGuide() : normalizeChatGuide(data.chat_guide, buildStageChatGuide(conversationStage))) : buildDefaultChatGuide(),
    dialogue: verifiedDialogue,
    suggest_stop: suggestStop,
    needs_retry: isChatScreenshot && Boolean(data.needs_retry),
    degraded: Boolean(data.degraded),
    replies: isChatScreenshot && Array.isArray(data.replies)
      ? data.replies
          .map((reply) => ({
            text: cleanText(reply?.text, 100),
          }))
          .filter((reply) => reply.text)
          .slice(0, 5)
      : [],
    sticker_suggestions: isChatScreenshot ? normalizeStickerSuggestions(data.sticker_suggestions, conversationStage, verifiedDialogue) : [],
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
  document.getElementById('interestLevel').textContent = data.interest_level === '愿意倾诉'
    ? '愿意倾诉 · 暂不判断好感'
    : `${data.interest_level} · ${data.interest_score}`;
  document.getElementById('conversationMode').textContent = data.conversation_mode;
  document.getElementById('conversationStage').textContent = data.conversation_stage;
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
  renderChatGuide(data.chat_guide, Boolean(data.is_chat_screenshot && !data.needs_retry && !data.degraded));

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
  if (data.is_chat_screenshot && !data.needs_retry && !data.degraded && typeof showStickerPanel === 'function') {
    showStickerPanel(data);
  } else {
    hideStickerPanel();
  }
}

function renderRetryNotice(message) {
  renderResults({
    attitude_label: '暂时无法分析',
    attitude_desc: message,
    interest_score: 0,
    interest_level: '低意愿',
    interest_signals: [],
    conversation_mode: '礼貌回应',
    conversation_stage: '初次认识',
    reply_strategy: '',
    flirt_level: '先别暧昧',
    is_chat_screenshot: true,
    non_chat_reply: '',
    chat_evidence: {},
    conversation_summary: '',
    chat_guide: buildDefaultChatGuide(),
    suggest_stop: false,
    needs_retry: true,
    degraded: true,
    replies: [],
    sticker_suggestions: [],
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
  card.addEventListener('click', () => {
    copyText(reply.text);
    card.classList.add('copied');
    setTimeout(() => card.classList.remove('copied'), 1200);
  });
  return card;
}

function renderChatGuide(guide, visible) {
  const container = document.getElementById('chatGuide');
  const normalized = normalizeChatGuide(guide);
  document.getElementById('guideCurrentMove').textContent = normalized.current_move;
  document.getElementById('guideAvoid').textContent = normalized.avoid;
  const list = document.getElementById('guideSteps');
  list.replaceChildren();
  normalized.next_steps.forEach((step) => {
    const item = document.createElement('li');
    item.textContent = step;
    list.appendChild(item);
  });
  container.classList.toggle('show', visible);
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
  return ['低意愿', '礼貌回应', '愿意接话', '愿意倾诉', '轻微好感', '主动升温'].includes(value) ? value : '愿意接话';
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
  if (hasRecentEmotionalDisclosure(dialogue)) return false;
  const recentReplies = dialogue
    .filter((message) => message.speaker === '对方')
    .slice(-3);

  return recentReplies.length === 3
    && recentReplies.every((message) => (
      message.text.length <= 6
      && !/[?？！!，,。]|哈哈|嘿嘿|表情|困|累|疼|痛|难受|不舒服|压力|烦/.test(message.text)
    ));
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
      current_move: '现在还是初识阶段，先让聊天舒服地继续，不急着刻意制造暧昧。',
      next_steps: ['顺着眼前的话题回一个具体点。', '她愿意继续回问时，再交换一个日常细节。', '连续几轮都有来有回后，再找共同兴趣。'],
      avoid: '别一上来就连问资料，也别突然硬撩。',
    },
    轻松破冰: {
      current_move: '目前在破冰阶段，先接住她最后一句，再加一个有画面的细节，让她容易回。',
      next_steps: ['这轮只聊一个点，观察她会不会补充。', '她愿意接球时，再延伸到一个轻松的生活片段。', '有共同点后留个小钩子，下次继续聊。'],
      avoid: '不要像问卷一样连续发问，也不要每一句都故意暧昧。',
    },
    稳定了解: {
      current_move: '现在已经进入互相了解阶段。先认真回应她正在问的内容，再留一个她愿意继续聊的细节。',
      next_steps: ['先给一个真实的小细节。', '她对某一点感兴趣时，再交换彼此经历。', '她持续接球后，再聊到一起能做的活动，合适时再轻松邀约。'],
      avoid: '不要把正常了解误判成告白信号，也别跳过聊天直接约。',
    },
    暧昧升温: {
      current_move: '现在有一点暧昧空间，可以顺着你们已有的梗轻轻回球，但别突然加太重。',
      next_steps: ['先沿着已有互动轻轻调侃一句。', '她继续回球时，再加入一点个人化关心。', '氛围稳定后，可以提出低压力的轻松邀约。'],
      avoid: '不要突然表白，也不要逼她表态。',
    },
    情绪陪伴: {
      current_move: '现在更重要的是让她觉得被听见。先回应她具体说的不舒服或烦心点，不急着推进关系。',
      next_steps: ['先接住她说的具体不舒服或烦心点。', '她愿意继续说时，再顺着她的节奏陪她聊。', '等情绪缓下来，再换到轻松一点的话题。'],
      avoid: '别说教，别急着给方案，也别趁她脆弱时硬撩。',
    },
    建议停手: {
      current_move: '目前对方没有明显想继续聊的信号。先停一下，把空间留给对方。',
      next_steps: ['这轮不要继续补发问题。', '观察她之后会不会主动回来。', '长期都只有你在推进时，把精力收回来。'],
      avoid: '不要继续连发，也不要用情绪施压。',
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

const STICKER_MOODS = new Set(['playful', 'teasing', 'curious', 'caring', 'speechless', 'retreat']);
const STICKER_SCENES = new Set(['comfort', 'rest', 'study', 'listen', 'happy', 'cheer', 'peek', 'confused', 'pat']);
const STICKER_RECOMMENDATION_COUNT = 6;

function buildDefaultStickerSuggestions(stage) {
  const suggestions = {
    初次认识: [{ text: '哈哈有点意思', mood: 'playful', scene: 'happy' }, { text: '展开说说', mood: 'curious', scene: 'peek' }, { text: '我先听着', mood: 'curious', scene: 'listen' }, { text: '让我想想', mood: 'curious', scene: 'confused' }, { text: '收到收到', mood: 'playful', scene: 'cheer' }, { text: '继续继续', mood: 'playful', scene: 'pat' }],
    轻松破冰: [{ text: '行 你继续', mood: 'teasing', scene: 'happy' }, { text: '真的假的', mood: 'playful', scene: 'confused' }, { text: '我再看看', mood: 'curious', scene: 'peek' }, { text: '有点意思', mood: 'playful', scene: 'cheer' }, { text: '让我听听', mood: 'caring', scene: 'listen' }, { text: '什么情况', mood: 'speechless', scene: 'comfort' }],
    稳定了解: [{ text: '原来如此', mood: 'curious', scene: 'confused' }, { text: '继续展开', mood: 'curious', scene: 'peek' }, { text: '记下了', mood: 'playful', scene: 'study' }, { text: '我有在听', mood: 'caring', scene: 'listen' }, { text: '慢慢说', mood: 'caring', scene: 'comfort' }, { text: '这么回事', mood: 'playful', scene: 'happy' }],
    暧昧升温: [{ text: '有点会聊', mood: 'teasing', scene: 'peek' }, { text: '我再观察', mood: 'playful', scene: 'confused' }, { text: '行吧 加一分', mood: 'teasing', scene: 'cheer' }, { text: '被你拿捏了', mood: 'playful', scene: 'happy' }, { text: '有点可爱', mood: 'caring', scene: 'pat' }, { text: '先别得意', mood: 'teasing', scene: 'comfort' }],
    情绪陪伴: [{ text: '先缓一会儿', mood: 'caring', scene: 'rest' }, { text: '我在听', mood: 'caring', scene: 'listen' }, { text: '给你抱抱', mood: 'caring', scene: 'comfort' }, { text: '给你拍拍', mood: 'caring', scene: 'pat' }, { text: '慢慢来', mood: 'caring', scene: 'cheer' }, { text: '先别着急', mood: 'caring', scene: 'peek' }],
    建议停手: [{ text: '行 你继续玩', mood: 'retreat', scene: 'rest' }, { text: '那我先撤了', mood: 'retreat', scene: 'peek' }, { text: '所以我算什么', mood: 'speechless', scene: 'confused' }, { text: '好吧好吧', mood: 'retreat', scene: 'listen' }, { text: '我先消失', mood: 'retreat', scene: 'comfort' }, { text: '当我没说', mood: 'speechless', scene: 'pat' }],
  };
  return suggestions[normalizeConversationStage(stage)];
}

function buildContextualStickerSuggestions(context, stage = '轻松破冰') {
  const contextualSuggestions = {
    physical_discomfort: [{ text: '听着就难受', mood: 'caring', scene: 'comfort' }, { text: '先缓一会儿', mood: 'caring', scene: 'rest' }, { text: '我在这儿', mood: 'caring', scene: 'listen' }, { text: '给你拍拍', mood: 'caring', scene: 'pat' }, { text: '别硬撑啦', mood: 'caring', scene: 'cheer' }, { text: '作业先放放', mood: 'caring', scene: 'study' }],
    study_stress: [{ text: '考试加油', mood: 'caring', scene: 'study' }, { text: '稳住 能行', mood: 'caring', scene: 'cheer' }, { text: '先别慌', mood: 'caring', scene: 'comfort' }, { text: '累了歇会儿', mood: 'caring', scene: 'rest' }, { text: '我在听', mood: 'caring', scene: 'listen' }, { text: '给你拍拍', mood: 'caring', scene: 'pat' }],
    happy: [{ text: '好耶', mood: 'playful', scene: 'happy' }, { text: '替你开心', mood: 'playful', scene: 'cheer' }, { text: '可以可以', mood: 'playful', scene: 'pat' }, { text: '有点可爱', mood: 'teasing', scene: 'peek' }, { text: '收到快乐', mood: 'playful', scene: 'listen' }, { text: '继续保持', mood: 'playful', scene: 'study' }],
    emotional_disclosure: buildDefaultStickerSuggestions('情绪陪伴'),
  };
  return contextualSuggestions[context] || buildDefaultStickerSuggestions(stage);
}

function getStickerContext(dialogue) {
  if (hasPhysicalDiscomfort(dialogue)) return 'physical_discomfort';
  if (hasStudyStress(dialogue)) return 'study_stress';
  if (hasHappyEmotion(dialogue)) return 'happy';
  if (hasRecentEmotionalDisclosure(dialogue)) return 'emotional_disclosure';
  return 'generic';
}

function uniqueStickerSuggestions(suggestions) {
  const seenScenes = new Set();
  const seenTexts = new Set();
  return suggestions.filter((suggestion) => {
    if (!suggestion.text || !suggestion.scene || seenScenes.has(suggestion.scene) || seenTexts.has(suggestion.text)) return false;
    seenScenes.add(suggestion.scene);
    seenTexts.add(suggestion.text);
    return true;
  });
}

function normalizeStickerSuggestions(suggestions, stage = '轻松破冰', dialogue = []) {
  const context = getStickerContext(dialogue);
  if (context !== 'generic') return buildContextualStickerSuggestions(context, stage);
  const normalized = Array.isArray(suggestions)
    ? suggestions.map((suggestion) => ({
        text: cleanText(suggestion?.text, 16),
        mood: STICKER_MOODS.has(suggestion?.mood) ? suggestion.mood : 'playful',
        scene: STICKER_SCENES.has(suggestion?.scene) ? suggestion.scene : '',
      })).filter((suggestion) => suggestion.text && suggestion.scene).slice(0, STICKER_RECOMMENDATION_COUNT)
    : [];
  const fallback = buildDefaultStickerSuggestions(stage);
  if (normalized.length < 3) return fallback;
  return uniqueStickerSuggestions([...normalized, ...fallback])
    .slice(0, STICKER_RECOMMENDATION_COUNT);
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
