/**
 * 表情包标签推导规则（usage_role / negative_tags / scene / intent 补全）。
 * 被 build-sticker-catalog.js（构建时）和 enrich-sticker-tags.js（回填现有 catalog）共用。
 *
 * negative_tags 使用语义场景 id（与 api/analyze.js 的 SEMANTIC_STICKER_SCENES 对齐）：
 * 晚安 早安 想念 感谢 事实解释 安慰 求陪伴 鼓励 暧昧试探 吃醋哄人 大笑 庆祝 道别出行 撒娇卖萌 等待回应 确认回应 日常分享
 */

const GENERIC_ACK_TEXT = /^(收到|好的|OK|OKOK|嗯嗯|对对对|没问题|可以|行吧|明白|了解|懂了|安排|好哒|我在听|然后呢|继续说|展开讲讲|后来呢|原来如此)[~！!。.？?]?$/i;

const EMOTIONAL_SCENES = ['安慰', '求陪伴', '暧昧试探', '想念', '感谢', '晚安'];

// 按表情包自身 scene 标签推导 usage_role（命中即追加，去重）
const USAGE_ROLE_BY_SCENE = {
  安慰: ['接住情绪', '给安全感'],
  关心: ['接住情绪', '表达在乎'],
  晚安: ['温柔收尾'],
  睡觉: ['温柔收尾'],
  结束聊天: ['温柔收尾'],
  早安: ['开启话题'],
  打招呼: ['开启话题'],
  想念: ['表达偏爱'],
  亲密: ['表达偏爱', '给安全感'],
  暧昧: ['表达偏爱', '推进关系'],
  心动: ['表达偏爱'],
  示爱: ['表达偏爱', '推进关系'],
  拉扯: ['推进关系', '制造张力'],
  撒娇: ['撒娇互动'],
  卖萌: ['撒娇互动', '活跃气氛'],
  吃醋: ['撒娇表态'],
  闹脾气: ['撒娇表态'],
  道歉: ['道歉哄人'],
  认错: ['道歉哄人'],
  鼓励: ['鼓励对方', '给情绪价值'],
  夸夸: ['给情绪价值'],
  庆祝: ['一起开心'],
  开心: ['一起开心'],
  大笑: ['接梗', '活跃气氛'],
  玩笑: ['接梗', '活跃气氛'],
  搞怪: ['接梗', '活跃气氛'],
  无语: ['接梗', '吐槽互动'],
  吐槽: ['接梗', '吐槽互动'],
  惊叹: ['捧场回应'],
  感谢: ['表达感谢'],
  确认: ['确认信息'],
  回应: ['确认信息'],
  日常接话: ['顺势接话'],
  倾听: ['顺势接话'],
  等待: ['求回应'],
  告别: ['告别收尾'],
  出行: ['告别收尾'],
};

// 按表情包自身 scene 标签推导 negative_tags（禁用的语义场景 id）
const NEGATIVE_BY_SCENE = {
  鼓励: ['晚安', '感谢', '想念', '暧昧试探'],
  大笑: ['安慰', '晚安', '求陪伴', '暧昧试探'],
  搞怪: ['安慰', '晚安', '求陪伴'],
  吐槽: ['安慰', '晚安', '感谢', '暧昧试探', '求陪伴'],
  无语: ['安慰', '晚安', '感谢', '暧昧试探', '求陪伴'],
  庆祝: ['安慰', '求陪伴'],
  早安: ['晚安'],
  晚安: ['早安', '庆祝', '鼓励'],
  睡觉: ['早安'],
  吃醋: ['安慰', '感谢', '晚安'],
  闹脾气: ['安慰', '感谢', '晚安'],
  道歉: ['安慰', '感谢', '晚安', '早安', '想念', '庆祝', '鼓励', '日常分享'],
  认错: ['安慰', '感谢', '晚安', '早安', '想念', '庆祝', '鼓励', '日常分享'],
  确认: EMOTIONAL_SCENES,
  回应: EMOTIONAL_SCENES,
  等待: ['安慰', '晚安', '感谢'],
};

function unique(list) {
  return [...new Set(list.filter(Boolean))];
}

function toList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  return [String(value).trim()].filter(Boolean);
}

/**
 * 推导 usage_role 与 negative_tags，并保留已有人工标注（人工标注优先，规则只补充）。
 */
export function enrichStickerItem(item) {
  const scenes = toList(item.scene);
  const text = String(item.text || '').trim();
  const isGenericAck = item.generic === true || GENERIC_ACK_TEXT.test(text);

  const usageRole = toList(item.usage_role);
  scenes.forEach((scene) => {
    (USAGE_ROLE_BY_SCENE[scene] || []).forEach((role) => usageRole.push(role));
  });
  if (isGenericAck && !usageRole.length) usageRole.push('确认信息');

  const negativeTags = toList(item.negative_tags);
  scenes.forEach((scene) => {
    (NEGATIVE_BY_SCENE[scene] || []).forEach((tag) => negativeTags.push(tag));
  });
  // 泛用确认类（收到/好的/我在听…）在所有情绪场景禁用
  if (isGenericAck) EMOTIONAL_SCENES.forEach((tag) => negativeTags.push(tag));
  // 自己属于安慰/亲密场景的，不应被自身禁用
  const selfScenes = new Set(scenes);
  const finalNegative = unique(negativeTags).filter((tag) => !selfScenes.has(tag));

  return {
    ...item,
    usage_role: unique(usageRole),
    negative_tags: finalNegative,
  };
}

export default enrichStickerItem;
