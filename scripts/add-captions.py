#!/usr/bin/env python3
"""
把准确的中文文字烘焙进表情包图片顶部（风格对齐参考截图：暖棕色圆体字 + 白色描边）。

用法：
  python3 scripts/add-captions.py                          # 处理 screenshot-pack 全部已生成图片
  python3 scripts/add-captions.py --prompts <prompts.json> # 指定别的批次文件
  python3 scripts/add-captions.py --force                  # 重新烘焙（覆盖已处理记录）
  python3 scripts/add-captions.py --font /path/to/font.ttf # 指定字体

依赖：pip3 install pillow
文字以 prompts JSON 里每项的 text 字段为准——保证图片文字和元数据永远一致。
已处理的文件记录在 packs/style-bible-v1/captioned.json，不会重复叠字。
"""
import argparse
import json
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit('缺少 Pillow，请先运行: pip3 install pillow')

ROOT = Path(__file__).resolve().parent.parent
IMAGES_DIR = ROOT / 'assets/stickers/packs/style-bible-v1/images'
THUMBS_DIR = ROOT / 'assets/stickers/packs/style-bible-v1/thumbs'
DONE_PATH = ROOT / 'assets/stickers/packs/style-bible-v1/captioned.json'
DEFAULT_PROMPTS = ROOT / 'assets/stickers/prompts/screenshot-pack-prompts.json'

# 常见中文字体（macOS 优先，其次 Linux/Windows）
FONT_CANDIDATES = [
    '/System/Library/Fonts/PingFang.ttc',
    '/System/Library/Fonts/Hiragino Sans GB.ttc',
    '/Library/Fonts/Arial Unicode.ttf',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',
    '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
    'C:/Windows/Fonts/msyhbd.ttc',
    'C:/Windows/Fonts/msyh.ttc',
]

TEXT_COLOR = (122, 85, 71, 255)      # 暖棕色，对齐截图
OUTLINE_COLOR = (255, 255, 255, 255)  # 白描边，保证任何底色可读
TOP_MARGIN_RATIO = 0.03
MAX_WIDTH_RATIO = 0.92


def find_font(custom):
    candidates = ([custom] if custom else []) + FONT_CANDIDATES
    for path in candidates:
        if path and Path(path).exists():
            return path
    sys.exit('找不到中文字体，请用 --font 指定，例如 --font /System/Library/Fonts/PingFang.ttc')


def fit_font(draw, text, font_path, canvas_w):
    """从大到小找一个能放进画布宽度的字号。"""
    size = int(canvas_w * 0.14)
    min_size = int(canvas_w * 0.07)
    max_w = canvas_w * MAX_WIDTH_RATIO
    while size > min_size:
        font = ImageFont.truetype(font_path, size)
        box = draw.textbbox((0, 0), text, font=font, stroke_width=max(2, size // 14))
        if box[2] - box[0] <= max_w:
            return font, size
        size -= 2
    return ImageFont.truetype(font_path, min_size), min_size


def add_caption(image_path, text, font_path):
    img = Image.open(image_path).convert('RGBA')
    draw = ImageDraw.Draw(img)
    font, size = fit_font(draw, text, font_path, img.width)
    stroke = max(2, size // 14)
    box = draw.textbbox((0, 0), text, font=font, stroke_width=stroke)
    text_w = box[2] - box[0]
    x = (img.width - text_w) / 2 - box[0]
    y = img.height * TOP_MARGIN_RATIO - box[1]
    draw.text((x, y), text, font=font, fill=TEXT_COLOR,
              stroke_width=stroke, stroke_fill=OUTLINE_COLOR)
    img.save(image_path)


def regenerate_thumb(image_path):
    thumb_path = THUMBS_DIR / image_path.name
    if not THUMBS_DIR.exists():
        return
    img = Image.open(image_path).convert('RGBA')
    img.thumbnail((160, 160))
    img.save(thumb_path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--prompts', default=str(DEFAULT_PROMPTS))
    ap.add_argument('--font', default='')
    ap.add_argument('--force', action='store_true')
    args = ap.parse_args()

    prompts = json.loads(Path(args.prompts).read_text())
    font_path = find_font(args.font)
    done = json.loads(DONE_PATH.read_text()) if DONE_PATH.exists() else {}

    processed = skipped = missing = 0
    for item in prompts:
        filename = item.get('filename') or item.get('new_file')
        text = (item.get('text') or '').strip()
        if not filename or not text:
            continue
        image_path = IMAGES_DIR / filename
        if not image_path.exists():
            missing += 1
            continue
        if done.get(filename) == text and not args.force:
            skipped += 1
            continue
        add_caption(image_path, text, font_path)
        regenerate_thumb(image_path)
        done[filename] = text
        processed += 1
        print(f'✓ {filename}  「{text}」')

    DONE_PATH.write_text(json.dumps(done, ensure_ascii=False, indent=2))
    print(f'\n完成：烘焙 {processed} 张，跳过 {skipped} 张（已处理），{missing} 张图片还没生成')


if __name__ == '__main__':
    main()
