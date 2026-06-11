#!/usr/bin/env python3
"""
把 reference/ref-{1..13}.png 切割成单张表情入库。
- 自动去掉编号角标（彩色圆形徽章）
- 归一化文字去重（编号包优先）
- 输出 512px 图 + 缩略图 + ref-pack-prompts.json 元数据 + captioned.json
用法: python3 scripts/slice-ref-packs.py
依赖: pip3 install pillow numpy
"""
import json, os, re, unicodedata
from pathlib import Path
from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
REF = ROOT / 'assets/stickers/reference'
OUT = ROOT / 'assets/stickers/packs/style-bible-v1/images'
TH = ROOT / 'assets/stickers/packs/style-bible-v1/thumbs'
CONF = json.loads((REF / 'ref-pack-config.json').read_text())
CHAR = {'m': 'white_mochi', 'h': 'hamster', 'c': 'cat', 's': 'shiba'}
CHAR_CN = {'white_mochi': '白团子', 'hamster': '仓鼠', 'cat': '小猫', 'shiba': '柴犬'}

# 顺序敏感：先具体后宽泛
RULES = [
    (r'吃醋|我酸|介意|解释|心虚|负责|哄我|不理你|欠我的|看你表现|罚你|不许跑|你变了|怪我咯|你说怎么办|这题不会|记住了哦|不开心', 'jealous', 'jealousy'),
    (r'想你|想我|想见', 'missing', 'missing_you'),
    (r'等你|稍等', 'missing', 'waiting'),
    (r'抱抱|来抱', 'love', 'hug'),
    (r'亲亲|mua|比心|爱你|最爱|爱了', 'love', 'flirting'),
    (r'心动|犯规|拿捏|你猜|秘密|不告诉你|再想想|你先说|只给你|例外|偏心|特别|距离产生美|你好会|当真|想和你', 'flirt', 'flirting'),
    (r'害羞|脸红|wink', 'shy', 'flirting'),
    (r'么么哒|可爱|萌|乖|甜甜|眨眼|小可怜|撒娇|求你|拜托|花花|捏|噗噗|起飞|期待', 'shy', 'cute_acting'),
    (r'晚安|睡|熬夜|好梦', 'goodnight', 'good_night'),
    (r'早安|早上好|早呀|早睡', 'greeting', 'good_morning'),
    (r'加油|继续冲|冲鸭|打Call|点赞|很棒|真棒|最棒|超棒|你可以|一定行|相信自己|稳住|别慌|坚持|厉害|赞|牛哇|666|绝了|完美|太棒|好耶|搞定|好厉害', 'encourage', 'encouragement'),
    (r'辛苦|别太累|慢慢来|不着急|没事的|别难过|压力|照顾|会好起来|我在呢|陪着你|喝水|吃饭|身体|放松|路上小心', 'comfort', 'comfort'),
    (r'生气|气死|哼', 'angry', 'angry_complaint'),
    (r'哈哈|笑死|嘿嘿|耶|呵呵|吃瓜|开心', 'laugh', 'teasing'),
    (r'谢谢|感恩|感谢', 'thanks', 'thanks'),
    (r'躺平|累|发呆', 'sleepy', 'tired'),
    (r'emmm|啊\?|哈\?|无语|尴尬|离谱|绷不住|怕怕|爱咋咋地|真惨|汗', 'awkward', 'speechless'),
    (r'惊|哇塞|哇哦|哇', 'surprised', 'celebration'),
    (r'收到|好的|没问题|安排|OK|好哒|嗯嗯|对对对|了解|明白|行吧|懂了|可以|好家伙|我信了|真的吗|原来如此|这么巧|有点意思|太真实|我在听|然后呢|继续|展开|后来呢', 'happy', 'agree'),
    (r'拜拜|出发|到家|路上', 'happy', 'bye'),
]

def map_meta(text):
    for pat, emo, scen in RULES:
        if re.search(pat, text, re.I):
            return emo, scen
    return 'happy', 'greeting'

def norm(text):
    t = unicodedata.normalize('NFKC', text).lower()
    return re.sub(r'[~！!？?。.，,、…\s（）()｡·ωz々\-jpg]+', '', t)

def remove_badge(cell):
    """清空左上角编号徽章区：只保留近白背景与极深色文字，其余一律涂白"""
    a = np.array(cell.convert('RGB')).astype(int)
    h, w = a.shape[:2]
    zh, zw = int(h*0.24), int(w*0.26)
    region = a[:zh, :zw]
    v = region.max(axis=2)
    dark_text = v < 110           # 黑色文字（标题不会出现在最左上）
    near_white = region.min(axis=2) > 242
    kill = ~(dark_text | near_white)
    region[kill] = [255, 255, 255]
    # 徽章里的白色数字会留下碎点：把区域里孤立的深色小块也清掉
    a[:zh, :zw] = region
    return Image.fromarray(a.astype('uint8'))


def content_groups(mass, thresh=0.012, min_gap=6):
    """非白内容的连续块（按空白带分隔）"""
    groups, s = [], None
    for i, v in enumerate(mass > thresh):
        if v and s is None:
            s = i
        if not v and s is not None:
            groups.append([s, i]); s = None
    if s is not None:
        groups.append([s, len(mass)])
    # 合并极小空隙
    merged = []
    for g in groups:
        if merged and g[0] - merged[-1][1] < min_gap:
            merged[-1][1] = g[1]
        else:
            merged.append(g)
    return merged


def merge_to_n(groups, n):
    """不断合并相邻最小间隙，直到剩 n 组"""
    groups = [list(g) for g in groups]
    while len(groups) > n:
        gaps = [groups[i+1][0] - groups[i][1] for i in range(len(groups)-1)]
        k = gaps.index(min(gaps))
        groups[k][1] = groups[k+1][1]
        del groups[k+1]
    return groups


def detect_grid(arr, layout):
    """返回 (row_bands×4, col_bands×5)"""
    mask = (arr.min(axis=2) < 228)
    rows = content_groups(mask.mean(axis=1))
    while rows and rows[-1][1] - rows[-1][0] < 50:   # 只丢尾部矮块（底部注释）
        rows.pop()
    rows = merge_to_n(rows, 5)                       # 标题 + 4 行（文字带并入图带）
    row_bands = [tuple(g) for g in rows[1:]]
    region = mask[row_bands[0][0]:row_bands[-1][1]]
    cols = content_groups(region.mean(axis=0))
    cols = [g for g in cols if g[1] - g[0] >= 40]
    n_cols = 6 if layout == 'label' else 5           # label 版左侧有行标签列
    cols = merge_to_n(cols, n_cols)
    col_bands = [tuple(g) for g in (cols[1:] if layout == 'label' else cols)]
    return row_bands, col_bands

def finalize(crop):
    a = np.array(crop.convert('RGB'))
    bg = np.median(np.vstack([a[:4].reshape(-1, 3), a[-4:].reshape(-1, 3)]), axis=0)
    diff = np.abs(a.astype(int) - bg).sum(axis=2)
    ys, xs = np.where(diff > 40)
    if len(ys):
        pad = 8
        t, b = max(0, ys.min()-pad), min(a.shape[0], ys.max()+pad)
        l, r = max(0, xs.min()-pad), min(a.shape[1], xs.max()+pad)
        crop = Image.fromarray(a[t:b, l:r])
    side = max(crop.size) + 20
    canvas = Image.new('RGB', (side, side), 'white')
    canvas.paste(crop, ((side-crop.width)//2, (side-crop.height)//2))
    return canvas.resize((512, 512), Image.LANCZOS)

def main():
    OUT.mkdir(parents=True, exist_ok=True); TH.mkdir(parents=True, exist_ok=True)
    seen, items, skipped = {}, [], []
    hard_skip = set(CONF.get('skip', []))
    order = [1,2,3,4,5,6,7,8,9,13,10,11,12]  # 编号包优先
    for n in order:
        cfg = CONF[str(n)]
        img = Image.open(REF / f'ref-{n}.png').convert('RGB')
        arr = np.array(img)
        W, H = img.size
        row_bands, col_bands = detect_grid(arr, cfg['layout'])
        assert len(row_bands) == 4 and len(col_bands) == 5, f'ref-{n} 网格异常 {row_bands} {col_bands}'
        for i in range(20):
            r, c = divmod(i, 5)
            text = cfg['captions'][i]
            key = norm(text)
            tag = f'ref{n}#{i+1}'
            if tag in hard_skip:
                skipped.append(f'{tag} {text} (病句剔除)')
                continue
            if key in seen:
                skipped.append(f'{tag} {text} (重复于 {seen[key]})')
                continue
            (ry0, ry1), (cx0, cx1) = row_bands[r], col_bands[c]
            cell = img.crop((max(0, cx0-2), max(0, ry0-2), min(W, cx1+2), min(H, ry1+2)))
            if cfg['layout'] == 'numbered':
                cell = remove_badge(cell)
            final = finalize(cell)
            name = f'ref{n}_{i+1:02d}.png'
            final.save(OUT / name)
            th = final.copy(); th.thumbnail((160, 160)); th.save(TH / name)
            char = CHAR[cfg['chars'][i]]
            emo, scen = map_meta(text)
            items.append({'filename': name, 'priority': 'REF', 'character': char,
                          'emotion': emo, 'scenario': scen, 'text': text,
                          'tags': [char, CHAR_CN[char], cfg['title'], text.rstrip('~!！?？')],
                          'source': f'ref-{n} #{i+1}'})
            seen[key] = f'ref{n}#{i+1}'
    (ROOT/'assets/stickers/prompts/ref-pack-prompts.json').write_text(
        json.dumps(items, ensure_ascii=False, indent=2))
    (ROOT/'assets/stickers/packs/style-bible-v1/captioned.json').write_text(
        json.dumps({i['filename']: i['text'] for i in items}, ensure_ascii=False, indent=2))
    print(f'入库 {len(items)} 张，去重跳过 {len(skipped)} 张')
    for s in skipped: print('  跳过:', s)

if __name__ == '__main__':
    main()
