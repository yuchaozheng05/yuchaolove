/* yuchaolove - contextual meme sticker renderer */

const STICKER_TEMPLATES = {
  phone: {
    id: 'lazy-phone-duck',
    name: '刷手机小黄鸭',
    src: 'assets/stickers/lazy-phone-duck.png',
  },
  skeptical: {
    id: 'skeptical-pig',
    name: '抱臂小猪',
    src: 'assets/stickers/skeptical-pig.png',
  },
  confused: {
    id: 'confused-figure',
    name: '摊手小白人',
    src: 'assets/stickers/confused-figure.png',
  },
  caring: {
    id: 'caring-cat',
    name: '认真听猫咪',
    src: 'assets/stickers/caring-cat.png',
  },
  shocked: {
    id: 'shocked-duck',
    name: '震惊小黄鸭',
    src: 'assets/stickers/shocked-duck.png',
  },
  retreat: {
    id: 'retreat-hamster',
    name: '撤退仓鼠',
    src: 'assets/stickers/retreat-hamster.png',
  },
  peek: {
    id: 'peek-rabbit',
    name: '探头小兔',
    src: 'assets/stickers/peek-rabbit.png',
  },
};

const MOOD_SCENES = {
  playful: ['phone', 'shocked', 'peek'],
  teasing: ['skeptical', 'phone', 'peek'],
  curious: ['peek', 'confused', 'phone'],
  caring: ['caring', 'peek', 'phone'],
  speechless: ['confused', 'skeptical', 'shocked'],
  retreat: ['retreat', 'phone', 'skeptical'],
};

const FALLBACK_SUGGESTIONS = {
  初次认识: [
    { text: '哈哈有点意思', mood: 'playful', scene: 'phone' },
    { text: '展开说说', mood: 'curious', scene: 'peek' },
    { text: '我先听着', mood: 'curious', scene: 'caring' },
  ],
  轻松破冰: [
    { text: '行 你继续', mood: 'teasing', scene: 'skeptical' },
    { text: '真的假的', mood: 'playful', scene: 'shocked' },
    { text: '我再看看', mood: 'curious', scene: 'peek' },
  ],
  稳定了解: [
    { text: '原来如此', mood: 'curious', scene: 'phone' },
    { text: '继续展开', mood: 'curious', scene: 'peek' },
    { text: '记下了', mood: 'playful', scene: 'caring' },
  ],
  暧昧升温: [
    { text: '有点会聊', mood: 'teasing', scene: 'peek' },
    { text: '我再观察', mood: 'playful', scene: 'phone' },
    { text: '行吧 加一分', mood: 'teasing', scene: 'skeptical' },
  ],
  情绪陪伴: [
    { text: '先缓一会儿', mood: 'caring', scene: 'caring' },
    { text: '我在听', mood: 'caring', scene: 'peek' },
    { text: '今天辛苦了', mood: 'caring', scene: 'phone' },
  ],
  建议停手: [
    { text: '行 你继续玩', mood: 'retreat', scene: 'retreat' },
    { text: '那我先撤了', mood: 'retreat', scene: 'phone' },
    { text: '所以我算什么', mood: 'speechless', scene: 'confused' },
  ],
};

const imageCache = new Map();
let renderSequence = 0;

function loadStickerImage(src) {
  if (imageCache.has(src)) return imageCache.get(src);
  const pending = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load sticker template: ${src}`));
    image.src = src;
  });
  imageCache.set(src, pending);
  return pending;
}

function getStickerSuggestions(advice) {
  const suggestions = Array.isArray(advice?.sticker_suggestions)
    ? advice.sticker_suggestions
        .map((suggestion) => ({
          text: typeof suggestion?.text === 'string' ? suggestion.text.trim().slice(0, 16) : '',
          mood: MOOD_SCENES[suggestion?.mood] ? suggestion.mood : 'playful',
          scene: STICKER_TEMPLATES[suggestion?.scene] ? suggestion.scene : '',
        }))
        .filter((suggestion) => suggestion.text)
        .slice(0, 5)
    : [];
  if (suggestions.length >= 3) return suggestions;
  return FALLBACK_SUGGESTIONS[advice?.conversation_stage] || FALLBACK_SUGGESTIONS.轻松破冰;
}

function chooseStickerTemplate(suggestion, index) {
  if (STICKER_TEMPLATES[suggestion.scene]) return STICKER_TEMPLATES[suggestion.scene];
  const scenes = MOOD_SCENES[suggestion.mood] || MOOD_SCENES.playful;
  return STICKER_TEMPLATES[scenes[index % scenes.length]];
}

function getTextLines(text) {
  if (text.length <= 8) return [text];
  const midpoint = Math.ceil(text.length / 2);
  return [text.slice(0, midpoint), text.slice(midpoint)];
}

function drawStickerText(ctx, text, size) {
  const lines = getTextLines(text);
  const fontSize = size >= 300 ? (lines.length > 1 ? 29 : 34) : (lines.length > 1 ? 15 : 18);
  const lineHeight = fontSize * 1.16;
  const panelHeight = lines.length * lineHeight + (size >= 300 ? 24 : 14);
  const y = size >= 300 ? 18 : 9;

  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.roundRect(size * 0.08, y, size * 0.84, panelHeight, size >= 300 ? 16 : 9);
  ctx.fill();

  ctx.fillStyle = '#241f1c';
  ctx.font = `700 ${fontSize}px "Noto Sans SC", "PingFang SC", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((line, index) => {
    ctx.fillText(line, size / 2, y + panelHeight / 2 + (index - (lines.length - 1) / 2) * lineHeight);
  });
}

async function makeStickerCanvas(sticker, text, size) {
  const image = await loadStickerImage(sticker.src);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(image, 0, 0, size, size);
  drawStickerText(ctx, text, size);
  return canvas;
}

async function showStickerPanel(advice) {
  const panel = document.getElementById('stickerPanel');
  const grid = document.getElementById('stickerGrid');
  if (!panel || !grid) return;

  const currentRender = ++renderSequence;
  const suggestions = getStickerSuggestions(advice);
  grid.replaceChildren();

  const rendered = await Promise.all(suggestions.map(async (suggestion, index) => {
    const sticker = chooseStickerTemplate(suggestion, index);
    const thumb = await makeStickerCanvas(sticker, suggestion.text, 180);
    thumb.className = 'sticker-thumb';
    thumb.title = `${sticker.name}：${suggestion.text}`;
    thumb.addEventListener('click', () => showStickerModal(sticker, suggestion.text));
    return thumb;
  }));

  if (currentRender !== renderSequence) return;
  rendered.forEach((thumb) => {
    const wrap = document.createElement('div');
    wrap.className = 'sticker-wrap';
    wrap.appendChild(thumb);
    grid.appendChild(wrap);
  });
  panel.style.display = 'block';
  setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
}

async function showStickerModal(sticker, text) {
  let modal = document.getElementById('stickerModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'stickerModal';
    modal.className = 'sticker-modal';
    modal.innerHTML = `
      <div class="sticker-modal-box">
        <button class="sticker-modal-close" onclick="closeStickerModal()" title="关闭">✕</button>
        <div id="stickerModalCanvas"></div>
        <div class="sticker-modal-name" id="stickerModalName"></div>
        <button class="sticker-dl-btn" id="stickerDlBtn">⬇ 下载表情包</button>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeStickerModal();
    });
  }

  const large = await makeStickerCanvas(sticker, text, 640);
  large.style.cssText = 'border-radius:14px;display:block;max-width:100%;height:auto;';
  document.getElementById('stickerModalCanvas').replaceChildren(large);
  document.getElementById('stickerModalName').textContent = `配字：${text}`;
  document.getElementById('stickerDlBtn').onclick = () => {
    large.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `yuchaolove-${sticker.id}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  };
  modal.style.display = 'flex';
}

function closeStickerModal() {
  const modal = document.getElementById('stickerModal');
  if (modal) modal.style.display = 'none';
}

function cancelStickerRender() {
  renderSequence += 1;
}
