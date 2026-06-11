import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, extname, join, relative } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const defaultPromptsPath = join(root, 'assets', 'stickers', 'prompts', 'sticker-prompts.json');
const imagesDir = join(root, 'assets', 'stickers', 'packs', 'style-bible-v1', 'images');
const thumbsDir = join(root, 'assets', 'stickers', 'packs', 'style-bible-v1', 'thumbs');
const contactSheetsDir = join(root, 'assets', 'stickers', 'packs', 'style-bible-v1');
const defaultLimit = 10;
const maxLimit = 10;
const retryCount = 2;
const maxRateLimitAttempts = 80;
const localEnvFiles = [
  join(root, '.env.local'),
  join(root, '.env'),
  join(root, '.vercel', '.env.production.local'),
];
const styleBibleTestFiles = [
  'white_mochi_happy_01.png',
  'shiba_comfort_01.png',
];
const styleBiblePrompt = `Cute Chinese WeChat sticker pack style.

ONE CHARACTER ONLY.
Single centered character.
Only one mascot in the entire image.
No second character anywhere.
No companion, no pet, no friend, no group, no family, no crowd.
No side character.
No background character.
If the emotion is happy, love, comfort, or celebration, still draw exactly one character only.

Composition:
main character occupies 75%-85% of canvas.
Centered full-body mascot.
Clean white background.
No scene story.
No background objects competing with the subject.
No crop.
Not a distant small subject.

Proportion:
natural cute WeChat sticker proportion.
head about 55% of character height.
body about 45% of character height.
Do not make the face take over the whole body.
Do not make a huge close-up head.
Round head and small chubby body.
Tiny short arms.
Tiny short legs.
Soft rounded silhouette.
Short simple body gesture.

Face:
tiny black dot eyes.
small smiling mouth.
large soft pink blush cheeks.
round cheeks.
simple cute expression.
clear emotion.
no huge eyes.
no anime face.
no scary expression.

Style:
flat 2D hand-drawn WeChat sticker.
simple black-brown clean outline.
soft pastel colors.
round, cute, expressive, healing, playful.
clearly recognizable character species.
not realistic.
no detailed fur.
no 3D.

Character identity:
white_mochi: one plain round white mochi blob, pure white, no sprout, no leaf, soft and cute, not ghost, not egg.
hamster: one golden hamster with small round ears, cream belly, chubby cheeks, tiny paws.
cat: one gray and white kitten with pointy ears, cat face, small paws.
shiba: one orange shiba inu dog with pointy ears, cream muzzle, cream belly, tiny paws, curled tail if visible.

No text.
No letters.
No symbols.
No words.
No captions.
No fake Chinese.
No watermark.
No logo.

Negative prompt:
multiple characters, group, family, friends, companions, pets, crowd, side character, background character, second animal, two animals, many animals, scene story, background props, small subject, distant view, big head close-up, face-only avatar, huge face, long arms, human hands, realistic fur, photorealistic, 3D, anime, manga, text, letters, symbols, words, typography, fake Chinese, watermark, logo, cropped body, cut off body, cut off limbs, missing limbs, missing paws, missing ears, incomplete body, partial body, out of frame, body outside canvas, deformed body, extra limbs, broken outline`;
const characterPrompts = {
  white_mochi: 'plain pure white round mochi blob, no sprout, no leaf',
  hamster: 'round golden hamster',
  cat: 'round gray-and-white cat',
  shiba: 'round orange shiba dog',
};

function loadLocalEnv() {
  localEnvFiles.forEach((envPath) => {
    if (!existsSync(envPath)) return;
    const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) return;
      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) return;
      const value = rawValue
        .trim()
        .replace(/^['"]|['"]$/g, '');
      process.env[key] = value;
    });
  });
}

function parseArgs(argv) {
  const args = {
    dryRun: false,
    limit: defaultLimit,
    emotion: '',
    character: '',
    files: [],
    styleBibleTest: false,
    force: false,
    promptFile: defaultPromptsPath,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--limit') args.limit = Number(argv[++index]);
    else if (arg.startsWith('--limit=')) args.limit = Number(arg.split('=')[1]);
    else if (arg === '--emotion') args.emotion = argv[++index] || '';
    else if (arg.startsWith('--emotion=')) args.emotion = arg.split('=')[1] || '';
    else if (arg === '--character') args.character = argv[++index] || '';
    else if (arg.startsWith('--character=')) args.character = arg.split('=')[1] || '';
    else if (arg === '--files') args.files = parseFiles(argv[++index] || '');
    else if (arg.startsWith('--files=')) args.files = parseFiles(arg.split('=')[1] || '');
    else if (arg === '--style-bible-test') args.styleBibleTest = true;
    else if (arg === '--force') args.force = true;
    else if (arg === '--prompt-file') args.promptFile = resolvePromptFile(argv[++index] || '');
    else if (arg.startsWith('--prompt-file=')) args.promptFile = resolvePromptFile(arg.split('=')[1] || '');
  }

  if (args.styleBibleTest && !args.files.length) {
    args.files = styleBibleTestFiles;
    args.force = true;
  }

  args.limit = Number.isFinite(args.limit)
    ? Math.max(1, Math.min(maxLimit, Math.floor(args.limit)))
    : defaultLimit;
  return args;
}

function parseFiles(value) {
  return value.split(',').map((file) => file.trim()).filter(Boolean);
}

function resolvePromptFile(value) {
  if (!value) return defaultPromptsPath;
  return value.startsWith('/') ? value : join(root, value);
}

function readPrompts(promptFile) {
  const prompts = JSON.parse(readFileSync(promptFile, 'utf8'));
  if (!Array.isArray(prompts)) {
    throw new Error(`Expected ${relative(root, promptFile)} to be a JSON array`);
  }
  return prompts;
}

function filterPrompts(prompts, args) {
  const requestedFiles = new Set(args.files);
  return prompts
    .filter((item) => !requestedFiles.size || requestedFiles.has(item.filename))
    .filter((item) => !args.emotion || item.emotion === args.emotion)
    .filter((item) => !args.character || item.character === args.character)
    .filter((item) => item.filename)
    .filter((item) => args.force || !existsSync(join(imagesDir, item.filename)))
    .slice(0, requestedFiles.size ? Math.min(requestedFiles.size, maxLimit) : args.limit)
    .map((item) => ({ ...item, generationPrompt: buildGenerationPrompt(item, args) }));
}

function buildGenerationPrompt(item, args) {
  if (args.promptFile !== defaultPromptsPath && item.prompt) return item.prompt;
  const character = characterPrompts[item.character] || item.character || 'round chubby cute character';
  return [
    styleBiblePrompt,
    `Character: ${character}.`,
    `Emotion: ${item.emotion || 'cute'}.`,
    `Action: ${normalizeActionForTextlessSticker(item.action) || 'cute centered pose'}.`,
    'No captions, no handwritten text, no decorative symbols, no speech bubble, no banner.',
    'Keep the top area clean and empty for text to be added later by the app.',
    'Use only the specified character identity and keep the sticker pack visually consistent.',
  ].join('\n');
}

function normalizeActionForTextlessSticker(action = '') {
  return action
    .replace(/colorful stars? bursting around/gi, 'joyful energetic pose')
    .replace(/stars? around/gi, 'simple cute pose')
    .replace(/tiny hearts? or sparkles?/gi, 'minimal clean pose')
    .replace(/hearts?/gi, 'cute gesture')
    .replace(/sparkles?/gi, 'cute gesture')
    .replace(/zzz bubbles? rising/gi, 'sleepy peaceful expression')
    .replace(/speech bubbles?/gi, '')
    .replace(/banner/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getProvider() {
  if (process.env.REPLICATE_API_TOKEN) return 'replicate';
  if (process.env.POLLINATIONS_ENABLED === '1') return 'pollinations';
  if (process.env.STICKER_IMAGE_PROVIDER) return process.env.STICKER_IMAGE_PROVIDER;
  return '';
}

async function generateWithPollinations(item) {
  const url = new URL(`https://image.pollinations.ai/prompt/${encodeURIComponent(item.generationPrompt)}`);
  url.searchParams.set('width', '1024');
  url.searchParams.set('height', '1024');
  url.searchParams.set('nologo', 'true');
  url.searchParams.set('safe', 'true');
  url.searchParams.set('model', process.env.POLLINATIONS_MODEL || 'flux');

  console.log(`[pollinations] GET ${url.toString()}`);
  const response = await fetch(url, {
    headers: {
      Accept: 'image/*,application/json,text/plain;q=0.8',
    },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const error = new Error(`Pollinations failed ${response.status}\nURL: ${url.toString()}\nResponse: ${body}`);
    error.provider = 'pollinations';
    error.status = response.status;
    error.retryable = response.status !== 402;
    throw error;
  }
  return Buffer.from(await response.arrayBuffer());
}

async function generateWithReplicate(item) {
  const response = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json',
      Prefer: 'wait',
    },
    body: JSON.stringify({
      input: {
        prompt: item.generationPrompt,
        go_fast: true,
        megapixels: '1',
        num_outputs: 1,
        aspect_ratio: '1:1',
        output_format: 'png',
        output_quality: 90,
      },
    }),
  });
  const responseText = await response.text();
  const data = parseJsonResponse(responseText);
  if (!response.ok) {
    throw buildProviderError('Replicate', response.status, responseText, data.detail || `Replicate failed ${response.status}`);
  }
  if (data.status === 'failed' || data.status === 'canceled') {
    throw buildProviderError('Replicate', response.status, responseText, data.error || `Replicate prediction ${data.status}`);
  }
  const imageUrl = Array.isArray(data.output) ? data.output[0] : data.output;
  if (!imageUrl) throw new Error('Replicate returned no image URL');
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    const body = await imageResponse.text().catch(() => '');
    throw buildProviderError('Replicate image download', imageResponse.status, body, `Replicate image download failed ${imageResponse.status}`);
  }
  return Buffer.from(await imageResponse.arrayBuffer());
}

function parseJsonResponse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function parseRetryAfterMs(text) {
  const resetMatch = text.match(/resets?\s+in\s+~?(\d+(?:\.\d+)?)\s*s/i);
  if (resetMatch) return Math.ceil(Number(resetMatch[1]) * 1000) + 1000;

  const retryMatch = text.match(/retry(?:-|\s*)after[^0-9]*(\d+(?:\.\d+)?)\s*s?/i);
  if (retryMatch) return Math.ceil(Number(retryMatch[1]) * 1000) + 1000;

  return 10000;
}

function buildProviderError(provider, status, body, fallbackMessage) {
  const text = String(body || '');
  const message = `${fallbackMessage}${text ? `\nResponse: ${text}` : ''}`;
  const error = new Error(message);
  error.provider = provider;
  error.status = status;
  error.retryable = status === 429 || /rate limit|throttled|too many requests/i.test(text);
  error.retryAfterMs = error.retryable ? parseRetryAfterMs(text) : undefined;
  if (status === 401 || status === 403 || status === 402) error.retryable = false;
  return error;
}

function outputPathFor(item) {
  return join(imagesDir, basename(item.filename));
}

function thumbPathFor(item) {
  return join(thumbsDir, basename(item.filename, extname(item.filename)) + '.png');
}

function contactSheetPathFor(promptFile) {
  const name = basename(promptFile, extname(promptFile)).replace(/-prompts$/, '');
  return join(contactSheetsDir, `contact-sheet-${name}.png`);
}

function runPythonImageTool(args, code) {
  const result = spawnSync('python3', ['-c', code, ...args], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'Python image tool failed').trim());
  }
}

function processGeneratedPng(outputPath, thumbPath) {
  const code = String.raw`
from collections import deque
from PIL import Image
import sys

image_path, thumb_path = sys.argv[1], sys.argv[2]
img = Image.open(image_path).convert("RGBA")
img.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
canvas = Image.new("RGBA", (1024, 1024), (255, 255, 255, 0))
canvas.alpha_composite(img, ((1024 - img.width) // 2, (1024 - img.height) // 2))
pixels = canvas.load()
w, h = canvas.size
seen = set()
queue = deque()

def near_white(x, y):
    r, g, b, a = pixels[x, y]
    return a > 0 and r >= 242 and g >= 242 and b >= 242

for x in range(w):
    queue.append((x, 0))
    queue.append((x, h - 1))
for y in range(h):
    queue.append((0, y))
    queue.append((w - 1, y))

while queue:
    x, y = queue.popleft()
    if (x, y) in seen or x < 0 or y < 0 or x >= w or y >= h:
        continue
    seen.add((x, y))
    if not near_white(x, y):
        continue
    pixels[x, y] = (255, 255, 255, 0)
    queue.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))

canvas.save(image_path, "PNG")
thumb = canvas.copy()
thumb.thumbnail((256, 256), Image.Resampling.LANCZOS)
thumb_canvas = Image.new("RGBA", (256, 256), (255, 255, 255, 0))
thumb_canvas.alpha_composite(thumb, ((256 - thumb.width) // 2, (256 - thumb.height) // 2))
thumb_canvas.save(thumb_path, "PNG")
`;
  runPythonImageTool([outputPath, thumbPath], code);
}

function createContactSheet(items, promptFile) {
  const files = items
    .map((item) => outputPathFor(item))
    .filter((path) => existsSync(path));
  if (!files.length) return '';
  const outputPath = contactSheetPathFor(promptFile);
  const code = String.raw`
from PIL import Image, ImageDraw
import os
import sys

output_path = sys.argv[1]
files = sys.argv[2:]
cell = 300
label_h = 34
cols = 3
rows = (len(files) + cols - 1) // cols
sheet = Image.new("RGBA", (cols * cell, rows * (cell + label_h)), (255, 255, 255, 255))
draw = ImageDraw.Draw(sheet)

for index, path in enumerate(files):
    img = Image.open(path).convert("RGBA")
    img.thumbnail((240, 240), Image.Resampling.LANCZOS)
    x = (index % cols) * cell
    y = (index // cols) * (cell + label_h)
    sheet.alpha_composite(img, (x + (cell - img.width) // 2, y + (cell - img.height) // 2))
    draw.text((x + 10, y + cell), os.path.basename(path), fill=(60, 43, 39))

sheet.save(output_path, "PNG")
`;
  runPythonImageTool([outputPath, ...files], code);
  return outputPath;
}

function verifyGeneratedImages(items) {
  const code = String.raw`
from PIL import Image
import json
import os
import sys

results = []
for path in sys.argv[1:]:
    if not os.path.exists(path):
        results.append({"file": os.path.basename(path), "exists": False})
        continue
    img = Image.open(path).convert("RGBA")
    alpha = img.getchannel("A")
    has_transparency = alpha.getextrema()[0] < 255
    results.append({
        "file": os.path.basename(path),
        "exists": True,
        "size": list(img.size),
        "mode": img.mode,
        "has_transparency": has_transparency
    })
print(json.dumps(results, ensure_ascii=False))
`;
  const paths = items.map(outputPathFor);
  const result = spawnSync('python3', ['-c', code, ...paths], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || 'Image verification failed').trim());
  return JSON.parse(result.stdout);
}

async function generateImage(item, provider) {
  if (provider === 'pollinations') {
    try {
      return await generateWithPollinations(item);
    } catch (error) {
      if (error.status === 402 && process.env.REPLICATE_API_TOKEN) {
        console.warn('[pollinations] 402 received; switching to Replicate Flux Schnell.');
        return generateWithReplicate(item);
      }
      throw error;
    }
  }
  if (provider === 'replicate') return generateWithReplicate(item);
  throw new Error(`Unsupported image provider: ${provider}`);
}

async function withRetries(task) {
  let lastError;
  for (let attempt = 0; attempt < maxRateLimitAttempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (error.retryable === false) break;
      const canRetryNormalError = attempt < retryCount;
      const isRateLimit = error.retryAfterMs || /rate limit|throttled|too many requests/i.test(error.message);
      if (!isRateLimit && !canRetryNormalError) break;
      if (attempt < maxRateLimitAttempts - 1) {
        const waitMs = error.retryAfterMs || Math.min(15000, 700 * (attempt + 1));
        console.warn(`[retry] waiting ${Math.ceil(waitMs / 1000)}s after: ${String(error.message).split('\n')[0]}`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }
  }
  throw lastError;
}

async function main() {
  loadLocalEnv();
  const args = parseArgs(process.argv.slice(2));
  const prompts = readPrompts(args.promptFile);
  const selected = filterPrompts(prompts, args);
  const provider = getProvider();
  const saved = [];
  const failed = [];

  mkdirSync(imagesDir, { recursive: true });
  mkdirSync(thumbsDir, { recursive: true });
  mkdirSync(contactSheetsDir, { recursive: true });

  console.log(`Sticker prompts: ${prompts.length}`);
  console.log(`Prompt file: ${relative(root, args.promptFile)}`);
  console.log(`Selected: ${selected.length} (limit ${args.limit})`);
  if (args.emotion) console.log(`Emotion filter: ${args.emotion}`);
  if (args.character) console.log(`Character filter: ${args.character}`);

  selected.forEach((item) => {
    console.log(`${args.dryRun ? '[dry-run]' : '[queued]'} ${item.filename} | ${item.character} | ${item.emotion} | ${item.text}`);
  });

  if (args.dryRun) return;
  if (!provider) {
    console.log('No image provider configured. Set POLLINATIONS_ENABLED=1 or REPLICATE_API_TOKEN to generate images.');
    return;
  }

  for (const item of selected) {
    const outputPath = join(imagesDir, basename(item.filename));
    if (!args.force && existsSync(outputPath)) {
      console.log(`[skip] ${item.filename}`);
      continue;
    }

    try {
      const bytes = await withRetries(() => generateImage(item, provider));
      writeFileSync(outputPath, bytes);
      processGeneratedPng(outputPath, thumbPathFor(item));
      saved.push(item);
      console.log(`[saved] ${relative(root, outputPath)}`);
    } catch (error) {
      failed.push({ filename: item.filename, error: error.message });
      console.warn(`[failed] ${item.filename}: ${error.message}`);
    }
  }

  if (saved.length) {
    const contactSheetItems = prompts.filter((item) => item.filename && existsSync(outputPathFor(item)));
    const contactSheetPath = createContactSheet(contactSheetItems, args.promptFile);
    const verification = verifyGeneratedImages(selected);
    console.log(`Generated filenames: ${saved.map((item) => item.filename).join(', ')}`);
    if (contactSheetPath) console.log(`Contact sheet: ${relative(root, contactSheetPath)}`);
    console.log(`Image verification: ${JSON.stringify(verification, null, 2)}`);
  }
  if (failed.length) {
    console.log(`Failed generations: ${JSON.stringify(failed, null, 2)}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
