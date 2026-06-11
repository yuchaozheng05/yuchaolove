#!/usr/bin/env node
/**
 * Leonardo AI 批量生成表情包脚本
 * 用法: node scripts/generate-stickers-leonardo.js --batch=p0 --key=YOUR_API_KEY
 *
 * --batch  p0 | p1 | p2 | redraw-p0 | redraw-p1  (默认 p0)
 * --key    Leonardo API Key (或设置环境变量 LEONARDO_API_KEY)
 * --limit  最多生成几张 (默认全部)
 * --dry    只打印 prompt，不真正调用 API
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── 参数解析 ──────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);

const BATCH   = args.batch   || 'p0';
const API_KEY = args.key     || process.env.LEONARDO_API_KEY || '';
const LIMIT   = args.limit   ? Number(args.limit) : Infinity;
const DRY_RUN = args.dry     === true || args.dry === 'true';

if (!API_KEY && !DRY_RUN) {
  console.error('❌ 缺少 API Key。用法：node scripts/generate-stickers-leonardo.js --key=YOUR_KEY');
  console.error('   或者设置环境变量：export LEONARDO_API_KEY=YOUR_KEY');
  process.exit(1);
}

// ── 读取 Prompt 批次文件 ──────────────────────────────────
const BATCH_FILE_MAP = {
  'p0':        'new-stickers-p0-prompts.json',
  'p1':        'new-stickers-p1-prompts.json',
  'p2':        'new-stickers-p2-prompts.json',
  'redraw-p0': 'redraw-p0-prompts.json',
  'redraw-p1': 'redraw-p1-prompts.json',
};

const batchFile = BATCH_FILE_MAP[BATCH];
if (!batchFile) {
  console.error(`❌ 不认识的 batch: ${BATCH}。可选值: ${Object.keys(BATCH_FILE_MAP).join(', ')}`);
  process.exit(1);
}

const promptsPath = join(ROOT, 'assets/stickers/prompts', batchFile);
if (!existsSync(promptsPath)) {
  console.error(`❌ 找不到文件: ${promptsPath}`);
  process.exit(1);
}

const prompts = JSON.parse(readFileSync(promptsPath, 'utf8'));
const OUTPUT_DIR = join(ROOT, 'assets/stickers/packs/style-bible-v1/images');

// ── Leonardo API 配置 ─────────────────────────────────────
// 推荐模型：Anime Pastel Dream（最适合可爱卡通贴纸风格）
// 如果生成效果不好可以换 modelId，见文末备注
const LEONARDO_MODEL_ID = 'b820ea11-02bf-4652-97ae-9ac0cc00593d'; // Anime Pastel Dream（可用）
const IMAGE_SIZE = 512;
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 40;

// ── 工具函数 ─────────────────────────────────────────────
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function callLeonardo(endpoint, method = 'GET', body = null) {
  const res = await fetch(`https://cloud.leonardo.ai/api/rest/v1${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Leonardo API ${method} ${endpoint} → ${res.status}: ${text}`);
  }
  return res.json();
}

async function startGeneration(prompt, negativePrompt) {
  // 在所有 prompt 前面加上强制 chibi 风格前缀
  const chibiPrefix = 'super deformed chibi style, extremely round head 60% of total height, tiny stubby body, simple flat colors, clean thick outline, kawaii japanese sticker art, no realistic proportions, ';
  const fullPrompt = chibiPrefix + prompt;

  const data = await callLeonardo('/generations', 'POST', {
    modelId: LEONARDO_MODEL_ID,
    prompt: fullPrompt,
    negative_prompt: `realistic proportions, detailed anatomy, sticker border, white outline border, watermark, text, ${negativePrompt || ''}`,
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    num_images: 1,
    guidance_scale: 7,
    num_inference_steps: 30,
    presetStyle: 'ANIME',
    transparency: 'disabled',
  });
  // Leonardo API v1 返回格式
  return data?.sdGenerationJob?.generationId ?? data?.generationId;
}

async function pollGeneration(generationId) {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await sleep(POLL_INTERVAL_MS);
    const data = await callLeonardo(`/generations/${generationId}`);
    // 兼容两种返回格式
    const gen = data?.generations_by_pk ?? data;
    if (!gen) continue;
    const status = gen.status ?? gen.generations_by_pk?.status;
    if (status === 'COMPLETE') {
      return gen.generated_images?.[0]?.url ?? gen.generations_by_pk?.generated_images?.[0]?.url;
    }
    if (status === 'FAILED') {
      throw new Error(`生成失败: ${generationId}`);
    }
    process.stdout.write('.');
  }
  throw new Error(`超时: ${generationId}`);
}

async function downloadImage(url, outputPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`下载失败: ${url}`);
  const buffer = await res.arrayBuffer();
  writeFileSync(outputPath, Buffer.from(buffer));
}

// ── 主流程 ────────────────────────────────────────────────
async function main() {
  const todo = prompts.slice(0, LIMIT);
  const total = todo.length;

  console.log(`\n🎨 批次: ${BATCH}  |  共 ${total} 张  |  模型: Anime Pastel Dream`);
  if (DRY_RUN) {
    console.log('⚠️  Dry run 模式 — 只打印 prompt，不调用 API\n');
  }
  console.log('─'.repeat(60));

  let success = 0;
  let skip = 0;
  let fail = 0;

  for (let i = 0; i < todo.length; i++) {
    const item = todo[i];
    const filename = item.new_file || `${item.id}.png`;
    const outputPath = join(OUTPUT_DIR, filename);
    const label = `[${i + 1}/${total}] ${filename}`;

    // 已存在则跳过
    if (existsSync(outputPath)) {
      console.log(`⏭  ${label} — 已存在，跳过`);
      skip++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`📋 ${label}`);
      console.log(`   prompt: ${item.prompt.slice(0, 100)}…`);
      continue;
    }

    process.stdout.write(`⏳ ${label} `);

    try {
      const genId = await startGeneration(item.prompt, item.negative_prompt);
      if (!genId) throw new Error('未获取到 generationId');

      const imageUrl = await pollGeneration(genId);
      if (!imageUrl) throw new Error('未获取到图片 URL');

      await downloadImage(imageUrl, outputPath);
      console.log(` ✅`);
      success++;

      // 每张图之间等 1 秒，避免触发限速
      if (i < todo.length - 1) await sleep(1000);
    } catch (err) {
      console.log(` ❌ ${err.message}`);
      fail++;
    }
  }

  console.log('─'.repeat(60));
  console.log(`\n✅ 成功: ${success}  ⏭ 跳过: ${skip}  ❌ 失败: ${fail}`);

  if (success > 0) {
    console.log(`\n下一步：运行 npm run stickers:build 更新 catalog`);
  }
}

main().catch(err => {
  console.error('\n💥 脚本报错:', err.message);
  process.exit(1);
});

/*
 备用模型 ID（如果 Anime Pastel Dream 效果不好）：
 - 1e60896f-3c26-4296-8ecc-53e2afecc132  Leonardo Anime XL
 - aa77f04e-3eec-4034-9c07-d0a6f203905a  Leonardo Kino XL（写实感更强，不推荐）
 - b24e16ff-06e3-43eb-8d33-4416c2d75876  DreamShaper v7
*/
