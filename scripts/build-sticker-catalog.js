import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join, relative } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const promptsDir = join(root, 'assets', 'stickers', 'prompts');
const stickersDir = join(root, 'assets', 'stickers');
const imagesDir = join(stickersDir, 'packs', 'style-bible-v1', 'images');
const catalogPath = join(root, 'assets', 'stickers', 'catalog.v1.json');
const imageExtensions = new Set(['.png']);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readPromptFiles() {
  const preferred = [
    'sticker-prompts.json',
    'mvp-9-prompts.json',
    'phase-1-54-prompts.json',
  ];
  const discovered = existsSync(promptsDir)
    ? readdirSync(promptsDir).filter((entry) => entry.endsWith('-prompts.json'))
    : [];
  const filenames = unique([...preferred, ...discovered]);
  const prompts = [];
  const sources = [];

  filenames.forEach((filename) => {
    const fullPath = join(promptsDir, filename);
    if (!existsSync(fullPath)) return;
    const items = readJson(fullPath);
    if (!Array.isArray(items)) {
      throw new Error(`Expected ${relative(root, fullPath)} to be a JSON array`);
    }
    prompts.push(...items);
    sources.push(`/assets/stickers/prompts/${filename}`);
  });

  return { prompts, sources };
}

function walkImages(dir) {
  if (!existsSync(dir)) return [];
  const files = [];
  const walk = (current) => {
    readdirSync(current).forEach((entry) => {
      const fullPath = join(current, entry);
      const stats = statSync(fullPath);
      if (stats.isDirectory()) {
        walk(fullPath);
        return;
      }
      const relativePath = relative(stickersDir, fullPath).replaceAll('\\', '/');
      if (relativePath.includes('/thumbs/')) return;
      if (relativePath.startsWith('reference/') || relativePath.includes('/reference/')) return;
      if (imageExtensions.has(extname(entry).toLowerCase())) {
        files.push({
          filename: basename(fullPath),
          fullPath,
          relativePath,
          file: `/assets/stickers/${relativePath}`,
        });
      }
    });
  };
  walk(dir);
  return files;
}

function toId(filename) {
  return basename(filename, extname(filename))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function filenameText(item) {
  return `${item.filename || ''} ${item.emotion || ''} ${item.action || ''} ${item.text || ''}`.toLowerCase();
}

function inferCharacter(item) {
  const text = filenameText(item);
  if (/hamster|仓鼠/.test(text)) return 'hamster';
  if (/cat|kitten|小猫/.test(text)) return 'cat';
  if (/shiba|dog|柴犬/.test(text)) return 'shiba';
  if (/bunny|bunnies|rabbit|mochi|团子|兔/.test(text)) return 'bunny';
  if (/duck|鸭/.test(text)) return 'duck';
  if (/pig|猪/.test(text)) return 'pig';
  return item.character || 'sticker';
}

function inferEmotion(item) {
  const text = filenameText(item);
  if (/happy|laugh|哈哈|开心|笑|耶/.test(text)) return 'happy';
  if (/comfort|caring|listen|pat|hug|抱抱|安慰|摸摸/.test(text)) return 'comfort';
  if (/confused|skeptical|shocked|awkward|speechless|无语|震惊|怀疑/.test(text)) return 'awkward';
  if (/study|exam|work|作业|考试|学习/.test(text)) return 'work';
  if (/cheer|encourage|加油|鼓励/.test(text)) return 'excited';
  if (/peek|shy|偷看|害羞|脸红/.test(text)) return 'shy';
  if (/retreat|bye|撤|不打扰/.test(text)) return 'awkward';
  if (/rest|sleep|night|晚安|睡|困/.test(text)) return 'sleepy';
  if (/lazy|phone|duck/.test(text)) return 'speechless';
  return item.emotion || 'happy';
}

function inferScenario(item) {
  const text = filenameText(item);
  if (/morning|早安|早上|早呀/.test(text)) return 'good_morning';
  if (/night|sleep|rest|晚安|困|睡/.test(text)) return 'good_night';
  if (/miss|想你|抱抱|heart|love|么么|亲/.test(text)) return 'missing_you';
  if (/comfort|caring|listen|pat|\bhug\b|安慰|抱抱|摸摸/.test(text)) return 'comfort';
  if (/peek|shy|偷看|害羞|脸红/.test(text)) return 'flirting';
  if (/retreat|bye|撤|不打扰/.test(text)) return 'safe_exit';
  if (/study|exam|作业|考试|学习/.test(text)) return 'studying';
  if (/加油|棒|鼓励|cheer|proud/.test(text)) return 'encouragement';
  if (/birthday|new year|生日|新年|庆祝/.test(text)) return 'celebration';
  if (/sorry|apology|对不起|抱歉/.test(text)) return 'apology';
  if (/angry|mad|生气|气死|哼/.test(text)) return 'angry_complaint';
  if (/awkward|speechless|confused|skeptical|shocked|lazy|phone|无语|沉默|啊这|震惊/.test(text)) return 'speechless';
  if (/happy|laugh|开心|哈哈|笑|耶|快乐/.test(text)) return 'celebration';
  if (/cute|嗨|谢谢|摸摸|乖/.test(text)) return 'greeting';
  return 'teasing';
}

function inferRelationshipStage(item, scenario) {
  const text = `${filenameText(item)} ${scenario}`;
  if (/sorry|apology|对不起|抱歉|angry|mad|生气|气死|哼/.test(text)) return 'post_conflict';
  if (/confession|love|喜欢|爱你|么么|亲/.test(text)) return 'relationship';
  if (/miss|flirt|shy|想你|抱抱|心动|脸红|偷看/.test(text)) return 'flirting';
  if (/study|work|加油|鼓励|thanks|谢谢|comfort|安慰|抱抱/.test(text)) return 'talking_stage';
  if (/morning|night|greeting|早安|晚安|嗨|你好/.test(text)) return 'acquaintance';
  return 'talking_stage';
}

function buildTags(item, scenario) {
  return unique([
    item.character,
    item.emotion,
    scenario,
    item.text,
    ...basename(item.filename || '', extname(item.filename || '')).split(/[-_\s]+/),
    ...(item.action || '').split(/[\s,，。!！~～]+/).slice(0, 8),
  ].map((tag) => String(tag || '').trim()).filter((tag) => tag.length >= 2));
}

function buildCatalogItem(item) {
  const character = item.character || inferCharacter(item);
  const emotion = item.emotion || inferEmotion(item);
  const enrichedItem = { ...item, character, emotion };
  const scenario = item.scenario || inferScenario(item);
  const relationshipStage = item.relationship_stage || inferRelationshipStage(enrichedItem, scenario);
  return {
    id: toId(item.filename),
    file: item.file || `/assets/stickers/packs/style-bible-v1/images/${item.filename}`,
    character,
    emotion,
    scenario,
    relationship_stage: relationshipStage,
    text: item.text || '',
    tags: buildTags(enrichedItem, scenario),
    quality_score: Number.isFinite(Number(item.quality_score)) ? Number(item.quality_score) : 0.82,
    usage_priority: Number.isFinite(Number(item.usage_priority)) ? Number(item.usage_priority) : 60,
  };
}

const { prompts, sources } = readPromptFiles();
if (!Array.isArray(prompts) || !prompts.length) {
  throw new Error(`Expected at least one prompt JSON array under ${relative(root, promptsDir)}`);
}

const promptsByFilename = new Map(prompts.map((item) => [item.filename, item]));
const images = walkImages(stickersDir);
const items = images
  .map((image) => ({
    ...(promptsByFilename.get(image.filename) || {}),
    filename: image.filename,
    file: image.file,
  }))
  .map(buildCatalogItem)
  .sort((a, b) => a.id.localeCompare(b.id));

if (!items.length) {
  throw new Error(`Sticker catalog cannot be empty. No PNG files found under ${relative(root, stickersDir)}`);
}

const catalog = {
  version: 1,
  generated_at: new Date().toISOString(),
  pack: 'style-bible-v1',
  source_prompts: sources,
  image_dir: '/assets/stickers',
  generated_image_dir: '/assets/stickers/packs/style-bible-v1/images',
  count: items.length,
  items,
};

writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Sticker catalog built: ${items.length} records from ${images.length} PNG files (${prompts.length} prompts available)`);
