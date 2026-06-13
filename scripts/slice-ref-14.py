#!/usr/bin/env python3
"""
切割 reference/ref-14.png（表情包风格扩展包：问候祝福/道歉认错/感恩感谢/鼓励加油/日常可爱）。
网格：标题 + 5 行 × (左侧行标签列 + 6 列角色)。
输出 512px 图 + 缩略图 + assets/stickers/prompts/ref14-pack-prompts.json。
用法: python3 scripts/slice-ref-14.py
"""
import importlib.util
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('slice_ref_packs', ROOT / 'scripts/slice-ref-packs.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)  # 复用 content_groups / merge_to_n / finalize

OUT = ROOT / 'assets/stickers/packs/style-bible-v1/images'
TH = ROOT / 'assets/stickers/packs/style-bible-v1/thumbs'

# 列固定角色（按图从左到右）
COLUMN_CHARS = ['white_mochi', 'shiba', 'cat', 'fox', 'bunny', 'hamster']
CHAR_CN = {'white_mochi': '白团子', 'shiba': '柴犬', 'cat': '小猫', 'fox': '狐狸', 'bunny': '兔子', 'hamster': '仓鼠'}

# 行元数据：标题 / 每格文案 / emotion / scenario / scene / intent
ROWS = [
    {
        'title': '问候祝福',
        'cells': [
            ('早安呀~', 'greeting', 'good_morning', ['早安', '打招呼'], ['问候', '开启话题']),
            ('早上好！', 'greeting', 'good_morning', ['早安', '打招呼'], ['问候', '开启话题']),
            ('午安~', 'greeting', 'greeting', ['打招呼', '日常'], ['问候']),
            ('晚上好~', 'greeting', 'greeting', ['打招呼', '日常'], ['问候']),
            ('晚安啦~', 'goodnight', 'good_night', ['晚安', '睡觉', '结束聊天'], ['道晚安', '温柔收尾']),
            ('好梦~', 'goodnight', 'good_night', ['晚安', '睡觉', '结束聊天'], ['道晚安', '温柔收尾']),
        ],
    },
    {
        'title': '道歉认错',
        'cells': [
            ('对不起嘛~', 'apology', 'apology', ['道歉', '认错', '闹脾气', '吃醋'], ['道歉', '哄你']),
            ('我错啦~', 'apology', 'apology', ['道歉', '认错', '闹脾气', '吃醋'], ['道歉', '认错', '哄你']),
            ('抱歉抱歉~', 'apology', 'apology', ['道歉', '认错', '闹脾气'], ['道歉', '认错']),
            ('都是我的错~', 'apology', 'apology', ['道歉', '认错', '闹脾气', '吃醋'], ['道歉', '认错', '哄你']),
            ('对不起嘛~', 'apology', 'apology', ['道歉', '认错', '撒娇', '吃醋'], ['道歉', '撒娇', '哄你']),
            ('惹你生气了~', 'apology', 'apology', ['道歉', '认错', '闹脾气', '吃醋'], ['道歉', '哄你']),
        ],
    },
    {
        'title': '感恩感谢',
        'cells': [
            ('谢谢你~', 'thanks', 'thanks', ['感谢'], ['表达感谢']),
            ('太感谢啦！', 'thanks', 'thanks', ['感谢'], ['表达感谢']),
            ('非常感谢！', 'thanks', 'thanks', ['感谢'], ['表达感谢']),
            ('感恩有你！', 'thanks', 'thanks', ['感谢', '亲密'], ['表达感谢', '表达在乎']),
            ('谢谢你呀！', 'thanks', 'thanks', ['感谢'], ['表达感谢']),
            ('真的很谢谢！', 'thanks', 'thanks', ['感谢'], ['表达感谢']),
        ],
    },
    {
        'title': '鼓励加油',
        'cells': [
            ('加油鸭！', 'encourage', 'encouragement', ['鼓励', '夸夸'], ['鼓励', '打气']),
            ('你可以的！', 'encourage', 'encouragement', ['鼓励', '夸夸'], ['鼓励', '打气']),
            ('相信自己！', 'encourage', 'encouragement', ['鼓励', '夸夸'], ['鼓励', '打气']),
            ('别放弃！', 'encourage', 'encouragement', ['鼓励', '关心'], ['鼓励', '打气']),
            ('冲鸭！', 'encourage', 'encouragement', ['鼓励', '夸夸'], ['鼓励', '打气']),
            ('一定行！', 'encourage', 'encouragement', ['鼓励', '夸夸'], ['鼓励', '打气']),
        ],
    },
    {
        'title': '日常可爱',
        'cells': [
            ('嘿嘿~', 'laugh', 'teasing', ['玩笑', '搞怪', '卖萌'], ['接梗', '卖萌']),
            ('耶耶耶！', 'happy', 'celebration', ['庆祝', '开心'], ['一起开心']),
            ('嘻嘻~', 'laugh', 'teasing', ['玩笑', '搞怪', '卖萌'], ['接梗', '卖萌']),
            ('哇哦~', 'surprised', 'celebration', ['惊叹', '日常接话'], ['捧场', '回应分享']),
            ('开心~', 'happy', 'celebration', ['开心', '庆祝'], ['一起开心']),
            ('吃吃吃~', 'happy', 'teasing', ['开心', '玩笑', '日常接话'], ['接梗', '回应分享']),
        ],
    },
]


def detect_grid(img):
    arr = np.array(img)
    mask = (arr.min(axis=2) < 228)
    rows = base.content_groups(mask.mean(axis=1))
    rows = base.merge_to_n(rows, 6)  # 标题 + 5 行
    row_bands = [tuple(g) for g in rows[1:]]
    region = mask[row_bands[0][0]:row_bands[-1][1]]
    cols = base.content_groups(region.mean(axis=0))
    cols = [g for g in cols if g[1] - g[0] >= 40]
    cols = base.merge_to_n(cols, 7)  # 行标签列 + 6 列
    col_bands = [tuple(g) for g in cols[1:]]
    assert len(row_bands) == 5 and len(col_bands) == 6, f'ref-14 网格异常 {row_bands} {col_bands}'
    return row_bands, col_bands


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    TH.mkdir(parents=True, exist_ok=True)
    img = Image.open(ROOT / 'assets/stickers/reference/ref-14.png').convert('RGB')
    W, H = img.size
    row_bands, col_bands = detect_grid(img)

    items = []
    index = 0
    for r, row in enumerate(ROWS):
        (ry0, ry1) = row_bands[r]
        for c, (text, emotion, scenario, scene, intent) in enumerate(row['cells']):
            index += 1
            (cx0, cx1) = col_bands[c]
            cell = img.crop((max(0, cx0 - 2), max(0, ry0 - 2), min(W, cx1 + 2), min(H, ry1 + 2)))
            final = base.finalize(cell)
            name = f'ref14_{index:02d}.png'
            final.save(OUT / name)
            th = final.copy()
            th.thumbnail((160, 160))
            th.save(TH / name)
            char = COLUMN_CHARS[c]
            items.append({
                'filename': name,
                'priority': 'REF',
                'character': char,
                'emotion': emotion,
                'scenario': scenario,
                'text': text,
                'scene': scene,
                'intent': intent,
                'tags': [char, CHAR_CN[char], row['title'], text.rstrip('~!！?？')],
                'generic': False,
                'quality_score': 0.85,
                'usage_priority': 70,
                'source': f'ref-14 #{index}',
            })

    prompts_path = ROOT / 'assets/stickers/prompts/ref14-pack-prompts.json'
    prompts_path.write_text(json.dumps(items, ensure_ascii=False, indent=2))

    captioned_path = ROOT / 'assets/stickers/packs/style-bible-v1/captioned.json'
    captioned = json.loads(captioned_path.read_text()) if captioned_path.exists() else {}
    captioned.update({i['filename']: i['text'] for i in items})
    captioned_path.write_text(json.dumps(captioned, ensure_ascii=False, indent=2))
    print(f'入库 {len(items)} 张 → {prompts_path.name}')


if __name__ == '__main__':
    main()
