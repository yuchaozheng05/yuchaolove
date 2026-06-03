/* yuchaolove - stock sticker recommendations with canvas fallback */

const STICKER_CATALOG_URL = '/assets/stickers/catalog.v1.json';
const STICKER_PANEL_RECOMMENDATION_COUNT = 4;
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
    emotions: ['shy', 'apology', 'comfort', 'love'],
    scenarios: ['flirting', 'apology', 'comfort', 'cute_acting'],
    tags: ['撒娇', '别生气', '哄你', '可爱'],
  },
  say_goodnight_back: {
    emotions: ['goodnight', 'love', 'comfort', 'sleepy'],
    scenarios: ['good_night', 'flirting', 'comfort'],
    tags: ['晚安', '睡觉', '陪伴'],
  },
  playful_continue: {
    emotions: ['laugh', 'happy', 'awkward'],
    scenarios: ['teasing', 'celebration', 'agree'],
    tags: ['哈哈', '接梗', '开心'],
  },
  celebrate_together: {
    emotions: ['happy', 'laugh', 'encourage'],
    scenarios: ['celebration', 'agree', 'encouragement'],
    tags: ['开心', '好耶', '太好了'],
  },
  accept_thanks: {
    emotions: ['thanks', 'happy', 'shy'],
    scenarios: ['thanks', 'agree', 'teasing'],
    tags: ['谢谢', '收到', '不客气'],
  },
  comfort_support: {
    emotions: ['comfort', 'encourage', 'goodnight'],
    scenarios: ['comfort', 'hug', 'encouragement', 'good_night'],
    tags: ['抱抱', '安慰', '加油', '休息'],
  },
  affectionate_reply: {
    emotions: ['miss_you', 'love', 'shy'],
    scenarios: ['missing_you', 'flirting', 'hug'],
    tags: ['想你', '喜欢', '抱抱'],
  },
};
const FALLBACK_STICKERS = [
  { id: 'fallback-happy', text: '好开心！', emotion: 'happy', scenario: 'celebration', tags: ['开心', '哈哈', '好耶'], color: '#ffe6ec' },
  { id: 'fallback-shy', text: '偷看一下', emotion: 'shy', scenario: 'flirting', tags: ['害羞', '偷看', '脸红'], color: '#f3e8ff' },
  { id: 'fallback-comfort', text: '抱抱你', emotion: 'comforting', scenario: 'comfort', tags: ['抱抱', '委屈', '安慰'], color: '#e8fbe8' },
  { id: 'fallback-speechless', text: '欸？', emotion: 'speechless', scenario: 'speechless', tags: ['无语', '沉默', '真的假的'], color: '#e6f7ff' },
  { id: 'fallback-angry', text: '生气了！', emotion: 'angry', scenario: 'angry_complaint', tags: ['生气', '气死', '哼'], color: '#ffeccf' },
  { id: 'fallback-night', text: '晚安安', emotion: 'sleepy', scenario: 'good_night', tags: ['晚安', '困', '睡觉'], color: '#d9e7ff' },
];

let stickerCatalogPromise = null;

function loadStickerCatalog() {
  if (!stickerCatalogPromise) {
    stickerCatalogPromise = fetch(STICKER_CATALOG_URL, { cache: 'no-cache' })
      .then((response) => (response.ok ? response.json() : { items: [] }))
      .then((catalog) => (Array.isArray(catalog.items) ? catalog.items : []))
      .catch((error) => {
        console.warn('Sticker catalog unavailable:', error.message);
        return [];
      });
  }
  return stickerCatalogPromise;
}

function normalizeList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  return [String(value).trim()].filter(Boolean);
}

function normalizeEmotion(value) {
  if (!value) return '';
  const emotion = typeof value === 'string' ? value : value.primary || '';
  return STICKER_CANONICAL_EMOTIONS[emotion] || emotion;
}

function expandTerms(values, aliases) {
  const expanded = [];
  normalizeList(values).forEach((value) => {
    expanded.push(value);
    normalizeList(aliases[value]).forEach((alias) => expanded.push(alias));
  });
  return [...new Set(expanded.filter(Boolean))];
}

function getCharacter(item) {
  return String(item.character || item.id || '').trim() || 'unknown';
}

function characterOrderIndex(character) {
  const index = STICKER_CHARACTER_ORDER.indexOf(character);
  return index >= 0 ? index : STICKER_CHARACTER_ORDER.length + 1;
}

function getDiversityCharacters(byCharacter) {
  const preferredCharacters = STICKER_CHARACTER_ORDER.filter((character) => byCharacter.has(character));
  if (preferredCharacters.length >= 2) return preferredCharacters;
  return [...byCharacter.keys()].sort((a, b) => {
    const order = characterOrderIndex(a) - characterOrderIndex(b);
    if (order !== 0) return order;
    return (byCharacter.get(b)?.[0]?.score || 0) - (byCharacter.get(a)?.[0]?.score || 0);
  });
}

function buildStickerIntent(advice) {
  const suggestions = Array.isArray(advice?.sticker_suggestions) ? advice.sticker_suggestions : [];
  const match = advice?.sticker_match_intent || {};
  const replyIntentPlan = STICKER_REPLY_INTENT_PLANS[match.reply_intent] || null;
  const emotions = normalizeList(match.emotion).map(normalizeEmotion);
  normalizeList(match.secondary_emotions).map(normalizeEmotion).forEach((emotion) => emotions.push(emotion));
  normalizeList(replyIntentPlan?.emotions).forEach((emotion) => emotions.push(emotion));
  const scenarios = normalizeList(match.scenario);
  normalizeList(replyIntentPlan?.scenarios).forEach((scenario) => scenarios.push(scenario));
  const stages = normalizeList(match.relationship_stage);
  const tags = normalizeList(match.keywords);
  normalizeList(replyIntentPlan?.tags).forEach((tag) => tags.push(tag));

  suggestions.forEach((suggestion) => {
    const emotion = normalizeEmotion(suggestion.emotion) || suggestion.mood || '';
    if (emotion) emotions.push(emotion);
    normalizeList(suggestion.scenario || suggestion.scene).forEach((scenario) => scenarios.push(scenario));
    normalizeList(suggestion.relationship_stage).forEach((stage) => stages.push(stage));
    normalizeList(suggestion.tags).forEach((tag) => tags.push(tag));
    normalizeList(suggestion.keywords).forEach((keyword) => tags.push(keyword));
    if (suggestion.text) tags.push(suggestion.text);
  });

  const stageMap = {
    初次认识: ['stranger', 'acquaintance'],
    轻松破冰: ['acquaintance', 'talking_stage'],
    稳定了解: ['talking_stage'],
    暧昧升温: ['flirting', 'relationship'],
    情绪陪伴: ['talking_stage', 'flirting', 'relationship'],
    建议停手: ['post_conflict'],
  };
  normalizeList(stageMap[advice?.conversation_stage]).forEach((stage) => stages.push(stage));

  return {
    emotions: [...new Set(emotions.filter(Boolean))],
    scenarios: [...new Set(scenarios.filter(Boolean))],
    stages: [...new Set(stages.filter(Boolean))],
    tags: [...new Set(tags.filter(Boolean))],
  };
}

function scoreSticker(item, intent) {
  const itemEmotion = normalizeEmotion(item.emotion);
  const itemScenarios = normalizeList(item.scenario);
  const itemStages = normalizeList(item.relationship_stage);
  const itemTags = normalizeList(item.tags);
  const exactEmotions = normalizeList(intent.emotions);
  const relatedEmotions = expandTerms(intent.emotions, STICKER_EMOTION_ALIASES);
  const exactScenarios = normalizeList(intent.scenarios);
  const relatedScenarios = expandTerms(intent.scenarios, STICKER_SCENARIO_ALIASES);
  const searchable = [
    item.id,
    item.character,
    itemEmotion,
    ...itemScenarios,
    item.text,
    ...itemTags,
  ].join(' ').toLowerCase();

  let score = 0;
  if (exactEmotions.includes(itemEmotion)) score += 40;
  else if (relatedEmotions.includes(itemEmotion)) score += 22;
  score += exactScenarios.filter((scenario) => itemScenarios.includes(scenario)).length * 28;
  score += relatedScenarios.filter((scenario) => !exactScenarios.includes(scenario) && itemScenarios.includes(scenario)).length * 14;
  score += intent.stages.filter((stage) => itemStages.includes(stage)).length * 12;
  score += intent.tags.filter((tag) => searchable.includes(tag.toLowerCase())).length * 8;
  score += (Number(item.quality_score) || 0) * 10;
  score += (Number(item.usage_priority) || 0) * 0.1;
  return Math.round(score * 100) / 100;
}

function sortScoredStickers(a, b) {
  return b.score - a.score
    || (Number(b.usage_priority) || 0) - (Number(a.usage_priority) || 0)
    || characterOrderIndex(getCharacter(a)) - characterOrderIndex(getCharacter(b))
    || String(a.id).localeCompare(String(b.id));
}

function selectDiverseStickers(scored, count) {
  const sorted = scored.slice().sort(sortScoredStickers);
  const byCharacter = new Map();
  sorted.forEach((item) => {
    const character = getCharacter(item);
    if (!byCharacter.has(character)) byCharacter.set(character, []);
    byCharacter.get(character).push(item);
  });

  const characters = getDiversityCharacters(byCharacter);
  const selected = [];
  const selectedIds = new Set();
  const characterCounts = new Map();

  const takeNextForCharacter = (character, maxForCharacter = Infinity) => {
    if ((characterCounts.get(character) || 0) >= maxForCharacter) return;
    const next = (byCharacter.get(character) || []).find((item) => !selectedIds.has(item.id));
    if (!next) return;
    selected.push(next);
    selectedIds.add(next.id);
    characterCounts.set(character, (characterCounts.get(character) || 0) + 1);
  };

  for (let pass = 1; pass <= STICKER_MAX_PER_CHARACTER_SOFT && selected.length < count; pass += 1) {
    characters.forEach((character) => {
      if (selected.length < count) takeNextForCharacter(character, pass);
    });
  }

  sorted.forEach((item) => {
    if (selected.length < count && !selectedIds.has(item.id)) {
      selected.push(item);
      selectedIds.add(item.id);
    }
  });

  return selected.slice(0, count);
}

function recommendFromCatalog(catalog, advice) {
  const intent = buildStickerIntent(advice);
  const scored = catalog
    .filter((item) => item?.file)
    .map((item) => ({ ...item, score: scoreSticker(item, intent) }));
  return selectDiverseStickers(scored, STICKER_PANEL_RECOMMENDATION_COUNT);
}

function getFallbackStickers(advice) {
  const intent = buildStickerIntent(advice);
  return FALLBACK_STICKERS
    .map((item) => ({ ...item, score: scoreSticker(item, intent) }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, STICKER_PANEL_RECOMMENDATION_COUNT);
}

function createStockStickerElement(sticker) {
  const image = document.createElement('img');
  image.className = 'sticker-thumb';
  image.src = sticker.file;
  image.alt = sticker.text || '表情包';
  image.title = sticker.text || '表情包';
  image.loading = 'lazy';
  image.addEventListener('click', () => showStickerModal(sticker));
  image.onerror = () => {
    const canvas = makeFallbackCanvas(sticker, 180);
    canvas.className = 'sticker-thumb';
    canvas.addEventListener('click', () => showStickerModal(sticker));
    image.replaceWith(canvas);
  };
  return image;
}

function createStickerTextElement(sticker) {
  const text = String(sticker.text || '').trim();
  if (!text) return null;
  const label = document.createElement('div');
  label.className = 'sticker-text-label';
  label.textContent = text;
  return label;
}

function drawFallbackCharacter(ctx, size, sticker) {
  const cx = size * 0.5;
  const cy = size * 0.56;
  const r = size * 0.25;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = sticker.color || '#ffe6ec';
  ctx.globalAlpha = 0.34;
  ctx.beginPath();
  ctx.roundRect(size * 0.08, size * 0.08, size * 0.84, size * 0.84, size * 0.11);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fffdf9';
  ctx.strokeStyle = '#3a2927';
  ctx.lineWidth = Math.max(3, size * 0.018);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 1.05, r * 0.96, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffb9c2';
  [-r * 0.44, r * 0.44].forEach((dx) => {
    ctx.beginPath();
    ctx.ellipse(cx + dx, cy + r * 0.12, r * 0.16, r * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = '#2f2424';
  [-r * 0.28, r * 0.28].forEach((dx) => {
    ctx.beginPath();
    ctx.arc(cx + dx, cy - r * 0.14, r * 0.075, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.strokeStyle = '#2f2424';
  ctx.lineWidth = Math.max(3, size * 0.014);
  ctx.beginPath();
  if (sticker.emotion === 'angry') {
    ctx.moveTo(cx - r * 0.16, cy + r * 0.2);
    ctx.lineTo(cx + r * 0.16, cy + r * 0.15);
  } else if (sticker.emotion === 'speechless') {
    ctx.moveTo(cx - r * 0.16, cy + r * 0.18);
    ctx.lineTo(cx + r * 0.16, cy + r * 0.18);
  } else {
    ctx.arc(cx, cy + r * 0.08, r * 0.18, 0.2, Math.PI - 0.2);
  }
  ctx.stroke();
}

function drawStickerText(ctx, text, size) {
  if (!text) return;
  ctx.fillStyle = '#38231f';
  ctx.font = `700 ${Math.max(18, size * 0.12)}px "Noto Sans SC","PingFang SC",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.slice(0, 8), size / 2, size * 0.18);
}

function makeFallbackCanvas(sticker, size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  drawFallbackCharacter(ctx, size, sticker);
  return canvas;
}

function createFallbackStickerElement(sticker) {
  const canvas = makeFallbackCanvas(sticker, 180);
  canvas.className = 'sticker-thumb';
  canvas.title = sticker.text || '表情包';
  canvas.addEventListener('click', () => showStickerModal(sticker));
  return canvas;
}

async function showStickerPanel(advice) {
  const panel = document.getElementById('stickerPanel');
  const grid = document.getElementById('stickerGrid');
  if (!panel || !grid) return;

  grid.replaceChildren();
  const catalog = await loadStickerCatalog();
  const stickers = catalog.length ? recommendFromCatalog(catalog, advice) : getFallbackStickers(advice);
  stickers.forEach((sticker) => {
    const wrap = document.createElement('div');
    wrap.className = 'sticker-wrap';
    const label = createStickerTextElement(sticker);
    if (label) wrap.appendChild(label);
    wrap.appendChild(sticker.file ? createStockStickerElement(sticker) : createFallbackStickerElement(sticker));
    grid.appendChild(wrap);
  });

  panel.style.display = 'block';
  setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
}

function showStickerModal(sticker) {
  let modal = document.getElementById('stickerModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'stickerModal';
    modal.className = 'sticker-modal';
    modal.innerHTML = '<div class="sticker-modal-box"><button class="sticker-modal-close" onclick="closeStickerModal()" title="关闭">×</button><div id="stickerModalCanvas"></div><div class="sticker-modal-name" id="stickerModalName"></div><button class="sticker-dl-btn" id="stickerDlPng">下载 PNG</button></div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeStickerModal();
    });
  }

  const holder = document.getElementById('stickerModalCanvas');
  holder.replaceChildren();
  if (sticker.file) {
    const image = document.createElement('img');
    image.src = sticker.file;
    image.alt = sticker.text || '表情包';
    image.style.cssText = 'display:block;width:100%;border-radius:16px;';
    holder.appendChild(image);
  } else {
    const canvas = makeFallbackCanvas(sticker, 420);
    canvas.style.cssText = 'display:block;max-width:100%;height:auto;border-radius:16px;';
    holder.appendChild(canvas);
  }
  document.getElementById('stickerModalName').textContent = sticker.text ? `配字：${sticker.text}` : '库存表情包';
  document.getElementById('stickerDlPng').onclick = () => downloadStickerPng(sticker);
  modal.style.display = 'flex';
}

async function downloadStickerPng(sticker) {
  const link = document.createElement('a');
  link.download = `${sticker.id || 'yuchaolove-sticker'}.png`;
  if (sticker.file) {
    link.href = sticker.file;
    link.click();
    return;
  }
  const canvas = makeFallbackCanvas(sticker, 420);
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}

function closeStickerModal() {
  const modal = document.getElementById('stickerModal');
  if (modal) modal.style.display = 'none';
}

function cancelStickerRender() {}
