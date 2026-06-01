/* yuchaolove - app.js */

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const TAG_CLASS = {
  '温暖体贴': 'tag-warm',
  '幽默俏皮': 'tag-playful',
  '自然真诚': 'tag-natural',
  '制造好奇': 'tag-curious',
};

let imageBase64 = null;
let imageMediaType = 'image/jpeg';
let selectedStyle = '温暖体贴';

document.getElementById('fileInput').addEventListener('change', handleFileUpload);
document.getElementById('chipGroup').addEventListener('click', handleStyleSelection);

function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!ALLOWED_FILE_TYPES.has(file.type)) {
    showToast('请上传 JPG、PNG 或 WEBP 截图');
    event.target.value = '';
    return;
  }
  if (file.size > MAX_FILE_SIZE) {
    showToast('截图不能超过 10MB');
    event.target.value = '';
    return;
  }

  imageMediaType = file.type;
  const reader = new FileReader();
  reader.onload = function (readerEvent) {
    imageBase64 = readerEvent.target.result.split(',')[1];
    document.getElementById('previewImg').src = readerEvent.target.result;
    document.getElementById('previewName').textContent = file.name;
    document.getElementById('previewSize').textContent = `${(file.size / 1024).toFixed(0)} KB`;
    document.getElementById('previewBox').style.display = 'flex';
    document.getElementById('uploadZone').style.display = 'none';
    document.getElementById('results').style.display = 'none';
    setSubmitState(false, '开始分析');
  };
  reader.readAsDataURL(file);
}

function handleStyleSelection(event) {
  const chip = event.target.closest('.chip');
  if (!chip) return;

  document.querySelectorAll('.chip').forEach((item) => item.classList.remove('active'));
  chip.classList.add('active');
  selectedStyle = chip.dataset.style;
}

function resetUpload() {
  imageBase64 = null;
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
  if (!imageBase64) return;

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
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: imageMediaType,
                data: imageBase64,
              },
            },
            { type: 'text', text: buildPrompt() },
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

function buildPrompt() {
  const context = document.getElementById('contextInput').value.trim();

  return `你是一位克制、真实、擅长理解聊天上下文的回复顾问。

请完整阅读截图中可见的聊天记录。先识别哪些气泡是用户发出的，哪些是对方发出的；结合整段聊天、对方的主动程度、回复长度、情绪和最后一句话来判断，而不是只围绕最后一句生成模板。

【任务一：判断态度】
- 给出 8 字以内的态度标签。
- 用 100 字以内说明判断依据和下一步节奏。
- 如果对方连续敷衍、没有反问、明显不想继续聊，将 suggest_stop 设为 true。
- 如果截图文字无法可靠读取，将 needs_retry 设为 true，不要猜测，不要编造聊天内容。

【任务二：生成 3 条可直接发送的回复】
- 回复风格：${selectedStyle}
- 必须贴合截图中的真实话题和对方反应。
- 像真人聊天，简洁自然，不油腻，不强行暧昧，不突然邀约。
- 三条回复角度不同，每条不超过 50 字。
- 如果 needs_retry 为 true，replies 返回空数组。

${context ? `【补充背景】${context}` : ''}

只返回 JSON，不要返回 Markdown：
{
  "attitude_label": "态度标签",
  "attitude_desc": "具体分析和策略建议",
  "suggest_stop": false,
  "needs_retry": false,
  "replies": [
    {"tag": "${selectedStyle}", "text": "回复内容1"},
    {"tag": "${selectedStyle}", "text": "回复内容2"},
    {"tag": "${selectedStyle}", "text": "回复内容3"}
  ]
}`;
}

function parseAdvice(rawText) {
  const cleaned = rawText.replace(/```json|```/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('返回内容格式不正确');

  const data = JSON.parse(cleaned.slice(start, end + 1));
  return {
    attitude_label: cleanText(data.attitude_label, 12) || '态度待判断',
    attitude_desc: cleanText(data.attitude_desc, 180) || '请结合对方后续行动继续观察。',
    suggest_stop: Boolean(data.suggest_stop),
    needs_retry: Boolean(data.needs_retry),
    degraded: Boolean(data.degraded),
    replies: Array.isArray(data.replies)
      ? data.replies
          .map((reply) => ({
            tag: cleanText(reply?.tag, 12) || selectedStyle,
            text: cleanText(reply?.text, 80),
          }))
          .filter((reply) => reply.text)
          .slice(0, 3)
      : [],
  };
}

function renderResults(data) {
  document.getElementById('attitudeBadge').textContent = data.attitude_label;
  document.getElementById('attitudeDesc').textContent = data.attitude_desc;

  const list = document.getElementById('replyList');
  list.replaceChildren();

  if (data.suggest_stop) {
    list.appendChild(createSystemCard('止损提醒', '对方投入明显偏低。先别追着发消息，给彼此一点空间。', '#e57373'));
  }

  if (data.needs_retry || data.degraded) {
    list.appendChild(createSystemCard('请稍后重试', '免费分析通道暂时繁忙，或者截图不够清晰。本次没有猜测内容，请稍后重新分析。', '#c96b52'));
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

  const tag = document.createElement('span');
  tag.className = `reply-tag ${TAG_CLASS[reply.tag] || 'tag-default'}`;
  tag.textContent = reply.tag;

  const text = document.createElement('div');
  text.className = 'reply-text';
  text.textContent = reply.text;

  const copy = document.createElement('div');
  copy.className = 'reply-copy';
  copy.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2 2v1"/></svg>点击复制';

  card.append(tag, text, copy);
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
