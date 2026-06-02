/* sticker.js — yuchaolove 表情包生成器
   10 种角色 × 10 种配色 = 100 个角色
   分析完自动推荐最合适的 6 个
*/

// ── 10 种配色主题 ─────────────────────────────────────────
const PALETTES = [
  { name: '经典',   main: '#FFD93D', light: '#FFF3A3', dark: '#FFA500', nose: '#FF8C00', ear: '#FFC107' },
  { name: '粉樱',   main: '#FFB6C1', light: '#FFE4E8', dark: '#FF69B4', nose: '#FF9EB5', ear: '#FFD6DC' },
  { name: '天蓝',   main: '#87CEEB', light: '#D0EEFF', dark: '#5BA4D0', nose: '#4A90D9', ear: '#B0DEFF' },
  { name: '抹茶',   main: '#8BC98B', light: '#CCEECC', dark: '#4CAF50', nose: '#388E3C', ear: '#A5D6A7' },
  { name: '珊瑚',   main: '#FF8A65', light: '#FFCCBC', dark: '#E64A19', nose: '#BF360C', ear: '#FFAB91' },
  { name: '薰衣草', main: '#CE93D8', light: '#F3E5F5', dark: '#9C27B0', nose: '#7B1FA2', ear: '#E1BEE7' },
  { name: '薄荷',   main: '#80DEEA', light: '#D4F5F9', dark: '#00838F', nose: '#006064', ear: '#B2EBF2' },
  { name: '奶茶',   main: '#D7BC95', light: '#F3E5CE', dark: '#A1724B', nose: '#795548', ear: '#EFCFA0' },
  { name: '梦幻',   main: '#F48FB1', light: '#FCE4EC', dark: '#C2185B', nose: '#AD1457', ear: '#F8BBD9' },
  { name: '纯银',   main: '#B0BEC5', light: '#ECEFF1', dark: '#607D8B', nose: '#455A64', ear: '#CFD8DC' },
];

// ── 10 种角色情感标签（用于推荐匹配）────────────────────
const CHAR_EMOTIONS = {
  chick:   ['happy','blush','shock'],
  cat:     ['cool','blush','happy'],
  hamster: ['happy','confused','blush'],
  pig:     ['happy','blush','sad'],
  bear:    ['happy','sad','cry'],
  rabbit:  ['happy','blush','shock'],
  frog:    ['happy','shock','confused'],
  figure:  ['confused','shock','sad'],
  dragon:  ['cool','angry','shock'],
  penguin: ['cool','sad','confused'],
};

// 配色情感倾向
const PALETTE_MOODS = {
  0: ['happy','shock'],      // 经典
  1: ['blush','happy'],      // 粉樱
  2: ['sad','confused'],     // 天蓝
  3: ['happy','cool'],       // 抹茶
  4: ['angry','shock'],      // 珊瑚
  5: ['blush','confused'],   // 薰衣草
  6: ['cool','confused'],    // 薄荷
  7: ['sad','blush'],        // 奶茶
  8: ['blush','happy'],      // 梦幻
  9: ['cool','sad'],         // 纯银
};

// ── 工具函数 ───────────────────────────────────────────────

function eyes(ctx, lx, ly, rx, ry, r, expr) {
  ctx.fillStyle = '#1a1a1a';
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineCap = 'round';
  switch (expr) {
    case 'happy': case 'blush': {
      ctx.lineWidth = r * 0.45;
      [lx, rx].forEach(x => { ctx.beginPath(); ctx.arc(x, ly + r * 0.4, r * 0.75, Math.PI, 0); ctx.stroke(); });
      break;
    }
    case 'sad': case 'cry': {
      [lx, rx].forEach(x => { ctx.beginPath(); ctx.ellipse(x, ly, r * 0.55, r * 0.8, 0, 0, Math.PI * 2); ctx.fill(); });
      if (expr === 'cry') {
        ctx.fillStyle = '#7ab8e8';
        [lx, rx].forEach(x => { ctx.beginPath(); ctx.ellipse(x, ly + r * 2.2, r * 0.35, r * 0.7, 0, 0, Math.PI * 2); ctx.fill(); });
        ctx.fillStyle = '#1a1a1a';
      }
      break;
    }
    case 'angry': {
      [lx, rx].forEach((x, i) => {
        ctx.beginPath(); ctx.ellipse(x, ly + r * 0.3, r * 0.8, r * 0.42, 0, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = r * 0.4;
        ctx.beginPath(); const bx = i === 0 ? 1 : -1;
        ctx.moveTo(x - r * 1.0, ly - r * 1.4); ctx.lineTo(x + r * bx * 0.4, ly - r * 0.5); ctx.stroke();
      });
      break;
    }
    case 'confused': {
      [lx, rx].forEach((x, i) => { ctx.beginPath(); ctx.arc(x, i === 0 ? ly : ly - r * 0.55, r * 0.62, 0, Math.PI * 2); ctx.fill(); });
      break;
    }
    case 'cool': {
      [lx, rx].forEach(x => { ctx.beginPath(); ctx.roundRect(x - r * 1.1, ly - r * 0.6, r * 2.2, r * 1.1, r * 0.3); ctx.fill(); });
      ctx.fillRect(lx + r * 1.1, ly - r * 0.4, rx - lx - r * 2.2, r * 0.55);
      break;
    }
    case 'shock': {
      ctx.lineWidth = r * 0.38;
      [lx, rx].forEach(x => {
        ctx.beginPath(); ctx.arc(x, ly, r * 0.92, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(x, ly, r * 0.4, 0, Math.PI * 2); ctx.fill();
      });
      break;
    }
    default: {
      [lx, rx].forEach(x => { ctx.beginPath(); ctx.arc(x, ly, r * 0.62, 0, Math.PI * 2); ctx.fill(); });
    }
  }
}

function mouth(ctx, x, y, r, expr) {
  ctx.strokeStyle = '#1a1a1a'; ctx.fillStyle = '#1a1a1a';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  switch (expr) {
    case 'happy': case 'blush': { ctx.lineWidth = r * 0.42; ctx.beginPath(); ctx.arc(x, y - r * 0.4, r * 0.78, 0.15, Math.PI - 0.15); ctx.stroke(); break; }
    case 'sad': case 'cry': { ctx.lineWidth = r * 0.42; ctx.beginPath(); ctx.arc(x, y + r * 0.5, r * 0.72, Math.PI + 0.2, -0.2); ctx.stroke(); break; }
    case 'angry': { ctx.lineWidth = r * 0.4; ctx.beginPath(); ctx.moveTo(x - r * 0.7, y + r * 0.1); ctx.lineTo(x + r * 0.7, y - r * 0.1); ctx.stroke(); break; }
    case 'confused': { ctx.lineWidth = r * 0.38; ctx.beginPath(); ctx.moveTo(x - r * 0.6, y + r * 0.2); ctx.bezierCurveTo(x - r * 0.2, y - r * 0.3, x + r * 0.2, y + r * 0.5, x + r * 0.6, y); ctx.stroke(); break; }
    case 'shock': { ctx.beginPath(); ctx.ellipse(x, y, r * 0.45, r * 0.65, 0, 0, Math.PI * 2); ctx.fill(); break; }
    case 'cool': { ctx.lineWidth = r * 0.35; ctx.beginPath(); ctx.moveTo(x - r * 0.6, y + r * 0.1); ctx.lineTo(x + r * 0.6, y - r * 0.1); ctx.stroke(); break; }
    default: { ctx.lineWidth = r * 0.35; ctx.beginPath(); ctx.moveTo(x - r * 0.5, y); ctx.lineTo(x + r * 0.5, y); ctx.stroke(); }
  }
}

function blush(ctx, lx, rx, y) {
  ctx.fillStyle = 'rgba(255,130,130,0.32)';
  ctx.beginPath(); ctx.ellipse(lx, y, 14, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(rx, y, 14, 8, 0, 0, Math.PI * 2); ctx.fill();
}

// ── 10 种角色（接收配色 pal）────────────────────────────

function drawChick(ctx, cx, cy, expr, pal) {
  ctx.fillStyle = pal.main;
  ctx.beginPath(); ctx.ellipse(cx, cy + 32, 62, 55, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = pal.ear;
  ctx.beginPath(); ctx.ellipse(cx - 58, cy + 18, 14, 28, -0.45, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + 58, cy + 18, 14, 28, 0.45, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = pal.main;
  ctx.beginPath(); ctx.arc(cx, cy - 18, 46, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = pal.ear;
  [[-10,-63],[2,-67],[14,-62]].forEach(([dx,dy]) => { ctx.beginPath(); ctx.arc(cx+dx, cy+dy, 7, 0, Math.PI*2); ctx.fill(); });
  ctx.fillStyle = pal.dark;
  ctx.beginPath(); ctx.moveTo(cx-9,cy-14); ctx.lineTo(cx+9,cy-14); ctx.lineTo(cx,cy-5); ctx.closePath(); ctx.fill();
  eyes(ctx, cx-16, cy-26, cx+16, cy-26, 7, expr);
  mouth(ctx, cx, cy-4, 8, expr);
  if (expr==='blush') blush(ctx, cx-28, cx+28, cy-16);
  ctx.strokeStyle = pal.dark; ctx.lineWidth = 3; ctx.lineCap = 'round';
  [[-18,1],[18,-1]].forEach(([dx,s]) => {
    const fx=cx+dx, fy=cy+87;
    ctx.beginPath(); ctx.moveTo(fx,fy-12); ctx.lineTo(fx,fy); ctx.stroke();
    [[-12,7],[0,9],[10,6]].forEach(([tx,ty]) => { ctx.beginPath(); ctx.moveTo(fx,fy); ctx.lineTo(fx+tx+s,fy+ty); ctx.stroke(); });
  });
}

function drawCat(ctx, cx, cy, expr, pal) {
  ctx.fillStyle = pal.main;
  ctx.beginPath(); ctx.ellipse(cx, cy+30, 58, 52, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy-16, 44, 0, Math.PI*2); ctx.fill();
  [[-1,1],[1,-1]].forEach(([sign, _]) => {
    const bx = cx + sign*44;
    ctx.beginPath(); ctx.moveTo(bx, cy-30); ctx.lineTo(bx+sign*12, cy-72); ctx.lineTo(cx+sign*20, cy-46); ctx.closePath(); ctx.fill();
  });
  ctx.fillStyle = pal.light;
  [[-1,1],[1,-1]].forEach(([sign, _]) => {
    const bx = cx + sign*41;
    ctx.beginPath(); ctx.moveTo(bx, cy-34); ctx.lineTo(bx+sign*10, cy-65); ctx.lineTo(cx+sign*23, cy-44); ctx.closePath(); ctx.fill();
  });
  ctx.fillStyle = pal.ear;
  ctx.beginPath(); ctx.arc(cx, cy-10, 5, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = 'rgba(100,100,100,0.4)'; ctx.lineWidth = 1.5;
  [[-1,0],[-1,1],[1,0],[1,1]].forEach(([d,s]) => { ctx.beginPath(); ctx.moveTo(cx+d*8,cy-10); ctx.lineTo(cx+d*46,cy-10+s*5); ctx.stroke(); });
  ctx.strokeStyle = pal.dark; ctx.lineWidth = 9; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx+56,cy+55); ctx.bezierCurveTo(cx+85,cy+70,cx+80,cy+92,cx+55,cy+88); ctx.stroke();
  eyes(ctx, cx-17, cy-24, cx+17, cy-24, 7, expr);
  mouth(ctx, cx, cy, 8, expr);
  if (expr==='blush') blush(ctx, cx-28, cx+28, cy-14);
}

function drawHamster(ctx, cx, cy, expr, pal) {
  ctx.fillStyle = pal.light;
  ctx.beginPath(); ctx.ellipse(cx-52, cy-4, 30, 26, -0.2, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx+52, cy-4, 30, 26, 0.2, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = pal.main;
  ctx.beginPath(); ctx.ellipse(cx, cy+32, 55, 50, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy-14, 42, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx-34, cy-50, 17, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+34, cy-50, 17, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = pal.ear;
  ctx.beginPath(); ctx.arc(cx-34, cy-50, 10, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+34, cy-50, 10, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = pal.dark;
  ctx.beginPath(); ctx.arc(cx, cy-10, 4, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = pal.main;
  ctx.beginPath(); ctx.arc(cx-44, cy+48, 12, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+44, cy+48, 12, 0, Math.PI*2); ctx.fill();
  eyes(ctx, cx-15, cy-23, cx+15, cy-23, 7, expr);
  mouth(ctx, cx, cy-1, 7, expr);
  if (expr==='blush') {
    ctx.fillStyle='rgba(255,130,130,0.32)';
    ctx.beginPath(); ctx.ellipse(cx-52,cy+2,18,10,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx+52,cy+2,18,10,0,0,Math.PI*2); ctx.fill();
  }
}

function drawPig(ctx, cx, cy, expr, pal) {
  ctx.fillStyle = pal.main;
  ctx.beginPath(); ctx.ellipse(cx, cy+30, 62, 56, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy-14, 46, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = pal.ear;
  ctx.beginPath(); ctx.ellipse(cx-40, cy-52, 17, 21, -0.3, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx+40, cy-52, 17, 21, 0.3, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = pal.light;
  ctx.beginPath(); ctx.ellipse(cx-40, cy-52, 10, 13, -0.3, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx+40, cy-52, 10, 13, 0.3, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = pal.ear;
  ctx.beginPath(); ctx.ellipse(cx, cy-2, 26, 19, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = pal.dark;
  ctx.beginPath(); ctx.ellipse(cx-9,cy-2,5,4,0.3,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx+9,cy-2,5,4,-0.3,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle = pal.ear; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx+60,cy+20); ctx.bezierCurveTo(cx+82,cy+8,cx+92,cy+34,cx+72,cy+40); ctx.stroke();
  ctx.fillStyle = pal.main;
  ctx.beginPath(); ctx.ellipse(cx-66,cy+28,14,22,0.5,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx+66,cy+28,14,22,-0.5,0,Math.PI*2); ctx.fill();
  eyes(ctx, cx-20, cy-27, cx+20, cy-27, 7, expr);
  mouth(ctx, cx, cy+14, 8, expr);
  if (expr==='blush') blush(ctx, cx-32, cx+32, cy-16);
}

function drawBear(ctx, cx, cy, expr, pal) {
  ctx.fillStyle = pal.main;
  ctx.beginPath(); ctx.ellipse(cx, cy+30, 60, 55, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = pal.light;
  ctx.beginPath(); ctx.ellipse(cx, cy+35, 36, 36, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = pal.main;
  ctx.beginPath(); ctx.arc(cx, cy-12, 44, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx-36, cy-50, 20, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+36, cy-50, 20, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = pal.light;
  ctx.beginPath(); ctx.arc(cx-36, cy-50, 12, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+36, cy-50, 12, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = pal.light;
  ctx.beginPath(); ctx.ellipse(cx, cy-1, 24, 18, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = pal.dark;
  ctx.beginPath(); ctx.arc(cx, cy-8, 5, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = pal.main;
  ctx.beginPath(); ctx.ellipse(cx-62,cy+38,17,13,0.6,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx+62,cy+38,17,13,-0.6,0,Math.PI*2); ctx.fill();
  eyes(ctx, cx-17, cy-22, cx+17, cy-22, 7, expr);
  mouth(ctx, cx, cy+6, 8, expr);
  if (expr==='blush') blush(ctx, cx-30, cx+30, cy-12);
}

function drawRabbit(ctx, cx, cy, expr, pal) {
  ctx.fillStyle = pal.main;
  ctx.beginPath(); ctx.ellipse(cx-20, cy-70, 12, 38, -0.15, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx+20, cy-70, 12, 38, 0.15, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = pal.ear;
  ctx.beginPath(); ctx.ellipse(cx-20, cy-70, 7, 28, -0.15, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx+20, cy-70, 7, 28, 0.15, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = pal.main;
  ctx.beginPath(); ctx.ellipse(cx, cy+28, 54, 54, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy-14, 43, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+50, cy+52, 12, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = pal.ear;
  ctx.beginPath(); ctx.arc(cx, cy-10, 5, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = pal.main;
  ctx.beginPath(); ctx.ellipse(cx-50,cy+22,13,19,0.5,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx+50,cy+22,13,19,-0.5,0,Math.PI*2); ctx.fill();
  eyes(ctx, cx-16, cy-23, cx+16, cy-23, 7, expr);
  mouth(ctx, cx, cy-1, 7, expr);
  if (expr==='blush') blush(ctx, cx-28, cx+28, cy-14);
}

function drawFrog(ctx, cx, cy, expr, pal) {
  ctx.fillStyle = pal.main;
  ctx.beginPath(); ctx.ellipse(cx, cy+32, 62, 54, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = pal.light;
  ctx.beginPath(); ctx.ellipse(cx, cy+36, 40, 34, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = pal.main;
  ctx.beginPath(); ctx.arc(cx, cy-10, 46, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx-28, cy-50, 20, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+28, cy-50, 20, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx-60,cy+28,13,20,0.6,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx+60,cy+28,13,20,-0.6,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx-58,cy+68,20,13,-0.7,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx+58,cy+68,20,13,0.7,0,Math.PI*2); ctx.fill();
  eyes(ctx, cx-28, cy-54, cx+28, cy-54, 8, expr);
  mouth(ctx, cx, cy+4, 11, expr);
  if (expr==='blush') blush(ctx, cx-34, cx+34, cy-6);
}

function drawFigure(ctx, cx, cy, expr, pal) {
  ctx.fillStyle = pal.main; ctx.strokeStyle = pal.dark; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(cx, cy+36, 40, 48, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy-16, 38, 0, Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = pal.dark; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
  if (expr === 'confused') {
    ctx.beginPath(); ctx.moveTo(cx-38,cy+18); ctx.lineTo(cx-62,cy+2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx+38,cy+18); ctx.lineTo(cx+60,cy-16); ctx.stroke();
    ctx.fillStyle = '#999'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('???', cx+55, cy-28);
  } else if (expr === 'shock') {
    ctx.beginPath(); ctx.moveTo(cx-38,cy+18); ctx.lineTo(cx-65,cy-5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx+38,cy+18); ctx.lineTo(cx+65,cy-5); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(cx-38,cy+18); ctx.lineTo(cx-62,cy+38); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx+38,cy+18); ctx.lineTo(cx+62,cy+38); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(cx-17,cy+82); ctx.lineTo(cx-26,cy+108); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx+17,cy+82); ctx.lineTo(cx+26,cy+108); ctx.stroke();
  eyes(ctx, cx-13, cy-21, cx+13, cy-21, 6, expr);
  mouth(ctx, cx, cy-6, 7, expr);
  if (expr==='blush') blush(ctx, cx-24, cx+24, cy-13);
}

function drawDragon(ctx, cx, cy, expr, pal) {
  ctx.fillStyle = pal.main;
  ctx.beginPath(); ctx.moveTo(cx-52,cy-8); ctx.bezierCurveTo(cx-100,cy-55,cx-90,cy+22,cx-58,cy+12); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx+52,cy-8); ctx.bezierCurveTo(cx+100,cy-55,cx+90,cy+22,cx+58,cy+12); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx, cy+30, 56, 52, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = pal.light;
  ctx.beginPath(); ctx.ellipse(cx, cy+34, 34, 33, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = pal.main;
  ctx.beginPath(); ctx.arc(cx, cy-12, 44, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#FFD700';
  ctx.beginPath(); ctx.moveTo(cx-24,cy-52); ctx.lineTo(cx-18,cy-80); ctx.lineTo(cx-10,cy-52); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx+10,cy-52); ctx.lineTo(cx+18,cy-80); ctx.lineTo(cx+24,cy-52); ctx.closePath(); ctx.fill();
  ctx.fillStyle = pal.light;
  ctx.beginPath(); ctx.ellipse(cx, cy-1, 24, 17, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = pal.ear;
  ctx.beginPath(); ctx.arc(cx-8,cy-1,4,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+8,cy-1,4,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle = pal.main; ctx.lineWidth = 8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx+54,cy+48); ctx.bezierCurveTo(cx+88,cy+68,cx+78,cy+90,cx+50,cy+84); ctx.stroke();
  eyes(ctx, cx-16, cy-24, cx+16, cy-24, 7, expr);
  mouth(ctx, cx, cy+11, 8, expr);
  if (expr==='blush') blush(ctx, cx-28, cx+28, cy-12);
}

function drawPenguin(ctx, cx, cy, expr, pal) {
  ctx.fillStyle = pal.dark;
  ctx.beginPath(); ctx.ellipse(cx, cy+28, 52, 58, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = pal.light;
  ctx.beginPath(); ctx.ellipse(cx, cy+32, 32, 46, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = pal.dark;
  ctx.beginPath(); ctx.arc(cx, cy-18, 38, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = pal.light;
  ctx.beginPath(); ctx.ellipse(cx, cy-14, 25, 27, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = pal.main;
  ctx.beginPath(); ctx.moveTo(cx-6,cy-18); ctx.lineTo(cx+6,cy-18); ctx.lineTo(cx,cy-10); ctx.closePath(); ctx.fill();
  ctx.fillStyle = pal.dark;
  ctx.beginPath(); ctx.ellipse(cx-54,cy+14,13,34,0.4,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx+54,cy+14,13,34,-0.4,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = pal.main;
  ctx.beginPath(); ctx.ellipse(cx-18,cy+84,17,9,-0.3,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx+18,cy+84,17,9,0.3,0,Math.PI*2); ctx.fill();
  eyes(ctx, cx-13, cy-27, cx+13, cy-27, 6, expr);
  mouth(ctx, cx, cy-8, 6, expr);
  if (expr==='blush') blush(ctx, cx-22, cx+22, cy-18);
}

// ── 100 个角色库 ──────────────────────────────────────────

const BASE_CHARS = [
  { id: 'chick',   name: '小黄鸡', draw: drawChick,   emotions: ['happy','blush','shock','happy','blush'] },
  { id: 'cat',     name: '猫咪',   draw: drawCat,     emotions: ['cool','blush','happy','cool','confused'] },
  { id: 'hamster', name: '仓鼠',   draw: drawHamster, emotions: ['happy','confused','blush','happy','sad'] },
  { id: 'pig',     name: '小猪',   draw: drawPig,     emotions: ['happy','blush','sad','happy','blush'] },
  { id: 'bear',    name: '小熊',   draw: drawBear,    emotions: ['happy','sad','cry','happy','confused'] },
  { id: 'rabbit',  name: '小兔',   draw: drawRabbit,  emotions: ['happy','blush','shock','happy','cool'] },
  { id: 'frog',    name: '小青蛙', draw: drawFrog,    emotions: ['happy','shock','confused','angry','happy'] },
  { id: 'figure',  name: '小白人', draw: drawFigure,  emotions: ['confused','shock','sad','confused','angry'] },
  { id: 'dragon',  name: '小龙',   draw: drawDragon,  emotions: ['cool','angry','shock','cool','happy'] },
  { id: 'penguin', name: '企鹅',   draw: drawPenguin, emotions: ['cool','sad','confused','cool','blush'] },
];

const STICKER_LIBRARY = [];
BASE_CHARS.forEach((base, bi) => {
  PALETTES.forEach((pal, pi) => {
    STICKER_LIBRARY.push({
      id: `${base.id}-${pi}`,
      name: `${base.name}·${pal.name}`,
      charIdx: bi, paletteIdx: pi,
      baseId: base.id,
      draw: (ctx, cx, cy, expr) => base.draw(ctx, cx, cy, expr, pal),
      emotions: base.emotions,
      paletteMoods: PALETTE_MOODS[pi],
    });
  });
});

// ── 推荐系统 ──────────────────────────────────────────────

const EXPR_KEYWORDS = {
  happy:    ['感兴趣','喜欢','热情','积极','心动','很好','活跃','主动'],
  blush:    ['暧昧','含蓄','欲拒','撩','暗示','矜持'],
  sad:      ['冷淡','敷衍','消极','不感兴趣','无聊'],
  cry:      ['拒绝','止损','停止','伤心','难过'],
  angry:    ['愤怒','生气','不满','抗拒'],
  confused: ['不明','待判断','模糊','混乱','疑惑'],
  cool:     ['自信','独立','高冷','淡定'],
  shock:    ['惊讶','突然','意外','震惊'],
};

function attitudeToExpr(label) {
  const l = label || '';
  for (const [expr, keywords] of Object.entries(EXPR_KEYWORDS)) {
    if (keywords.some(k => l.includes(k))) return expr;
  }
  return 'happy';
}

function scoreSticker(sticker, targetExpr) {
  let score = 0;
  if (sticker.emotions.includes(targetExpr)) score += 3;
  if (sticker.paletteMoods.includes(targetExpr)) score += 2;
  if (sticker.emotions[0] === targetExpr) score += 1;
  return score;
}

function getRecommended(attitudeLabel, count = 6) {
  const expr = attitudeToExpr(attitudeLabel);
  const scored = STICKER_LIBRARY.map(s => ({ ...s, score: scoreSticker(s, expr) + Math.random() * 0.5 }));
  scored.sort((a, b) => b.score - a.score);

  // 保证角色多样性（每种 base 最多出现 1 次）
  const seen = new Set();
  const result = [];
  for (const s of scored) {
    if (!seen.has(s.baseId)) {
      seen.add(s.baseId);
      result.push({ ...s, expr });
      if (result.length >= count) break;
    }
  }
  // 如果不够 6 个，补充（允许重复 base）
  if (result.length < count) {
    for (const s of scored) {
      if (!result.find(r => r.id === s.id)) {
        result.push({ ...s, expr });
        if (result.length >= count) break;
      }
    }
  }
  return result;
}

// ── 背景 & 文字 ────────────────────────────────────────────

const BG_COLORS = [
  '#FFF9F0','#F0F9FF','#F0FFF4','#FFF0F5',
  '#FFFFF0','#F5F0FF','#FFF5EE','#F0FFFF',
  '#FDF6FF','#F8FFF0',
];
const BG_PATTERNS = [null,'dots','hearts','stars',null,'dots','hearts','stars',null,'dots'];

function drawBg(ctx, size, colorIdx, patternIdx) {
  ctx.fillStyle = BG_COLORS[colorIdx % BG_COLORS.length];
  ctx.fillRect(0, 0, size, size);
  const p = BG_PATTERNS[patternIdx % BG_PATTERNS.length];
  if (p === 'dots') {
    ctx.fillStyle = 'rgba(0,0,0,0.04)';
    for (let x=18;x<size;x+=22) for (let y=18;y<size;y+=22) { ctx.beginPath(); ctx.arc(x,y,2.2,0,Math.PI*2); ctx.fill(); }
  } else if (p === 'hearts') {
    ctx.fillStyle = 'rgba(255,130,130,0.13)';
    ctx.font = '13px sans-serif'; ctx.textAlign = 'left';
    for (let x=8;x<size;x+=32) for (let y=20;y<size;y+=32) ctx.fillText('♥',x,y);
  } else if (p === 'stars') {
    ctx.fillStyle = 'rgba(255,190,0,0.18)';
    ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
    for (let x=8;x<size;x+=28) for (let y=20;y<size;y+=28) ctx.fillText('✦',x,y);
  }
}

function drawStickerText(ctx, text, size) {
  if (!text) return;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const fontSize = text.length > 8 ? 17 : text.length > 5 ? 19 : 21;
  ctx.font = `bold ${fontSize}px "Noto Sans SC", sans-serif`;
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 5; ctx.lineJoin = 'round';
  ctx.strokeText(text, size/2, size - 26);
  ctx.fillStyle = '#3a2e28';
  ctx.fillText(text, size/2, size - 26);
}

function makeStickerCanvas(sticker, text, size) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  drawBg(ctx, size, sticker.paletteIdx, sticker.charIdx);
  sticker.draw(ctx, size/2, size/2 - 18, sticker.expr);
  drawStickerText(ctx, text, size);
  return c;
}

// ── 主入口：分析完自动调用 ────────────────────────────────

function showStickerPanel(attitudeLabel) {
  const panel = document.getElementById('stickerPanel');
  const grid = document.getElementById('stickerGrid');
  if (!panel || !grid) return;

  const text = attitudeLabel || 'yuchaolove';
  const recommended = getRecommended(attitudeLabel, 6);

  grid.innerHTML = '';
  recommended.forEach(sticker => {
    const thumb = makeStickerCanvas(sticker, text, 150);
    thumb.className = 'sticker-thumb';
    thumb.title = sticker.name;

    thumb.addEventListener('click', () => showStickerModal(sticker, text));

    const wrap = document.createElement('div');
    wrap.className = 'sticker-wrap';
    const lbl = document.createElement('div');
    lbl.className = 'sticker-char-name';
    lbl.textContent = sticker.name;
    wrap.append(thumb, lbl);
    grid.appendChild(wrap);
  });

  panel.style.display = 'block';
  setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
}

// 弹出大图
function showStickerModal(sticker, text) {
  let modal = document.getElementById('stickerModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'stickerModal';
    modal.className = 'sticker-modal';
    modal.innerHTML = `
      <div class="sticker-modal-box">
        <button class="sticker-modal-close" onclick="closeStickerModal()">✕</button>
        <div id="stickerModalCanvas"></div>
        <div class="sticker-modal-name" id="stickerModalName"></div>
        <button class="sticker-dl-btn" id="stickerDlBtn">⬇ 下载表情包</button>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) closeStickerModal(); });
  }

  const large = makeStickerCanvas(sticker, text, 360);
  large.style.cssText = 'border-radius:20px;display:block;max-width:100%;';
  document.getElementById('stickerModalCanvas').replaceChildren(large);
  document.getElementById('stickerModalName').textContent = sticker.name;
  document.getElementById('stickerDlBtn').onclick = () => {
    large.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `yuchaolove-${sticker.id}.png`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  };
  modal.style.display = 'flex';
}

function closeStickerModal() {
  const m = document.getElementById('stickerModal');
  if (m) m.style.display = 'none';
}
