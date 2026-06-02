/* yuchaolove - sticker.js
   15 animated canvas characters. Warm cream/brown palette.
   GIF export via gif.js CDN.
*/

// ─── Palettes ─────────────────────────────────────────────────────────────────
const SCENE_PALETTES = {
  phone:     { bg: '#FFF7EE', body: '#F8EDD8', fur: '#C8926A', dark: '#3C2010', cheek: 'rgba(238,148,108,0.42)', accent: '#C07840', text: '#2a1808' },
  skeptical: { bg: '#FFF2F6', body: '#F8EDD8', fur: '#C8887A', dark: '#3C1818', cheek: 'rgba(238,140,155,0.40)', accent: '#C06878', text: '#281010' },
  confused:  { bg: '#F5F3FF', body: '#F8EDD8', fur: '#9A84C8', dark: '#281040', cheek: 'rgba(178,152,248,0.38)', accent: '#8060C0', text: '#1a1038' },
  caring:    { bg: '#F2FFF6', body: '#F8EDD8', fur: '#72B888', dark: '#183828', cheek: 'rgba(100,210,140,0.38)', accent: '#40A868', text: '#0e2018' },
  shocked:   { bg: '#FFF6EE', body: '#F8EDD8', fur: '#C89258', dark: '#3C2008', cheek: 'rgba(245,168,108,0.42)', accent: '#C07030', text: '#281408' },
  retreat:   { bg: '#F4F4FF', body: '#F8EDD8', fur: '#8888B8', dark: '#181840', cheek: 'rgba(138,138,215,0.35)', accent: '#6868A8', text: '#101030' },
  peek:      { bg: '#FFF0FC', body: '#F8EDD8', fur: '#C870A8', dark: '#380830', cheek: 'rgba(238,118,192,0.38)', accent: '#C050A0', text: '#28082a' },
  happy:     { bg: '#FFFAEE', body: '#F8EDD8', fur: '#D4A848', dark: '#3C2808', cheek: 'rgba(248,188,88,0.42)', accent: '#D09030', text: '#2a1a00' },
  blush:     { bg: '#FFF0F4', body: '#F8EDD8', fur: '#E8A0B8', dark: '#3C1028', cheek: 'rgba(248,148,178,0.45)', accent: '#E070A0', text: '#280818' },
  sleepy:    { bg: '#F0F4FF', body: '#F8EDD8', fur: '#8898C8', dark: '#181838', cheek: 'rgba(138,152,225,0.35)', accent: '#6070A8', text: '#101030' },
  cheer:     { bg: '#FFF4EC', body: '#F8EDD8', fur: '#C87848', dark: '#3C1808', cheek: 'rgba(238,158,118,0.42)', accent: '#C06830', text: '#281000' },
  love:      { bg: '#FFF0F8', body: '#F8EDD8', fur: '#E890B8', dark: '#381030', cheek: 'rgba(248,138,188,0.42)', accent: '#D86098', text: '#280820' },
  think:     { bg: '#F6F2FF', body: '#F8EDD8', fur: '#A888D0', dark: '#281048', cheek: 'rgba(188,158,245,0.38)', accent: '#9060C8', text: '#1a1040' },
  sob:       { bg: '#F0F4FF', body: '#F8EDD8', fur: '#7890C0', dark: '#182040', cheek: 'rgba(118,155,218,0.35)', accent: '#5070B0', text: '#101830' },
  shrug:     { bg: '#FFF8F0', body: '#F8EDD8', fur: '#C89870', dark: '#3C2818', cheek: 'rgba(238,168,118,0.40)', accent: '#B88048', text: '#2a1808' },
};

// ─── Shared face helpers ──────────────────────────────────────────────────────

function drawEyes(ctx, cx, ey, r, pal, expr) {
  const span = r * 0.3, er = r * 0.09;
  ctx.fillStyle = pal.dark;

  if (expr === 'lazy') {
    ctx.strokeStyle = pal.dark; ctx.lineWidth = r * 0.07; ctx.lineCap = 'round';
    [-span, span].forEach((dx) => { ctx.beginPath(); ctx.arc(cx+dx, ey+er*0.4, er*0.9, Math.PI, 0); ctx.stroke(); });

  } else if (expr === 'happy') {
    ctx.strokeStyle = pal.dark; ctx.lineWidth = r * 0.07; ctx.lineCap = 'round';
    [-span, span].forEach((dx) => { ctx.beginPath(); ctx.arc(cx+dx, ey+er*0.3, er*0.9, Math.PI+0.25, -0.25); ctx.stroke(); });

  } else if (expr === 'shocked') {
    [-span, span].forEach((dx) => {
      ctx.beginPath(); ctx.arc(cx+dx, ey, er*1.4, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.beginPath(); ctx.arc(cx+dx-er*0.38, ey-er*0.38, er*0.52, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = pal.dark;
    });

  } else if (expr === 'skeptical') {
    [-span, span].forEach((dx, i) => {
      ctx.beginPath(); ctx.arc(cx+dx, ey+(i===0?-er*0.45:0), er, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.beginPath(); ctx.arc(cx+dx-er*0.28, ey+(i===0?-er*0.75:-er*0.28), er*0.33, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = pal.dark;
    });
    ctx.strokeStyle = pal.dark; ctx.lineWidth = r*0.05; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx-span-er, ey-er*1.75); ctx.quadraticCurveTo(cx-span, ey-er*2.3, cx-span+er, ey-er*1.75); ctx.stroke();

  } else if (expr === 'confused') {
    [-span, span].forEach((dx, i) => {
      ctx.beginPath(); ctx.arc(cx+dx, ey+(i===0?-er*0.38:er*0.38), er, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(cx+dx-er*0.28, ey+(i===0?-er*0.68:er*0.08), er*0.33, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = pal.dark;
    });

  } else if (expr === 'caring') {
    [-span, span].forEach((dx) => {
      ctx.beginPath(); ctx.arc(cx+dx, ey, er*1.05, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(cx+dx-er*0.3, ey-er*0.3, er*0.36, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = pal.dark;
    });
    ctx.strokeStyle = pal.dark; ctx.lineWidth = r*0.048; ctx.lineCap = 'round';
    [-span, span].forEach((dx, i) => {
      ctx.beginPath(); ctx.moveTo(cx+dx-er, ey-er*1.5); ctx.quadraticCurveTo(cx+dx, ey-er*1.85+(i===0?er*0.28:0), cx+dx+er, ey-er*1.5); ctx.stroke();
    });

  } else if (expr === 'peek') {
    [-span, span].forEach((dx) => {
      ctx.beginPath(); ctx.arc(cx+dx, ey, er*1.1, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(cx+dx-er*0.2, ey-er*0.5, er*0.38, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = pal.dark;
    });

  } else if (expr === 'retreat') {
    [-span, span].forEach((dx) => {
      ctx.beginPath(); ctx.arc(cx+dx, ey, er, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(cx+dx+er*0.28, ey-er*0.28, er*0.33, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = pal.dark;
    });

  } else if (expr === 'heart') {
    // Heart-shaped eyes
    [-span, span].forEach((dx) => {
      const hx = cx+dx, hy = ey, hr = er*1.05;
      ctx.fillStyle = pal.accent;
      ctx.beginPath();
      ctx.moveTo(hx, hy+hr*0.8);
      ctx.bezierCurveTo(hx-hr*1.5, hy-hr*0.3, hx-hr*1.5, hy-hr*1.2, hx, hy-hr*0.3);
      ctx.bezierCurveTo(hx+hr*1.5, hy-hr*1.2, hx+hr*1.5, hy-hr*0.3, hx, hy+hr*0.8);
      ctx.fill();
    });

  } else if (expr === 'sleepy') {
    // Very droopy half-closed
    ctx.strokeStyle = pal.dark; ctx.lineWidth = r*0.065; ctx.lineCap = 'round';
    [-span, span].forEach((dx) => {
      ctx.beginPath(); ctx.arc(cx+dx, ey+er*0.6, er*0.82, Math.PI+0.1, -0.1); ctx.stroke();
    });

  } else if (expr === 'determined') {
    // Pumped-up determined eyes
    [-span, span].forEach((dx) => {
      ctx.beginPath(); ctx.arc(cx+dx, ey, er*0.9, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.arc(cx+dx-er*0.25, ey-er*0.25, er*0.3, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = pal.dark;
    });
    ctx.strokeStyle = pal.dark; ctx.lineWidth = r*0.055; ctx.lineCap = 'round';
    [-span, span].forEach((dx, i) => {
      ctx.beginPath();
      ctx.moveTo(cx+dx-er, ey-er*1.6+(i===0?er*0.3:0));
      ctx.lineTo(cx+dx+er, ey-er*1.6+(i===0?0:er*0.3));
      ctx.stroke();
    });

  } else if (expr === 'cry') {
    // Sad closed lines with tears
    ctx.strokeStyle = pal.dark; ctx.lineWidth = r*0.06; ctx.lineCap = 'round';
    [-span, span].forEach((dx) => {
      ctx.beginPath(); ctx.moveTo(cx+dx-er, ey); ctx.lineTo(cx+dx+er, ey); ctx.stroke();
      ctx.fillStyle = '#90b8ff';
      ctx.beginPath(); ctx.arc(cx+dx, ey+er*2.0, er*0.55, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = pal.dark;
    });

  } else if (expr === 'think') {
    // Thoughtful slightly narrowed eyes
    [-span, span].forEach((dx) => {
      ctx.beginPath(); ctx.arc(cx+dx, ey, er*0.95, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.beginPath(); ctx.arc(cx+dx-er*0.25, ey-er*0.25, er*0.32, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = pal.dark;
    });
    // Furrowed brow
    ctx.strokeStyle = pal.dark; ctx.lineWidth = r*0.048; ctx.lineCap = 'round';
    [-span, span].forEach((dx) => {
      ctx.beginPath(); ctx.moveTo(cx+dx-er, ey-er*1.5); ctx.lineTo(cx+dx+er, ey-er*1.4); ctx.stroke();
    });

  } else if (expr === 'shrug') {
    // ¯\_(ツ)_/¯ face
    [-span, span].forEach((dx) => {
      ctx.beginPath(); ctx.arc(cx+dx, ey, er, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(cx+dx-er*0.28, ey-er*0.28, er*0.33, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = pal.dark;
    });
    ctx.strokeStyle = pal.dark; ctx.lineWidth = r*0.05; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx-span-er, ey-er*1.6); ctx.lineTo(cx-span+er, ey-er*1.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx+span-er, ey-er*1.4); ctx.lineTo(cx+span+er, ey-er*1.6); ctx.stroke();

  } else if (expr === 'blush_shy') {
    // Shy downcast eyes
    ctx.strokeStyle = pal.dark; ctx.lineWidth = r*0.06; ctx.lineCap = 'round';
    [-span, span].forEach((dx) => { ctx.beginPath(); ctx.arc(cx+dx, ey+er*0.5, er*0.8, Math.PI, 0); ctx.stroke(); });

  } else {
    [-span, span].forEach((dx) => {
      ctx.beginPath(); ctx.arc(cx+dx, ey, er, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(cx+dx-er*0.28, ey-er*0.28, er*0.33, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = pal.dark;
    });
  }
}

function drawCheeks(ctx, cx, ey, r, pal) {
  ctx.fillStyle = pal.cheek;
  [-r*0.42, r*0.42].forEach((dx) => {
    ctx.beginPath(); ctx.ellipse(cx+dx, ey+r*0.28, r*0.165, r*0.1, 0, 0, Math.PI*2); ctx.fill();
  });
}

function drawMouth(ctx, cx, my, r, pal, expr) {
  ctx.strokeStyle = pal.dark; ctx.lineWidth = r*0.055; ctx.lineCap = 'round';
  if (expr === 'shocked') {
    ctx.fillStyle = pal.dark; ctx.beginPath(); ctx.ellipse(cx, my, r*0.09, r*0.13, 0, 0, Math.PI*2); ctx.fill();
  } else if (expr === 'skeptical') {
    ctx.beginPath(); ctx.moveTo(cx-r*0.16, my+r*0.05); ctx.lineTo(cx+r*0.11, my-r*0.03); ctx.stroke();
  } else if (expr === 'confused') {
    ctx.beginPath(); ctx.moveTo(cx-r*0.13, my+r*0.06); ctx.bezierCurveTo(cx-r*0.05, my-r*0.04, cx+r*0.05, my+r*0.1, cx+r*0.13, my); ctx.stroke();
  } else if (expr === 'caring') {
    ctx.beginPath(); ctx.arc(cx, my-r*0.03, r*0.14, 0.3, Math.PI-0.3); ctx.stroke();
  } else if (expr === 'retreat') {
    ctx.beginPath(); ctx.arc(cx, my+r*0.06, r*0.12, Math.PI+0.4, -0.4); ctx.stroke();
  } else if (expr === 'lazy') {
    ctx.beginPath(); ctx.moveTo(cx-r*0.12, my); ctx.lineTo(cx+r*0.12, my); ctx.stroke();
  } else if (expr === 'happy') {
    ctx.lineWidth = r*0.065;
    ctx.beginPath(); ctx.arc(cx, my-r*0.05, r*0.2, 0.15, Math.PI-0.15); ctx.stroke();
  } else if (expr === 'big_smile') {
    ctx.lineWidth = r*0.07;
    ctx.beginPath(); ctx.arc(cx, my-r*0.06, r*0.24, 0.1, Math.PI-0.1); ctx.stroke();
    // Teeth
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(cx, my+r*0.1, r*0.14, 0, Math.PI); ctx.fill();
  } else if (expr === 'love') {
    ctx.beginPath(); ctx.arc(cx, my-r*0.03, r*0.15, 0.3, Math.PI-0.3); ctx.stroke();
  } else if (expr === 'sleepy') {
    // Small O (yawn)
    ctx.fillStyle = pal.dark;
    ctx.beginPath(); ctx.ellipse(cx, my, r*0.07, r*0.1, 0, 0, Math.PI*2); ctx.fill();
  } else if (expr === 'cry') {
    ctx.beginPath(); ctx.arc(cx, my+r*0.08, r*0.13, Math.PI+0.3, -0.3); ctx.stroke();
  } else if (expr === 'determined') {
    ctx.lineWidth = r*0.065;
    ctx.beginPath(); ctx.arc(cx, my-r*0.04, r*0.17, 0.2, Math.PI-0.2); ctx.stroke();
  } else if (expr === 'think') {
    ctx.beginPath(); ctx.moveTo(cx-r*0.12, my); ctx.bezierCurveTo(cx-r*0.04, my+r*0.08, cx+r*0.04, my-r*0.04, cx+r*0.12, my+r*0.04); ctx.stroke();
  } else if (expr === 'shrug') {
    ctx.beginPath(); ctx.moveTo(cx-r*0.15, my+r*0.03); ctx.lineTo(cx+r*0.15, my-r*0.03); ctx.stroke();
  } else if (expr === 'blush_shy') {
    ctx.beginPath(); ctx.arc(cx, my-r*0.02, r*0.12, 0.4, Math.PI-0.4); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(cx, my-r*0.03, r*0.14, 0.35, Math.PI-0.35); ctx.stroke();
  }
}

// ─── Background ───────────────────────────────────────────────────────────────

function drawBg(ctx, size, pal) {
  ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = pal.fur; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.28;
  ctx.beginPath(); ctx.roundRect(size*0.04, size*0.04, size*0.92, size*0.92, size*0.14); ctx.stroke();
  ctx.globalAlpha = 1;
}

// ─── 15 Scene draw functions ──────────────────────────────────────────────────

function drawScenePhone(ctx, size, pal, t=0) {
  const cx=size*0.5, cy=size*0.54, r=size*0.31;
  const nod = Math.sin(t*Math.PI*2)*0.5*Math.PI/180;
  ctx.save(); ctx.translate(cx,cy); ctx.rotate(nod); ctx.translate(-cx,-cy);
  ctx.fillStyle=pal.fur; ctx.beginPath(); ctx.ellipse(cx,cy+r*0.18,r*1.18,r*0.88,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=pal.body; ctx.beginPath(); ctx.ellipse(cx,cy+r*0.18,r*0.92,r*0.68,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=pal.fur;
  [[-0.28,-0.82],[0,-0.94],[0.28,-0.82]].forEach(([dx,dy])=>{ ctx.beginPath(); ctx.arc(cx+r*dx,cy+r*dy,r*0.18,0,Math.PI*2); ctx.fill(); });
  [[-1.08,0.22],[1.08,0.22]].forEach(([dx,dy])=>{ ctx.beginPath(); ctx.ellipse(cx+r*dx,cy+r*dy,r*0.22,r*0.32,dx<0?0.4:-0.4,0,Math.PI*2); ctx.fill(); });
  ctx.fillStyle='#2a2a2a'; ctx.beginPath(); ctx.roundRect(cx+r*0.9,cy-r*0.08,r*0.28,r*0.44,r*0.05); ctx.fill();
  ctx.fillStyle='#68c8ff'; ctx.beginPath(); ctx.roundRect(cx+r*0.93,cy-r*0.05,r*0.22,r*0.32,r*0.03); ctx.fill();
  ctx.fillStyle=pal.accent; ctx.beginPath(); ctx.moveTo(cx-r*0.1,cy-r*0.06); ctx.lineTo(cx+r*0.1,cy-r*0.06); ctx.lineTo(cx,cy+r*0.07); ctx.closePath(); ctx.fill();
  const ey=cy-r*0.26; drawEyes(ctx,cx,ey,r,pal,'lazy'); drawCheeks(ctx,cx,ey,r,pal); drawMouth(ctx,cx,ey+r*0.36,r,pal,'lazy');
  ctx.restore();
}

function drawSceneSkeptical(ctx, size, pal, t=0) {
  const cx=size*0.5, cy=size*0.52, r=size*0.3;
  const breathe=1+Math.sin(t*Math.PI*2)*0.014;
  ctx.save(); ctx.translate(cx,cy); ctx.scale(breathe,breathe); ctx.translate(-cx,-cy);
  ctx.fillStyle=pal.fur;
  [[-0.68,0.12],[0.68,0.12],[-0.84,-0.22],[0.84,-0.22],[-0.58,-0.58],[0.58,-0.58],[0,-0.82]].forEach(([dx,dy])=>{ ctx.beginPath(); ctx.arc(cx+r*dx,cy+r*dy,r*0.24,0,Math.PI*2); ctx.fill(); });
  ctx.fillStyle=pal.body; ctx.beginPath(); ctx.arc(cx,cy,r*0.92,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=pal.fur;
  [[-0.72,-0.75],[0.72,-0.75]].forEach(([dx,dy])=>{ ctx.beginPath(); ctx.arc(cx+r*dx,cy+r*dy,r*0.2,0,Math.PI*2); ctx.fill(); });
  ctx.fillStyle='rgba(255,200,190,0.7)';
  [[-0.72,-0.75],[0.72,-0.75]].forEach(([dx,dy])=>{ ctx.beginPath(); ctx.arc(cx+r*dx,cy+r*dy,r*0.1,0,Math.PI*2); ctx.fill(); });
  ctx.strokeStyle=pal.fur; ctx.lineWidth=r*0.3; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(cx-r*0.72,cy+r*0.38); ctx.bezierCurveTo(cx-r*0.2,cy+r*0.62,cx+r*0.2,cy+r*0.58,cx+r*0.62,cy+r*0.32); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx+r*0.52,cy+r*0.58); ctx.bezierCurveTo(cx+r*0.1,cy+r*0.78,cx-r*0.1,cy+r*0.78,cx-r*0.48,cy+r*0.6); ctx.stroke();
  const ey=cy-r*0.18; drawEyes(ctx,cx,ey,r,pal,'skeptical'); drawCheeks(ctx,cx,ey,r,pal); drawMouth(ctx,cx,ey+r*0.44,r,pal,'skeptical');
  ctx.restore();
}

function drawSceneConfused(ctx, size, pal, t=0) {
  const cx=size*0.5, cy=size*0.58, r=size*0.28;
  const earWag=Math.sin(t*Math.PI*2)*3*Math.PI/180;
  ctx.save(); ctx.translate(cx,cy-r*1.05); ctx.rotate(earWag); ctx.translate(-cx,-(cy-r*1.05));
  ctx.fillStyle=pal.fur;
  [[-0.32,-1.05],[0.32,-1.05]].forEach(([dx,dy])=>{ ctx.beginPath(); ctx.ellipse(cx+r*dx,cy+r*dy,r*0.2,r*0.55,dx<0?-0.12:0.12,0,Math.PI*2); ctx.fill(); });
  ctx.fillStyle='rgba(255,200,190,0.65)';
  [[-0.32,-1.05],[0.32,-1.05]].forEach(([dx,dy])=>{ ctx.beginPath(); ctx.ellipse(cx+r*dx,cy+r*dy,r*0.1,r*0.37,dx<0?-0.12:0.12,0,Math.PI*2); ctx.fill(); });
  ctx.restore();
  ctx.fillStyle=pal.body; ctx.beginPath(); ctx.arc(cx,cy,r*0.92,0,Math.PI*2); ctx.fill();
  const qFloat=Math.sin(t*Math.PI*2)*r*0.06;
  ctx.fillStyle=pal.accent; ctx.font=`bold ${r*0.72}px "Noto Sans SC",sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('?',cx+r*0.62,cy-r*1.0+qFloat);
  const ey=cy-r*0.15; drawEyes(ctx,cx,ey,r,pal,'confused'); drawCheeks(ctx,cx,ey,r,pal); drawMouth(ctx,cx,ey+r*0.42,r,pal,'confused');
}

function drawSceneCaring(ctx, size, pal, t=0) {
  const cx=size*0.48, cy=size*0.54, r=size*0.29;
  const lean=Math.sin(t*Math.PI*2)*1.5*Math.PI/180;
  ctx.save(); ctx.translate(cx,cy); ctx.rotate(lean); ctx.translate(-cx,-cy);
  ctx.fillStyle=pal.fur;
  [[-0.58,-0.9],[0.58,-0.9]].forEach(([dx,dy],i)=>{ ctx.beginPath(); ctx.moveTo(cx+r*dx,cy+r*dy+r*0.32); ctx.lineTo(cx+r*dx+(i===0?-1:1)*r*0.22,cy+r*dy-r*0.28); ctx.lineTo(cx+r*dx+(i===0?1:-1)*r*0.22,cy+r*dy-r*0.1); ctx.closePath(); ctx.fill(); });
  ctx.fillStyle='rgba(255,200,190,0.65)';
  [[-0.58,-0.9],[0.58,-0.9]].forEach(([dx,dy],i)=>{ ctx.beginPath(); ctx.moveTo(cx+r*dx,cy+r*dy+r*0.16); ctx.lineTo(cx+r*dx+(i===0?-1:1)*r*0.1,cy+r*dy-r*0.16); ctx.lineTo(cx+r*dx+(i===0?1:-1)*r*0.1,cy+r*dy-r*0.04); ctx.closePath(); ctx.fill(); });
  ctx.fillStyle=pal.body; ctx.beginPath(); ctx.arc(cx,cy,r*0.9,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle=pal.fur; ctx.lineWidth=r*0.32; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(cx-r*0.55,cy+r*0.55); ctx.lineTo(cx-r*0.82,cy+r*0.88); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx+r*0.55,cy+r*0.55); ctx.lineTo(cx+r*0.72,cy+r*0.88); ctx.stroke();
  ctx.fillStyle=pal.fur; [[-0.82,0.92],[0.72,0.92]].forEach(([dx,dy])=>{ ctx.beginPath(); ctx.arc(cx+r*dx,cy+r*dy,r*0.14,0,Math.PI*2); ctx.fill(); });
  const ey=cy-r*0.2; drawEyes(ctx,cx,ey,r,pal,'caring'); drawCheeks(ctx,cx,ey,r,pal); drawMouth(ctx,cx,ey+r*0.42,r,pal,'caring');
  ctx.restore();
}

function drawSceneShocked(ctx, size, pal, t=0) {
  const cx=size*0.5, cy=size*0.52, r=size*0.3;
  const shakeX=Math.sin(t*Math.PI*4)*r*0.018;
  ctx.save(); ctx.translate(shakeX,0);
  ctx.fillStyle=pal.fur;
  [[-1.02,-0.42],[1.02,-0.42]].forEach(([dx,dy])=>{ ctx.beginPath(); ctx.ellipse(cx+r*dx,cy+r*dy,r*0.22,r*0.35,dx<0?0.55:-0.55,0,Math.PI*2); ctx.fill(); });
  ctx.fillStyle=pal.body; ctx.beginPath(); ctx.arc(cx,cy,r*0.92,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=pal.fur; [[-0.28,-0.9],[0,-1.0],[0.28,-0.9]].forEach(([dx,dy])=>{ ctx.beginPath(); ctx.arc(cx+r*dx,cy+r*dy,r*0.16,0,Math.PI*2); ctx.fill(); });
  ctx.fillStyle=pal.accent; ctx.beginPath(); ctx.moveTo(cx-r*0.1,cy+r*0.05); ctx.lineTo(cx+r*0.1,cy+r*0.05); ctx.lineTo(cx,cy+r*0.18); ctx.closePath(); ctx.fill();
  ctx.strokeStyle=pal.accent; ctx.lineWidth=r*0.055; ctx.lineCap='round';
  [[-1.2,-0.82],[1.2,-0.82],[-1.38,-0.42],[1.38,-0.42]].forEach(([dx,dy])=>{ ctx.beginPath(); ctx.moveTo(cx+r*dx*0.7,cy+r*dy*0.7); ctx.lineTo(cx+r*dx,cy+r*dy); ctx.stroke(); });
  const ey=cy-r*0.28; drawEyes(ctx,cx,ey,r,pal,'shocked'); drawCheeks(ctx,cx,ey,r,pal); drawMouth(ctx,cx,ey+r*0.44,r,pal,'shocked');
  ctx.restore();
}

function drawSceneRetreat(ctx, size, pal, t=0) {
  const cx=size*0.5, cy=size*0.52, r=size*0.29;
  const walkX=Math.sin(t*Math.PI*4)*r*0.025, walkY=Math.abs(Math.sin(t*Math.PI*4))*r*0.015;
  ctx.fillStyle=pal.body; ctx.beginPath(); ctx.arc(cx+walkX,cy-walkY,r*0.9,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=pal.fur;
  [[-1.0,0.1],[1.0,0.1]].forEach(([dx,dy])=>{ ctx.beginPath(); ctx.arc(cx+walkX+r*dx,cy-walkY+r*dy,r*0.28,0,Math.PI*2); ctx.fill(); });
  [[-0.52,-0.84],[0.52,-0.84]].forEach(([dx,dy])=>{ ctx.beginPath(); ctx.arc(cx+walkX+r*dx,cy-walkY+r*dy,r*0.2,0,Math.PI*2); ctx.fill(); });
  ctx.fillStyle='rgba(255,200,190,0.65)';
  [[-0.52,-0.84],[0.52,-0.84]].forEach(([dx,dy])=>{ ctx.beginPath(); ctx.arc(cx+walkX+r*dx,cy-walkY+r*dy,r*0.1,0,Math.PI*2); ctx.fill(); });
  ctx.strokeStyle=pal.fur; ctx.lineWidth=r*0.24; ctx.lineCap='round';
  const lp=Math.sin(t*Math.PI*4);
  [[-0.3,lp*0.12],[0.3,-lp*0.12]].forEach(([dx,phase])=>{ ctx.beginPath(); ctx.moveTo(cx+walkX+r*dx*0.6,cy-walkY+r*0.7); ctx.lineTo(cx+walkX+r*dx,cy-walkY+r*(1.1+phase)); ctx.stroke(); });
  const wa=Math.sin(t*Math.PI*4)*12*Math.PI/180;
  ctx.lineWidth=r*0.2; ctx.beginPath(); ctx.moveTo(cx+walkX+r*0.72,cy-walkY-r*0.3); ctx.lineTo(cx+walkX+r*1.05,cy-walkY-r*0.55); ctx.stroke();
  ctx.save(); ctx.translate(cx+walkX+r*1.05,cy-walkY-r*0.55); ctx.rotate(wa); ctx.fillStyle=pal.fur; ctx.beginPath(); ctx.arc(0,0,r*0.14,0,Math.PI*2); ctx.fill(); ctx.restore();
  const ey=cy-walkY-r*0.18; drawEyes(ctx,cx+walkX,ey,r,pal,'retreat'); drawCheeks(ctx,cx+walkX,ey,r,pal); drawMouth(ctx,cx+walkX,ey+r*0.42,r,pal,'retreat');
}

function drawScenePeek(ctx, size, pal, t=0) {
  const cx=size*0.5, peekY=size*0.82+Math.sin(t*Math.PI*2)*size*0.018, r=size*0.32;
  ctx.fillStyle=pal.fur;
  [[-0.28,-1.38],[0.28,-1.38]].forEach(([dx,dy])=>{ ctx.beginPath(); ctx.ellipse(cx+r*dx,peekY+r*dy,r*0.22,r*0.58,dx<0?-0.1:0.1,0,Math.PI*2); ctx.fill(); });
  ctx.fillStyle='rgba(255,200,190,0.65)';
  [[-0.28,-1.38],[0.28,-1.38]].forEach(([dx,dy])=>{ ctx.beginPath(); ctx.ellipse(cx+r*dx,peekY+r*dy,r*0.1,r*0.38,dx<0?-0.1:0.1,0,Math.PI*2); ctx.fill(); });
  ctx.save(); ctx.beginPath(); ctx.rect(0,0,size,size); ctx.clip();
  ctx.fillStyle=pal.body; ctx.beginPath(); ctx.arc(cx,peekY,r*0.92,0,Math.PI*2); ctx.fill();
  ctx.restore();
  ctx.strokeStyle=pal.fur; ctx.lineWidth=r*0.26; ctx.lineCap='round';
  [[-0.7,-0.06],[0.7,-0.06]].forEach(([dx,dy])=>{ ctx.beginPath(); ctx.moveTo(cx+r*dx,peekY+r*dy); ctx.lineTo(cx+r*dx*0.38,peekY+r*0.38); ctx.stroke(); });
  ctx.fillStyle=pal.fur; [[-0.7,-0.06],[0.7,-0.06]].forEach(([dx,dy])=>{ ctx.beginPath(); ctx.arc(cx+r*dx,peekY+r*dy,r*0.14,0,Math.PI*2); ctx.fill(); });
  const ey=peekY-r*0.26; drawEyes(ctx,cx,ey,r,pal,'peek'); drawCheeks(ctx,cx,ey,r,pal); drawMouth(ctx,cx,ey+r*0.38,r,pal,'peek');
}

// ── NEW: HAPPY — jumping hamster with joy ─────────────────────────────────────
function drawSceneHappy(ctx, size, pal, t=0) {
  const jumpY=Math.abs(Math.sin(t*Math.PI*2))*size*0.055;
  const cx=size*0.5, cy=size*0.55-jumpY, r=size*0.28;
  const squeeze=1+Math.abs(Math.sin(t*Math.PI*2))*0.04;
  // Arms up
  ctx.fillStyle=pal.fur;
  [[-1.05,-0.28],[1.05,-0.28]].forEach(([dx,dy])=>{ ctx.beginPath(); ctx.ellipse(cx+r*dx,cy+r*dy,r*0.2,r*0.32,dx<0?-0.6:0.6,0,Math.PI*2); ctx.fill(); });
  ctx.save(); ctx.translate(cx,cy); ctx.scale(squeeze,1/squeeze); ctx.translate(-cx,-cy);
  ctx.fillStyle=pal.body; ctx.beginPath(); ctx.arc(cx,cy,r*0.92,0,Math.PI*2); ctx.fill();
  ctx.restore();
  ctx.fillStyle=pal.fur;
  [[-0.55,-0.82],[0.55,-0.82]].forEach(([dx,dy])=>{ ctx.beginPath(); ctx.arc(cx+r*dx,cy+r*dy,r*0.2,0,Math.PI*2); ctx.fill(); });
  ctx.fillStyle='rgba(255,200,190,0.65)';
  [[-0.55,-0.82],[0.55,-0.82]].forEach(([dx,dy])=>{ ctx.beginPath(); ctx.arc(cx+r*dx,cy+r*dy,r*0.1,0,Math.PI*2); ctx.fill(); });
  ctx.fillStyle=pal.fur; [[-0.3,1.0],[0.3,1.0]].forEach(([dx,dy])=>{ ctx.beginPath(); ctx.arc(cx+r*dx,cy+r*dy,r*0.18,0,Math.PI*2); ctx.fill(); });
  const sp=1+Math.sin(t*Math.PI*2+Math.PI)*0.3;
  ctx.fillStyle=pal.accent; ctx.font=`${r*0.28*sp}px sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('✦',cx-r*0.98,cy-r*0.62);
  ctx.font=`${r*0.22/sp}px sans-serif`; ctx.fillText('✦',cx+r*0.92,cy-r*0.72);
  const ey=cy-r*0.16; drawEyes(ctx,cx,ey,r,pal,'happy'); drawCheeks(ctx,cx,ey,r,pal); drawMouth(ctx,cx,ey+r*0.4,r,pal,'happy');
}

// ── NEW: BLUSH — shy pig covering face ───────────────────────────────────────
function drawSceneBlush(ctx, size, pal, t=0) {
  const cx=size*0.5, cy=size*0.52, r=size*0.29;
  const breathe=1+Math.sin(t*Math.PI*2)*0.012;
  ctx.save(); ctx.translate(cx,cy); ctx.scale(breathe,breathe); ctx.translate(-cx,-cy);
  ctx.fillStyle=pal.fur;
  [[-0.62,-0.55],[0.62,-0.55]].forEach(([dx,dy])=>{ ctx.beginPath(); ctx.ellipse(cx+r*dx,cy+r*dy,r*0.2,r*0.25,dx<0?-0.3:0.3,0,Math.PI*2); ctx.fill(); });
  ctx.fillStyle='rgba(255,200,190,0.65)';
  [[-0.62,-0.55],[0.62,-0.55]].forEach(([dx,dy])=>{ ctx.beginPath(); ctx.ellipse(cx+r*dx,cy+r*dy,r*0.11,r*0.14,dx<0?-0.3:0.3,0,Math.PI*2); ctx.fill(); });
  ctx.fillStyle=pal.body; ctx.beginPath(); ctx.arc(cx,cy,r*0.92,0,Math.PI*2); ctx.fill();
  // Pig snout
  ctx.fillStyle=pal.fur; ctx.beginPath(); ctx.ellipse(cx,cy+r*0.2,r*0.32,r*0.22,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=pal.dark; ctx.globalAlpha=0.5;
  [[-0.12,0.18],[0.12,0.18]].forEach(([dx,dy])=>{ ctx.beginPath(); ctx.ellipse(cx+r*dx,cy+r*dy,r*0.08,r*0.06,0,0,Math.PI*2); ctx.fill(); });
  ctx.globalAlpha=1;
  // Covering paws
  ctx.fillStyle=pal.fur;
  [[-0.62,0.05],[0.62,0.05]].forEach(([dx,dy])=>{ ctx.beginPath(); ctx.ellipse(cx+r*dx,cy+r*dy,r*0.28,r*0.2,dx<0?0.3:-0.3,0,Math.PI*2); ctx.fill(); });
  const ey=cy-r*0.22; drawEyes(ctx,cx,ey,r,pal,'blush_shy');
  // Extra big blush
  ctx.fillStyle='rgba(255,130,150,0.5)';
  [-r*0.48,r*0.48].forEach((dx)=>{ ctx.beginPath(); ctx.ellipse(cx+dx,ey+r*0.28,r*0.22,r*0.14,0,0,Math.PI*2); ctx.fill(); });
  drawMouth(ctx,cx,ey+r*0.44,r,pal,'blush_shy');
  ctx.restore();
}

// ── NEW: SLEEPY — bear yawning with zzz ──────────────────────────────────────
function drawSceneSleepy(ctx, size, pal, t=0) {
  const cx=size*0.5, cy=size*0.52, r=size*0.3;
  const breathe=1+Math.sin(t*Math.PI*2)*0.022;
  ctx.save(); ctx.translate(cx,cy); ctx.scale(1,breathe); ctx.translate(-cx,-cy);
  // Round bear ears
  ctx.fillStyle=pal.fur;
  [[-0.62,-0.78],[0.62,-0.78]].forEach(([dx,dy])=>{ ctx.beginPath(); ctx.arc(cx+r*dx,cy+r*dy,r*0.22,0,Math.PI*2); ctx.fill(); });
  ctx.fillStyle='rgba(255,200,190,0.65)';
  [[-0.62,-0.78],[0.62,-0.78]].forEach(([dx,dy])=>{ ctx.beginPath(); ctx.arc(cx+r*dx,cy+r*dy,r*0.12,0,Math.PI*2); ctx.fill(); });
  ctx.fillStyle=pal.body; ctx.beginPath(); ctx.arc(cx,cy,r*0.92,0,Math.PI*2); ctx.fill();
  // Snout
  ctx.fillStyle=pal.fur; ctx.beginPath(); ctx.ellipse(cx,cy+r*0.18,r*0.36,r*0.26,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=pal.dark; ctx.beginPath(); ctx.arc(cx,cy+r*0.1,r*0.07,0,Math.PI*2); ctx.fill();
  ctx.restore();
  // ZZZ floating
  const zPhase=t*Math.PI*2;
  ['z','z','Z'].forEach((z,i)=>{
    const opacity=0.3+Math.abs(Math.sin(zPhase+i*1.2))*0.6;
    ctx.fillStyle=`rgba(108,130,210,${opacity})`;
    ctx.font=`bold ${r*(0.22+i*0.08)}px sans-serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(z,cx+r*(0.7+i*0.22),cy-r*(0.55+i*0.28)+Math.sin(zPhase+i)*r*0.04);
  });
  const ey=cy-r*0.22; drawEyes(ctx,cx,ey,r,pal,'sleepy'); drawCheeks(ctx,cx,ey,r,pal); drawMouth(ctx,cx,ey+r*0.42,r,pal,'sleepy');
}

// ── NEW: CHEER — bear/panda with raised fists ─────────────────────────────────
function drawSceneCheer(ctx, size, pal, t=0) {
  const cx=size*0.5, cy=size*0.52, r=size*0.29;
  const pump=Math.abs(Math.sin(t*Math.PI*4))*r*0.06;
  ctx.fillStyle=pal.fur;
  [[-0.78,-0.55-pump*0.02],[0.78,-0.55-pump*0.02]].forEach(([dx,dy])=>{ ctx.beginPath(); ctx.ellipse(cx+r*dx,cy+r*dy-pump,r*0.22,r*0.38,dx<0?-0.4:0.4,0,Math.PI*2); ctx.fill(); });
  [[-0.62,-0.78],[0.62,-0.78]].forEach(([dx,dy])=>{ ctx.beginPath(); ctx.arc(cx+r*dx,cy+r*dy,r*0.22,0,Math.PI*2); ctx.fill(); });
  ctx.fillStyle='rgba(255,200,190,0.65)'; [[-0.62,-0.78],[0.62,-0.78]].forEach(([dx,dy])=>{ ctx.beginPath(); ctx.arc(cx+r*dx,cy+r*dy,r*0.12,0,Math.PI*2); ctx.fill(); });
  ctx.fillStyle=pal.body; ctx.beginPath(); ctx.arc(cx,cy,r*0.92,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=pal.fur; ctx.beginPath(); ctx.ellipse(cx,cy+r*0.18,r*0.38,r*0.28,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=pal.dark; ctx.beginPath(); ctx.arc(cx,cy+r*0.1,r*0.07,0,Math.PI*2); ctx.fill();
  // Fists at top of arm
  ctx.fillStyle=pal.fur;
  [[-0.78,-0.58],[0.78,-0.58]].forEach(([dx,dy])=>{ ctx.beginPath(); ctx.arc(cx+r*dx,cy+r*dy-pump,r*0.18,0,Math.PI*2); ctx.fill(); });
  // Motion lines
  ctx.strokeStyle=pal.accent; ctx.lineWidth=r*0.045; ctx.lineCap='round'; ctx.globalAlpha=0.5+pump/r*3;
  [[-0.78,0],[0.78,0]].forEach(([dx])=>{ ctx.beginPath(); ctx.moveTo(cx+r*dx,cy-r*0.55-pump*2); ctx.lineTo(cx+r*dx,cy-r*0.78-pump*2); ctx.stroke(); });
  ctx.globalAlpha=1;
  const ey=cy-r*0.22; drawEyes(ctx,cx,ey,r,pal,'determined'); drawCheeks(ctx,cx,ey,r,pal); drawMouth(ctx,cx,ey+r*0.42,r,pal,'determined');
}

// ── NEW: LOVE — cat with heart eyes ──────────────────────────────────────────
function drawSceneLove(ctx, size, pal, t=0) {
  const cx=size*0.5, cy=size*0.52, r=size*0.29;
  const float=Math.sin(t*Math.PI*2)*r*0.02;
  ctx.save(); ctx.translate(0,float);
  ctx.fillStyle=pal.fur;
  [[-0.58,-0.88],[0.58,-0.88]].forEach(([dx,dy],i)=>{ ctx.beginPath(); ctx.moveTo(cx+r*dx,cy+r*dy+r*0.32); ctx.lineTo(cx+r*dx+(i===0?-1:1)*r*0.22,cy+r*dy-r*0.28); ctx.lineTo(cx+r*dx+(i===0?1:-1)*r*0.22,cy+r*dy-r*0.1); ctx.closePath(); ctx.fill(); });
  ctx.fillStyle='rgba(255,200,190,0.65)';
  [[-0.58,-0.88],[0.58,-0.88]].forEach(([dx,dy],i)=>{ ctx.beginPath(); ctx.moveTo(cx+r*dx,cy+r*dy+r*0.16); ctx.lineTo(cx+r*dx+(i===0?-1:1)*r*0.1,cy+r*dy-r*0.16); ctx.lineTo(cx+r*dx+(i===0?1:-1)*r*0.1,cy+r*dy-r*0.04); ctx.closePath(); ctx.fill(); });
  ctx.fillStyle=pal.body; ctx.beginPath(); ctx.arc(cx,cy,r*0.9,0,Math.PI*2); ctx.fill();
  // Floating hearts
  [[-0.95,-0.72],[0.95,-0.72]].forEach(([dx,dy],i)=>{
    const scale=1+Math.sin(t*Math.PI*2+(i?Math.PI:0))*0.2;
    const hx=cx+r*dx, hy=cy+r*dy, hr=r*0.12*scale;
    ctx.fillStyle=pal.accent; ctx.globalAlpha=0.8;
    ctx.beginPath(); ctx.moveTo(hx,hy+hr*0.7); ctx.bezierCurveTo(hx-hr*1.4,hy-hr*0.3,hx-hr*1.4,hy-hr*1.1,hx,hy-hr*0.25); ctx.bezierCurveTo(hx+hr*1.4,hy-hr*1.1,hx+hr*1.4,hy-hr*0.3,hx,hy+hr*0.7); ctx.fill();
    ctx.globalAlpha=1;
  });
  const ey=cy-r*0.2; drawEyes(ctx,cx,ey,r,pal,'heart'); drawCheeks(ctx,cx,ey,r,pal); drawMouth(ctx,cx,ey+r*0.42,r,pal,'love');
  ctx.restore();
}

// ── NEW: THINK — hamster thinking ─────────────────────────────────────────────
function drawSceneThink(ctx, size, pal, t=0) {
  const cx=size*0.5, cy=size*0.52, r=size*0.28;
  const tilt=Math.sin(t*Math.PI*1.2)*2.5*Math.PI/180;
  ctx.save(); ctx.translate(cx,cy); ctx.rotate(tilt); ctx.translate(-cx,-cy);
  ctx.fillStyle=pal.fur;
  [[-0.55,-0.82],[0.55,-0.82]].forEach(([dx,dy])=>{ ctx.beginPath(); ctx.arc(cx+r*dx,cy+r*dy,r*0.2,0,Math.PI*2); ctx.fill(); });
  ctx.fillStyle='rgba(255,200,190,0.65)';
  [[-0.55,-0.82],[0.55,-0.82]].forEach(([dx,dy])=>{ ctx.beginPath(); ctx.arc(cx+r*dx,cy+r*dy,r*0.1,0,Math.PI*2); ctx.fill(); });
  ctx.fillStyle=pal.body; ctx.beginPath(); ctx.arc(cx,cy,r*0.92,0,Math.PI*2); ctx.fill();
  // Paw on chin
  ctx.fillStyle=pal.fur;
  ctx.beginPath(); ctx.ellipse(cx+r*0.5,cy+r*0.55,r*0.28,r*0.2,0.3,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+r*0.72,cy+r*0.38,r*0.16,0,Math.PI*2); ctx.fill();
  ctx.restore();
  // Thought bubble
  const bp=t*Math.PI*2;
  [0.15,0.22,0.3].forEach((scale,i)=>{
    const bx=cx+r*(0.72+i*0.28), by=cy-r*(0.5+i*0.3);
    ctx.fillStyle=pal.fur; ctx.globalAlpha=0.7;
    ctx.beginPath(); ctx.arc(bx,by,r*scale,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
  });
  ctx.fillStyle=pal.fur; ctx.globalAlpha=0.8;
  ctx.beginPath(); ctx.roundRect(cx+r*0.9,cy-r*1.5,r*0.9,r*0.65,r*0.18); ctx.fill();
  ctx.globalAlpha=1;
  ctx.fillStyle=pal.accent; ctx.font=`${r*0.38}px sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('💭',cx+r*1.35,cy-r*1.18);
  const ey=cy-r*0.18; drawEyes(ctx,cx,ey,r,pal,'think'); drawCheeks(ctx,cx,ey,r,pal); drawMouth(ctx,cx,ey+r*0.42,r,pal,'think');
}

// ── NEW: SOB — crying bunny ────────────────────────────────────────────────────
function drawSceneSob(ctx, size, pal, t=0) {
  const cx=size*0.5, cy=size*0.56, r=size*0.28;
  const sob=Math.abs(Math.sin(t*Math.PI*3))*r*0.015;
  ctx.save(); ctx.translate(cx,cy+sob); ctx.translate(-cx,-(cy+sob));
  ctx.fillStyle=pal.fur;
  [[-0.28,-1.32],[0.28,-1.32]].forEach(([dx,dy])=>{ ctx.beginPath(); ctx.ellipse(cx+r*dx,cy+r*dy,r*0.2,r*0.52,dx<0?-0.1:0.1,0,Math.PI*2); ctx.fill(); });
  ctx.fillStyle='rgba(255,200,190,0.65)';
  [[-0.28,-1.32],[0.28,-1.32]].forEach(([dx,dy])=>{ ctx.beginPath(); ctx.ellipse(cx+r*dx,cy+r*dy,r*0.1,r*0.36,dx<0?-0.1:0.1,0,Math.PI*2); ctx.fill(); });
  ctx.fillStyle=pal.body; ctx.beginPath(); ctx.arc(cx,cy,r*0.92,0,Math.PI*2); ctx.fill();
  // Tiny nose
  ctx.fillStyle=pal.fur; ctx.beginPath(); ctx.arc(cx,cy-r*0.08,r*0.07,0,Math.PI*2); ctx.fill();
  const ey=cy-r*0.22;
  drawEyes(ctx,cx,ey,r,pal,'cry');
  // Extra tear stream
  const tp=t*Math.PI*3;
  [-r*0.3,r*0.3].forEach((dx)=>{
    ctx.fillStyle='rgba(130,180,255,0.7)';
    ctx.beginPath(); ctx.ellipse(cx+dx,ey+r*0.38+Math.sin(tp)*r*0.05,r*0.06,r*0.18,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx+dx,ey+r*0.62+Math.sin(tp+1)*r*0.05,r*0.05,r*0.14,0,0,Math.PI*2); ctx.fill();
  });
  drawCheeks(ctx,cx,ey,r,pal);
  drawMouth(ctx,cx,ey+r*0.42,r,pal,'cry');
  ctx.restore();
}

// ── NEW: SHRUG — duck shrugging ───────────────────────────────────────────────
function drawSceneShrug(ctx, size, pal, t=0) {
  const cx=size*0.5, cy=size*0.52, r=size*0.29;
  const shrug=Math.sin(t*Math.PI*2)*r*0.03;
  ctx.fillStyle=pal.fur;
  // Raised shoulders / wings
  [[-1.0,0.05+shrug*0.04],[1.0,0.05+shrug*0.04]].forEach(([dx,dy])=>{ ctx.beginPath(); ctx.ellipse(cx+r*dx,cy+r*dy-shrug,r*0.28,r*0.22,dx<0?0.5:-0.5,0,Math.PI*2); ctx.fill(); });
  [[-0.28,-0.86],[0.28,-0.86]].forEach(([dx,dy])=>{ ctx.beginPath(); ctx.arc(cx+r*dx,cy+r*dy,r*0.17,0,Math.PI*2); ctx.fill(); });
  ctx.fillStyle=pal.body; ctx.beginPath(); ctx.arc(cx,cy,r*0.92,0,Math.PI*2); ctx.fill();
  // Beak
  ctx.fillStyle=pal.accent; ctx.beginPath(); ctx.moveTo(cx-r*0.1,cy-r*0.06); ctx.lineTo(cx+r*0.1,cy-r*0.06); ctx.lineTo(cx,cy+r*0.07); ctx.closePath(); ctx.fill();
  // Hands raised/open
  ctx.fillStyle=pal.fur;
  [[-r*0.88,r*0.06-shrug],[r*0.88,r*0.06-shrug]].forEach(([dx,dy])=>{ ctx.beginPath(); ctx.arc(cx+dx,cy+dy,r*0.16,0,Math.PI*2); ctx.fill(); });
  const ey=cy-r*0.26; drawEyes(ctx,cx,ey,r,pal,'shrug'); drawCheeks(ctx,cx,ey,r,pal); drawMouth(ctx,cx,ey+r*0.4,r,pal,'shrug');
}

// ─── Scene registry ───────────────────────────────────────────────────────────
const SCENE_DRAWERS = {
  phone: drawScenePhone, skeptical: drawSceneSkeptical, confused: drawSceneConfused,
  caring: drawSceneCaring, shocked: drawSceneShocked, retreat: drawSceneRetreat,
  peek: drawScenePeek, happy: drawSceneHappy, blush: drawSceneBlush,
  sleepy: drawSceneSleepy, cheer: drawSceneCheer, love: drawSceneLove,
  think: drawSceneThink, sob: drawSceneSob, shrug: drawSceneShrug,
};

// Cute hand-drawn meme templates. The canvas characters stay as a graceful
// fallback if a static asset cannot load.
const STICKER_TEMPLATES = {
  phone:     { src: '/assets/stickers/lazy-phone-duck.png', motion: 'float' },
  skeptical: { src: '/assets/stickers/skeptical-pig.png', motion: 'tilt' },
  confused:  { src: '/assets/stickers/confused-figure.png', motion: 'shrug' },
  caring:    { src: '/assets/stickers/caring-cat.png', motion: 'breathe' },
  shocked:   { src: '/assets/stickers/shocked-duck.png', motion: 'pop' },
  retreat:   { src: '/assets/stickers/retreat-hamster.png', motion: 'scoot' },
  peek:      { src: '/assets/stickers/peek-rabbit.png', motion: 'peek' },
};

const stickerTemplateCache = new Map();

function loadStickerTemplate(scene) {
  const template=STICKER_TEMPLATES[scene];
  if(!template) return Promise.resolve(null);
  if(stickerTemplateCache.has(scene)) return stickerTemplateCache.get(scene);
  const promise=new Promise((resolve,reject)=>{
    const image=new Image();
    image.onload=()=>resolve(image);
    image.onerror=()=>reject(new Error(`Sticker template failed to load: ${scene}`));
    image.src=template.src;
  });
  stickerTemplateCache.set(scene,promise);
  return promise;
}

function getTemplateTransform(scene, size, t) {
  const motion=STICKER_TEMPLATES[scene]?.motion||'float';
  const wave=Math.sin(t*Math.PI*2);
  if(motion==='tilt') return { x:0, y:wave*size*0.006, scale:1.018, rotate:wave*0.025 };
  if(motion==='shrug') return { x:0, y:-Math.abs(wave)*size*0.014, scale:1+Math.abs(wave)*0.012, rotate:0 };
  if(motion==='breathe') return { x:0, y:wave*size*0.006, scale:1+wave*0.009, rotate:0 };
  if(motion==='pop') return { x:0, y:-Math.abs(wave)*size*0.014, scale:1+Math.abs(wave)*0.025, rotate:0 };
  if(motion==='scoot') return { x:wave*size*0.012, y:0, scale:1.012, rotate:-wave*0.016 };
  if(motion==='peek') return { x:0, y:Math.abs(wave)*size*0.012, scale:1.012, rotate:wave*0.012 };
  return { x:0, y:wave*size*0.008, scale:1.012, rotate:wave*0.01 };
}

function drawTemplateSticker(ctx, scene, size, t, image) {
  const { x, y, scale, rotate }=getTemplateTransform(scene,size,t);
  ctx.save();
  ctx.translate(size/2+x,size/2+y);
  ctx.rotate(rotate);
  ctx.scale(scale,scale);
  ctx.drawImage(image,-size/2,-size/2,size,size);
  ctx.restore();
}

// ─── Text overlay ─────────────────────────────────────────────────────────────
function getTextLines(text) {
  if (text.length<=7) return [text];
  const mid=Math.ceil(text.length/2);
  return [text.slice(0,mid),text.slice(mid)];
}

function drawStickerText(ctx, text, size, pal) {
  const lines=getTextLines(text), large=size>=300;
  const fontSize=large?(lines.length>1?30:36):(lines.length>1?16:20);
  const lineH=fontSize*1.22, pad=large?14:7;
  const panelH=lines.length*lineH+pad*2, panelY=large?14:7;
  const panelW=size*0.86, panelX=(size-panelW)/2;
  ctx.fillStyle='rgba(255,255,255,0.92)';
  ctx.beginPath(); ctx.roundRect(panelX,panelY,panelW,panelH,large?18:10); ctx.fill();
  ctx.fillStyle=pal?.text||'#2a1808';
  ctx.font=`700 ${fontSize}px "Noto Sans SC","PingFang SC",sans-serif`;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  lines.forEach((line,i)=>{ ctx.fillText(line,size/2,panelY+pad+lineH*(i+0.5)); });
}

// ─── Animated canvas ──────────────────────────────────────────────────────────
function makeAnimatedCanvas(scene, text, size) {
  const pal=SCENE_PALETTES[scene]||SCENE_PALETTES.phone;
  const drawer=SCENE_DRAWERS[scene]||drawScenePhone;
  const canvas=document.createElement('canvas');
  canvas.width=size; canvas.height=size;
  const ctx=canvas.getContext('2d');
  const fps=18, loopFrames=fps*2;
  let frame=0, templateImage=null;
  function render() {
    ctx.clearRect(0,0,size,size);
    if(templateImage) drawTemplateSticker(ctx,scene,size,frame/loopFrames,templateImage);
    else { drawBg(ctx,size,pal); drawer(ctx,size,pal,frame/loopFrames); }
    drawStickerText(ctx,text,size,pal);
    frame=(frame+1)%loopFrames;
  }
  render();
  canvas._animId=setInterval(render,1000/fps);
  loadStickerTemplate(scene).then((image)=>{ templateImage=image; render(); }).catch(()=>{});
  return canvas;
}

function stopAnimation(canvas) {
  if (canvas?._animId) { clearInterval(canvas._animId); canvas._animId=null; }
}

// ─── GIF export ───────────────────────────────────────────────────────────────
let gifJsLoaded=false;
async function loadGifJs() {
  if (gifJsLoaded||window.GIF){gifJsLoaded=true;return;}
  return new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.js'; s.onload=()=>{gifJsLoaded=true;res();}; s.onerror=rej; document.head.appendChild(s); });
}

async function exportAsGif(scene, text, size, onProgress) {
  await loadGifJs();
  const pal=SCENE_PALETTES[scene]||SCENE_PALETTES.phone;
  const drawer=SCENE_DRAWERS[scene]||drawScenePhone;
  const templateImage=await loadStickerTemplate(scene).catch(()=>null);
  const loopFrames=24, frameDelay=Math.round(1000/12);
  let workerUrl;
  try { const res=await fetch('https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js'); workerUrl=URL.createObjectURL(await res.blob()); }
  catch { workerUrl='https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js'; }
  const gif=new GIF({workers:2,quality:8,width:size,height:size,workerScript:workerUrl,repeat:0});
  for(let i=0;i<loopFrames;i++){
    const c=document.createElement('canvas'); c.width=size; c.height=size;
    const ctx=c.getContext('2d');
    if(templateImage) drawTemplateSticker(ctx,scene,size,i/loopFrames,templateImage);
    else { drawBg(ctx,size,pal); drawer(ctx,size,pal,i/loopFrames); }
    drawStickerText(ctx,text,size,pal);
    gif.addFrame(c,{delay:frameDelay,copy:true});
    if(onProgress) onProgress(Math.round(i/loopFrames*60));
  }
  return new Promise((res,rej)=>{
    gif.on('progress',(p)=>{ if(onProgress) onProgress(60+Math.round(p*40)); });
    gif.on('finished',(blob)=>{
      if(workerUrl.startsWith('blob:')) URL.revokeObjectURL(workerUrl);
      const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='yuchaolove-sticker.gif'; a.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000); if(onProgress) onProgress(100); res();
    });
    gif.on('error',rej); gif.render();
  });
}

// ─── Mood → scene mapping (all 15 scenes) ────────────────────────────────────
const MOOD_SCENES = {
  playful:    ['phone', 'happy', 'shocked', 'shrug', 'peek'],
  teasing:    ['skeptical', 'phone', 'peek', 'shrug', 'blush'],
  curious:    ['peek', 'confused', 'think', 'phone', 'happy'],
  caring:     ['caring', 'love', 'peek', 'cheer', 'phone'],
  speechless: ['confused', 'skeptical', 'shocked', 'shrug', 'sob'],
  retreat:    ['retreat', 'phone', 'sob', 'skeptical', 'sleepy'],
};

const VALID_SCENES=new Set(Object.keys(SCENE_DRAWERS));
const STICKER_PANEL_RECOMMENDATION_COUNT=6;

const FALLBACK_SUGGESTIONS = {
  初次认识: [{text:'哈哈有点意思',mood:'playful',scene:'phone'},{text:'展开说说',mood:'curious',scene:'peek'},{text:'我先听着',mood:'curious',scene:'confused'},{text:'让我想想',mood:'curious',scene:'skeptical'},{text:'收到收到',mood:'playful',scene:'caring'},{text:'真的假的',mood:'playful',scene:'shocked'}],
  轻松破冰: [{text:'行 你继续',mood:'teasing',scene:'skeptical'},{text:'真的假的',mood:'playful',scene:'shocked'},{text:'我再看看',mood:'curious',scene:'peek'},{text:'有点意思',mood:'playful',scene:'phone'},{text:'让我听听',mood:'curious',scene:'caring'},{text:'什么情况',mood:'speechless',scene:'confused'}],
  稳定了解: [{text:'原来如此',mood:'curious',scene:'confused'},{text:'继续展开',mood:'curious',scene:'peek'},{text:'记下了',mood:'playful',scene:'phone'},{text:'我有在听',mood:'caring',scene:'caring'},{text:'让我想想',mood:'curious',scene:'skeptical'},{text:'这么回事',mood:'playful',scene:'shocked'}],
  暧昧升温: [{text:'有点会聊',mood:'teasing',scene:'peek'},{text:'我再观察',mood:'playful',scene:'phone'},{text:'加一分',mood:'teasing',scene:'skeptical'},{text:'被你拿捏了',mood:'playful',scene:'shocked'},{text:'有点可爱',mood:'caring',scene:'caring'},{text:'先别得意',mood:'teasing',scene:'confused'}],
  情绪陪伴: [{text:'先缓一会儿',mood:'caring',scene:'caring'},{text:'我在听',mood:'caring',scene:'peek'},{text:'今天辛苦了',mood:'caring',scene:'phone'},{text:'嗯嗯 说吧',mood:'caring',scene:'caring'},{text:'给你拍拍',mood:'caring',scene:'retreat'},{text:'慢慢来',mood:'caring',scene:'confused'}],
  建议停手: [{text:'行 你继续玩',mood:'retreat',scene:'retreat'},{text:'那我先撤了',mood:'retreat',scene:'phone'},{text:'所以我算什么',mood:'speechless',scene:'confused'},{text:'好吧好吧',mood:'retreat',scene:'skeptical'},{text:'我先消失',mood:'retreat',scene:'peek'},{text:'当我没说',mood:'speechless',scene:'shocked'}],
};

function getStickerSuggestions(advice) {
  const s=Array.isArray(advice?.sticker_suggestions)
    ?advice.sticker_suggestions.map((s)=>({text:typeof s?.text==='string'?s.text.trim().slice(0,16):'',mood:MOOD_SCENES[s?.mood]?s.mood:'playful',scene:VALID_SCENES.has(s?.scene)?s.scene:''})).filter(s=>s.text).slice(0,STICKER_PANEL_RECOMMENDATION_COUNT):[];
  const fallback=FALLBACK_SUGGESTIONS[advice?.conversation_stage]||FALLBACK_SUGGESTIONS['轻松破冰'];
  if(s.length<3) return fallback;
  return [...s,...fallback]
    .filter((item,index,items)=>items.findIndex((candidate)=>candidate.text===item.text&&candidate.scene===item.scene)===index)
    .slice(0,STICKER_PANEL_RECOMMENDATION_COUNT);
}

function chooseStickerScene(suggestion, index) {
  if(VALID_SCENES.has(suggestion.scene)) return suggestion.scene;
  const scenes=MOOD_SCENES[suggestion.mood]||MOOD_SCENES.playful;
  return scenes[index%scenes.length];
}

// ─── Panel & Modal ────────────────────────────────────────────────────────────
let renderSequence=0;

async function showStickerPanel(advice) {
  const panel=document.getElementById('stickerPanel'), grid=document.getElementById('stickerGrid');
  if(!panel||!grid) return;
  const cur=++renderSequence;
  grid.querySelectorAll('canvas').forEach(stopAnimation);
  grid.replaceChildren();
  const suggestions=getStickerSuggestions(advice);
  const thumbs=suggestions.map((s,i)=>{ const scene=chooseStickerScene(s,i); const thumb=makeAnimatedCanvas(scene,s.text,180); thumb.className='sticker-thumb'; thumb.title=s.text; thumb.addEventListener('click',()=>showStickerModal(scene,s.text)); return thumb; });
  if(cur!==renderSequence) return;
  thumbs.forEach((thumb)=>{ const wrap=document.createElement('div'); wrap.className='sticker-wrap'; wrap.appendChild(thumb); grid.appendChild(wrap); });
  panel.style.display='block';
  setTimeout(()=>panel.scrollIntoView({behavior:'smooth',block:'nearest'}),100);
}

function showStickerModal(scene, text) {
  let modal=document.getElementById('stickerModal');
  if(!modal){
    modal=document.createElement('div'); modal.id='stickerModal'; modal.className='sticker-modal';
    modal.innerHTML=`<div class="sticker-modal-box"><button class="sticker-modal-close" onclick="closeStickerModal()" title="关闭">✕</button><div id="stickerModalCanvas"></div><div class="sticker-modal-name" id="stickerModalName"></div><div style="display:flex;gap:8px;width:100%;"><button class="sticker-dl-btn" id="stickerDlPng" style="flex:1;background:#a09088;">⬇ PNG</button><button class="sticker-dl-btn" id="stickerDlGif" style="flex:2;">⬇ 下载动图 GIF</button></div></div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click',(e)=>{ if(e.target===modal) closeStickerModal(); });
  }
  modal.querySelectorAll('canvas').forEach(stopAnimation);
  const large=makeAnimatedCanvas(scene,text,420);
  large.style.cssText='border-radius:16px;display:block;max-width:100%;height:auto;';
  document.getElementById('stickerModalCanvas').replaceChildren(large);
  document.getElementById('stickerModalName').textContent=`配字：${text}`;
  document.getElementById('stickerDlPng').onclick=async()=>{
    const c=document.createElement('canvas'); c.width=420; c.height=420;
    const ctx=c.getContext('2d'), pal=SCENE_PALETTES[scene]||SCENE_PALETTES.phone;
    const templateImage=await loadStickerTemplate(scene).catch(()=>null);
    if(templateImage) drawTemplateSticker(ctx,scene,420,0,templateImage);
    else { drawBg(ctx,420,pal); (SCENE_DRAWERS[scene]||drawScenePhone)(ctx,420,pal,0); }
    drawStickerText(ctx,text,420,pal);
    c.toBlob((blob)=>{ const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='yuchaolove-sticker.png'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); },'image/png');
  };
  const gifBtn=document.getElementById('stickerDlGif');
  gifBtn.onclick=async()=>{
    gifBtn.disabled=true; gifBtn.textContent='生成中 0%';
    try { await exportAsGif(scene,text,420,(p)=>{ gifBtn.textContent=`生成中 ${p}%`; }); gifBtn.textContent='⬇ 下载动图 GIF'; }
    catch(err){ console.error('GIF export failed:',err); gifBtn.textContent='⚠ 生成失败，请重试'; }
    gifBtn.disabled=false;
  };
  modal.style.display='flex';
}

function closeStickerModal() {
  const m=document.getElementById('stickerModal');
  if(m){ m.querySelectorAll('canvas').forEach(stopAnimation); m.style.display='none'; }
}

function cancelStickerRender() {
  renderSequence+=1;
  const grid=document.getElementById('stickerGrid');
  if(grid) grid.querySelectorAll('canvas').forEach(stopAnimation);
}
