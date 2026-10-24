import type { Anchors, CreatureSpec, Palette } from './creature';
import { circle, el, ellipse, ink, line, OUTLINE, path, r2 } from './svg';

// 캐릭터 파츠. back = 몸통 뒤, mid = 몸통 안(클립), front = 몸통 위, face = 얼굴 위

export type PartLayer = 'back' | 'mid' | 'front' | 'face';
export type PartFn = (a: Anchors, p: Palette, spec: CreatureSpec) => Partial<Record<PartLayer, string>>;

const GOLD = '#FFC93C';
const PINK = '#FF9EB5';
const WHITE = '#FFFFFF';

/** 좌우 대칭 파츠: fn(side)를 -1, 1로 두 번 */
const both = (fn: (s: -1 | 1) => string) => fn(-1) + fn(1);
const rot = (deg: number, x: number, y: number) => `rotate(${r2(deg)} ${r2(x)} ${r2(y)})`;

function flame(x: number, y: number, s: number, outer: string, inner: string): string {
  const d = `M${x} ${y - 26 * s} C${x + 14 * s} ${y - 12 * s} ${x + 14 * s} ${y + 4 * s} ${x} ${y + 6 * s} C${x - 14 * s} ${y + 4 * s} ${x - 14 * s} ${y - 12 * s} ${x} ${y - 26 * s} Z`;
  const di = `M${x} ${y - 12 * s} C${x + 7 * s} ${y - 4 * s} ${x + 6 * s} ${y + 3 * s} ${x} ${y + 4 * s} C${x - 6 * s} ${y + 3 * s} ${x - 7 * s} ${y - 4 * s} ${x} ${y - 12 * s} Z`;
  return path(d, ink(outer, 3)) + path(di, { fill: inner });
}

function leaf(x: number, y: number, len: number, angle: number, color: string): string {
  const d = `M${x} ${y} Q${x + len * 0.45} ${y - len * 0.5} ${x + len} ${y} Q${x + len * 0.45} ${y + len * 0.5} ${x} ${y} Z`;
  return el('g', { transform: rot(angle, x, y) }, path(d, ink(color, 3)) + path(`M${x + 2} ${y} L${x + len * 0.8} ${y}`, line(2, '#2F6B2F')));
}

function star4(x: number, y: number, r: number, color: string): string {
  return path(`M${x} ${y - r} Q${x + r * 0.2} ${y - r * 0.2} ${x + r} ${y} Q${x + r * 0.2} ${y + r * 0.2} ${x} ${y + r} Q${x - r * 0.2} ${y + r * 0.2} ${x - r} ${y} Q${x - r * 0.2} ${y - r * 0.2} ${x} ${y - r} Z`, { fill: color });
}

function spikeRing(a: Anchors, color: string, from: number, to: number, count: number, len: number): string {
  let s = '';
  for (let i = 0; i < count; i++) {
    const t = from + ((to - from) * i) / (count - 1);
    const rad = (t * Math.PI) / 180;
    const bx = a.cx + Math.cos(rad) * a.rx * 0.92;
    const by = a.cy + Math.sin(rad) * a.ry * 0.92;
    const tx = a.cx + Math.cos(rad) * (a.rx + len);
    const ty = a.cy + Math.sin(rad) * (a.ry + len);
    const px = -Math.sin(rad) * 9;
    const py = Math.cos(rad) * 9;
    s += path(`M${r2(bx - px)} ${r2(by - py)} L${r2(tx)} ${r2(ty)} L${r2(bx + px)} ${r2(by + py)} Z`, ink(color, 3));
  }
  return s;
}

export const PARTS: Record<string, PartFn> = {
  // ---- 머리 위 / 귀
  ears_fox: (a, p) => ({ back: both((s) => { const bx = a.cx + s * a.headRx * 0.55; const t = a.headTop; return path(`M${bx - 14} ${t + 14} L${bx + s * 8} ${t - 22} L${bx + 14} ${t + 10} Z`, ink(p.main)) + path(`M${bx - 6} ${t + 8} L${bx + s * 6} ${t - 12} L${bx + 7} ${t + 6} Z`, { fill: PINK }); }) }),
  ears_bunny: (a, p) => ({ back: both((s) => { const x = a.cx + s * a.headRx * 0.38; const y = a.headTop - 16; return el('g', { transform: rot(s * 14, x, y + 20) }, ellipse(x, y, 10, 26, ink(p.main)) + ellipse(x, y + 2, 5, 18, { fill: PINK })); }) }),
  ears_mouse: (a, p) => ({ back: both((s) => circle(a.cx + s * a.headRx * 0.72, a.headTop + 8, 17, ink(p.main)) + circle(a.cx + s * a.headRx * 0.72, a.headTop + 9, 9, { fill: PINK })) }),
  ears_bat: (a, p) => ({ back: both((s) => { const bx = a.cx + s * a.headRx * 0.5; const t = a.headTop; return path(`M${bx - 12} ${t + 14} L${bx + s * 18} ${t - 24} L${bx + s * 2} ${t - 6} L${bx + 14} ${t + 10} Z`, ink(p.main)) + path(`M${bx - 4} ${t + 8} L${bx + s * 12} ${t - 12} L${bx + 6} ${t + 6} Z`, { fill: p.dark }); }) }),
  ears_round: (a, p) => ({ back: both((s) => circle(a.cx + s * a.headRx * 0.65, a.headTop + 6, 11, ink(p.main)) + circle(a.cx + s * a.headRx * 0.65, a.headTop + 7, 5, { fill: PINK })) }),
  horns: (a) => ({ back: both((s) => { const x = a.cx + s * a.headRx * 0.42; const t = a.headTop + 6; return path(`M${x - 7} ${t + 4} Q${x + s * 4} ${t - 10} ${x + s * 12} ${t - 20} Q${x + s * 10} ${t - 4} ${x + 7} ${t + 6} Z`, ink('#F4E9D8', 3)); }) }),
  horn_beetle: (a) => ({ front: path(`M${a.cx - 8} ${a.headTop + 8} Q${a.cx} ${a.headTop - 30} ${a.cx + 14} ${a.headTop - 26} Q${a.cx + 4} ${a.headTop - 14} ${a.cx + 8} ${a.headTop + 8} Z`, ink('#3B3B58', 3)) }),
  antenna: (a, p) => ({ back: both((s) => { const x = a.cx + s * 10; const t = a.headTop + 4; return path(`M${x} ${t} Q${x + s * 4} ${t - 16} ${x + s * 14} ${t - 22}`, line(3.5)) + circle(x + s * 14, t - 24, 5.5, ink(p.accent, 3)); }) }),
  sprout: (a) => ({ back: path(`M${a.cx} ${a.headTop + 6} L${a.cx} ${a.headTop - 12}`, line(4, '#3E8E3E')) + leaf(a.cx, a.headTop - 12, 20, -150, '#7BD66B') + leaf(a.cx, a.headTop - 12, 20, -30, '#7BD66B') }),
  leaf_hat: (a) => ({ front: leaf(a.cx - 22, a.headTop + 4, 46, -12, '#5BC35B') }),
  flame_head: (a, p) => ({ back: flame(a.cx, a.headTop + 4, 1, p.accent, GOLD) }),
  crown: (a) => { const y = a.headTop + 4; const w = Math.min(28, a.headRx * 0.6); return { front: path(`M${a.cx - w} ${y} L${a.cx - w} ${y - 18} L${a.cx - w / 2} ${y - 8} L${a.cx} ${y - 22} L${a.cx + w / 2} ${y - 8} L${a.cx + w} ${y - 18} L${a.cx + w} ${y} Z`, ink(GOLD, 3)) + circle(a.cx, y - 8, 3.5, { fill: '#E5484D' }) }; },
  halo: (a) => ({ back: ellipse(a.cx, a.headTop - 10, 20, 6, { fill: 'none', stroke: GOLD, 'stroke-width': 5 }) }),
  wizard_hat: (a, p) => ({ front: path(`M${a.cx - 30} ${a.headTop + 12} Q${a.cx} ${a.headTop + 2} ${a.cx + 30} ${a.headTop + 12} L${a.cx + 8} ${a.headTop + 4} L${a.cx + 14} ${a.headTop - 34} L${a.cx - 12} ${a.headTop + 2} Z`, ink(p.accent, 3)) + star4(a.cx + 4, a.headTop - 6, 5, GOLD) }),
  mushroom_cap: (a) => ({ front: path(`M${a.cx - 40} ${a.headTop + 18} Q${a.cx - 36} ${a.headTop - 22} ${a.cx} ${a.headTop - 24} Q${a.cx + 36} ${a.headTop - 22} ${a.cx + 40} ${a.headTop + 18} Q${a.cx} ${a.headTop + 6} ${a.cx - 40} ${a.headTop + 18} Z`, ink('#C94F7C', 3.5)) + circle(a.cx - 16, a.headTop - 6, 6, { fill: '#FFE3EE' }) + circle(a.cx + 12, a.headTop - 12, 5, { fill: '#FFE3EE' }) + circle(a.cx + 24, a.headTop + 4, 4, { fill: '#FFE3EE' }) }),
  magnet: (a) => ({ front: path(`M${a.cx - 14} ${a.headTop + 6} L${a.cx - 14} ${a.headTop - 10} A14 14 0 0 1 ${a.cx + 14} ${a.headTop - 10} L${a.cx + 14} ${a.headTop + 6} L${a.cx + 6} ${a.headTop + 6} L${a.cx + 6} ${a.headTop - 10} A6 6 0 0 0 ${a.cx - 6} ${a.headTop - 10} L${a.cx - 6} ${a.headTop + 6} Z`, ink('#E5484D', 3)) + path(`M${a.cx - 14} ${a.headTop + 6} L${a.cx - 6} ${a.headTop + 6} L${a.cx - 6} ${a.headTop} L${a.cx - 14} ${a.headTop} Z M${a.cx + 6} ${a.headTop + 6} L${a.cx + 14} ${a.headTop + 6} L${a.cx + 14} ${a.headTop} L${a.cx + 6} ${a.headTop} Z`, { fill: '#E8EEF5' }) }),
  coral: (a) => ({ back: both((s) => { const x = a.cx + s * 16; const t = a.headTop + 6; return path(`M${x} ${t} L${x + s * 4} ${t - 22} M${x + s * 3} ${t - 12} L${x + s * 14} ${t - 20} M${x + s * 2} ${t - 6} L${x - s * 8} ${t - 16}`, line(7, '#FF7A8A')) + path(`M${x} ${t} L${x + s * 4} ${t - 22} M${x + s * 3} ${t - 12} L${x + s * 14} ${t - 20} M${x + s * 2} ${t - 6} L${x - s * 8} ${t - 16}`, line(3, '#FFB3BD')); }) }),
  volcano: (a) => { const t = a.headTop + 4; return { front: path(`M${a.cx - 20} ${t + 8} L${a.cx - 10} ${t - 12} L${a.cx + 10} ${t - 12} L${a.cx + 20} ${t + 8} Z`, ink('#6B4A3A', 3)) + ellipse(a.cx, t - 12, 10, 4, { fill: '#FF5A1F', stroke: OUTLINE, 'stroke-width': 3 }) + circle(a.cx - 6, t - 26, 6, ink('#D9D2CC', 2.5)) + circle(a.cx + 6, t - 34, 8, ink('#D9D2CC', 2.5)) }; },
  // ---- 날개 / 꼬리 / 지느러미
  wings_bat: (a, p) => ({ back: both((s) => { const x = s > 0 ? a.right - 6 : a.left + 6; const y = a.cy - 8; const ox = x + s * 40; return path(`M${x} ${y - 14} L${ox} ${y - 22} Q${ox - s * 4} ${y + 2} ${x + s * 26} ${y - 2} Q${x + s * 22} ${y + 12} ${x + s * 12} ${y + 6} Q${x + s * 6} ${y + 16} ${x} ${y + 10} Z`, ink(p.dark)); }) }),
  wings_bird: (a, p) => ({ back: both((s) => { const x = s > 0 ? a.right - 4 : a.left + 4; return el('g', { transform: rot(s * -24, x, a.cy) }, ellipse(x + s * 10, a.cy, 14, 22, ink(p.dark))); }) }),
  wings_bee: (a) => ({ back: both((s) => el('g', { transform: rot(s * 30, a.cx + s * a.rx * 0.7, a.top + 10) }, ellipse(a.cx + s * a.rx * 0.7, a.top + 4, 13, 22, { fill: '#E8F7FF', opacity: 0.85, stroke: OUTLINE, 'stroke-width': 3 }))) }),
  wings_fairy: (a) => ({ back: both((s) => el('g', { transform: rot(s * 40, a.cx + s * a.rx * 0.6, a.cy - 6) }, ellipse(a.cx + s * a.rx * 0.95, a.cy - 16, 16, 26, { fill: '#FFE3F6', opacity: 0.9, stroke: OUTLINE, 'stroke-width': 3 }))) }),
  tail_fox: (a, p) => ({ back: path(`M${a.right - 10} ${a.bottom - 10} Q${a.right + 26} ${a.bottom - 6} ${a.right + 18} ${a.cy - 30} Q${a.right + 10} ${a.cy - 4} ${a.right - 14} ${a.cy + 10} Z`, ink(p.main)) + path(`M${a.right + 12} ${a.cy - 18} Q${a.right + 20} ${a.cy - 28} ${a.right + 18} ${a.cy - 30} Q${a.right + 10} ${a.cy - 20} ${a.right + 8} ${a.cy - 12} Z`, { fill: WHITE }) }),
  tail_flame: (a, p) => ({ back: flame(a.right + 6, a.cy + 8, 0.9, p.accent, GOLD) }),
  tail_fish: (a, p) => ({ back: path(`M${a.right - 6} ${a.cy} L${a.right + 22} ${a.cy - 20} Q${a.right + 14} ${a.cy} ${a.right + 22} ${a.cy + 20} Z`, ink(p.dark)) }),
  tail_devil: (a) => ({ back: path(`M${a.right - 10} ${a.bottom - 8} Q${a.right + 18} ${a.bottom} ${a.right + 16} ${a.cy - 4}`, line(4)) + path(`M${a.right + 10} ${a.cy - 2} L${a.right + 16} ${a.cy - 16} L${a.right + 22} ${a.cy - 2} Z`, ink('#3B3B58', 3)) }),
  tail_lizard: (a, p) => ({ back: path(`M${a.right - 12} ${a.bottom - 14} Q${a.right + 24} ${a.bottom} ${a.right + 20} ${a.cy - 10} Q${a.right + 8} ${a.bottom - 10} ${a.right - 14} ${a.cy + 8} Z`, ink(p.main)) }),
  stinger: (a) => ({ back: path(`M${a.cx - 8} ${a.bottom - 4} L${a.cx} ${a.bottom + 14} L${a.cx + 8} ${a.bottom - 4} Z`, ink('#3B3B58', 3)) }),
  fins: (a, p) => ({ front: both((s) => path(`M${a.cx + s * a.rx * 0.8} ${a.cy + 4} L${a.cx + s * (a.rx + 14)} ${a.cy + 16} L${a.cx + s * a.rx * 0.7} ${a.cy + 18} Z`, ink(p.dark, 3))) }),
  fin_top: (a, p) => ({ back: path(`M${a.cx - 18} ${a.top + 6} Q${a.cx} ${a.top - 22} ${a.cx + 20} ${a.top + 4} Z`, ink(p.dark, 3)) }),
  tentacles: (a, p) => ({ back: [-24, -8, 8, 24].map((dx) => path(`M${a.cx + dx} ${a.bottom - 8} q-6 10 0 18 q6 8 0 16`, line(6, p.dark)) + path(`M${a.cx + dx} ${a.bottom - 8} q-6 10 0 18 q6 8 0 16`, line(2.5, p.light))).join('') }),
  lotus: (a) => ({ back: [-1, -0.5, 0, 0.5, 1].map((t) => el('g', { transform: rot(t * 60, a.cx, a.bottom - 4) }, ellipse(a.cx, a.bottom - 14, 11, 22, ink('#FFB3D9', 3)))).join('') }),
  // ---- 몸통 장식
  spikes: (a, p) => ({ back: spikeRing(a, p.dark, 190, 350, 7, 18) }),
  spikes_big: (a, p) => ({ back: spikeRing(a, p.accent, 185, 355, 9, 24) }),
  legs: (a, p) => ({ back: both((s) => ellipse(a.cx + s * a.rx * 0.45, a.bottom - 1, 11, 8, ink(p.dark, 3))) }),
  arms: (a, p) => ({ front: both((s) => el('g', { transform: rot(s * -20, a.cx + s * a.rx * 0.88, a.cy + 8) }, ellipse(a.cx + s * a.rx * 0.88, a.cy + 8, 8, 12, ink(p.main, 3)))) }),
  arms_rock: (a, p) => ({ back: both((s) => circle(a.cx + s * (a.rx + 6), a.cy + 14, 14, ink(p.dark))) }),
  shell_pattern: (_a, p) => ({ mid: [[64, 58], [44, 72], [84, 72], [64, 80]].map(([x, y]) => path(`M${x - 10} ${y} L${x - 5} ${y - 9} L${x + 5} ${y - 9} L${x + 10} ${y} L${x + 5} ${y + 9} L${x - 5} ${y + 9} Z`, { fill: p.light, stroke: p.dark, 'stroke-width': 3 })).join('') }),
  shell_split: (a, p) => ({ mid: path(`M${a.cx} ${a.top} L${a.cx} ${a.bottom}`, line(3.5, p.dark)) + ellipse(a.cx - a.rx * 0.45, a.cy - 6, 8, 5, { fill: WHITE, opacity: 0.35 }) }),
  lava_cracks: (a) => ({ mid: path(`M${a.cx - 30} ${a.cy - 10} l10 8 l-4 10 l12 6 M${a.cx + 10} ${a.top + 10} l6 12 l-8 8 l10 10 M${a.cx + 30} ${a.cy} l-8 10 l6 8`, line(4, '#FF7A1A')) }),
  cracks: (a, p) => ({ mid: path(`M${a.cx - 24} ${a.top + 14} l8 10 l-6 8 M${a.cx + 18} ${a.cy + 8} l10 6 l-4 10 M${a.cx + 6} ${a.top + 6} l-4 12`, line(3, p.dark)) }),
  runes: (a, p) => ({ mid: path(`M${a.cx - 20} ${a.cy + 18} l8 -8 l8 8 l8 -8 l8 8 M${a.cx - 30} ${a.top + 14} l6 0 M${a.cx + 24} ${a.top + 14} l6 0`, line(3.5, p.accent)) }),
  spots: (a, p) => ({ mid: [[-0.5, -0.3, 7], [0.55, -0.15, 5], [0.3, 0.45, 6], [-0.6, 0.35, 4]].map(([x, y, r]) => circle(a.cx + x * a.rx, a.cy + y * a.ry, r, { fill: p.light, opacity: 0.85 })).join('') }),
  stripes: (a) => ({ mid: [0.05, 0.4, 0.75].map((t) => ellipse(a.cx, a.top + a.ry * 2 * t + 14, a.rx * 1.2, 5.5, { fill: '#2A1F2D', opacity: 0.85 })).join('') }),
  bolt_mark: (a) => ({ mid: path(`M${a.cx + 4} ${a.cy + 4} L${a.cx - 8} ${a.cy + 20} L${a.cx + 1} ${a.cy + 20} L${a.cx - 5} ${a.cy + 34} L${a.cx + 10} ${a.cy + 14} L${a.cx + 1} ${a.cy + 14} Z`, ink(GOLD, 2.5)) }),
  stitches: (a) => ({ mid: path(`M${a.cx + 2} ${a.top} Q${a.cx - 6} ${a.cy} ${a.cx + 2} ${a.bottom}`, line(3)) + [-0.6, -0.2, 0.2, 0.6].map((t) => path(`M${a.cx - 6} ${a.cy + t * a.ry} l12 4`, line(2.5))).join('') }),
  patch_half: (a, p) => ({ mid: path(`M${a.cx + 2} ${a.top - 4} Q${a.cx - 6} ${a.cy} ${a.cx + 2} ${a.bottom + 4} L${a.right + 6} ${a.bottom + 4} L${a.right + 6} ${a.top - 4} Z`, { fill: p.accent, opacity: 0.85 }) }),
  earL_fox: (a, p) => ({ back: path(`M${a.cx - a.headRx * 0.55 - 14} ${a.headTop + 14} L${a.cx - a.headRx * 0.55 - 8} ${a.headTop - 22} L${a.cx - a.headRx * 0.55 + 14} ${a.headTop + 10} Z`, ink(p.main)) }),
  earR_bunny: (a, p) => ({ back: el('g', { transform: rot(16, a.cx + 14, a.headTop + 4) }, ellipse(a.cx + 14, a.headTop - 14, 9, 22, ink(p.accent)) + ellipse(a.cx + 14, a.headTop - 12, 4.5, 15, { fill: PINK })) }),
  split_line: (a) => ({ mid: path(`M${a.cx} ${a.top} l-6 12 l8 10 l-6 12 l8 12`, line(3.5, '#FFFFFF')) }),
  // ---- 얼굴 위 / 주변
  whiskers: (a) => ({ face: both((s) => path(`M${a.faceX + s * (a.eyeGap + 10)} ${a.faceY + 12} l${s * 14} -3 M${a.faceX + s * (a.eyeGap + 10)} ${a.faceY + 17} l${s * 14} 3`, line(2.5))) }),
  gem: (a, p) => ({ face: path(`M${a.faceX} ${a.faceY - a.eyeR * 2.6} l7 7 l-7 8 l-7 -8 Z`, ink(p.accent, 2.5)) }),
  mask: (a) => ({ face: path(`M${a.faceX - a.eyeGap - 14} ${a.faceY - 8} Q${a.faceX} ${a.faceY - 2} ${a.faceX + a.eyeGap + 14} ${a.faceY - 8} L${a.faceX + a.eyeGap + 12} ${a.faceY + 8} Q${a.faceX} ${a.faceY + 2} ${a.faceX - a.eyeGap - 12} ${a.faceY + 8} Z`, { fill: '#2A1F2D', opacity: 0.35 }) }),
  sparkles: (a) => ({ front: star4(a.left - 2, a.top + 8, 7, GOLD) + star4(a.right + 4, a.cy - 6, 5, GOLD) + star4(a.right - 6, a.top - 4, 4, WHITE) }),
  bubbles: (a) => ({ front: circle(a.right + 6, a.top + 4, 6, ink('#DDF4FF', 2.5)) + circle(a.right + 14, a.top - 10, 4, ink('#DDF4FF', 2)) }),
  steam: (a) => ({ back: circle(a.left + 2, a.top + 6, 9, ink('#F4F7FA', 3)) + circle(a.right - 2, a.top, 7, ink('#F4F7FA', 3)) }),
  zap: (a) => ({ front: path(`M${a.left - 4} ${a.top + 4} l8 6 l-6 4 l10 8`, line(3.5, GOLD)) + path(`M${a.right + 6} ${a.cy - 10} l-8 6 l6 4 l-10 8`, line(3.5, GOLD)) }),
  vines: (a) => ({ front: both((s) => { const x = a.cx + s * a.rx * 0.95; return path(`M${x} ${a.bottom - 6} Q${x + s * 16} ${a.cy} ${x} ${a.cy - 14} Q${x - s * 10} ${a.top + 6} ${x + s * 6} ${a.top - 2}`, line(5, '#3E8E3E')) + leaf(x + s * 4, a.cy + 6, 16, s > 0 ? -20 : -160, '#6CCB5F') + leaf(x - s * 2, a.top + 10, 14, s > 0 ? -60 : -120, '#6CCB5F'); }) }),
  claws: (a, p) => ({ back: both((s) => { const x = a.cx + s * (a.rx + 10); const y = a.cy - 6; return path(`M${x} ${y + 14} Q${x + s * 4} ${y - 18} ${x + s * 20} ${y - 14} L${x + s * 8} ${y - 4} L${x + s * 22} ${y + 2} Q${x + s * 10} ${y + 18} ${x} ${y + 14} Z`, ink(p.dark, 3.5)); }) }),
  snail_shell: (a) => ({ back: circle(a.right - 6, a.cy - 12, 30, ink('#C98B4F', 4)) + path(`M${a.right - 6} ${a.cy - 12} m0 -20 a20 20 0 1 1 -16 32 a12 12 0 1 1 10 -20 a5 5 0 1 1 -3 9`, line(4, '#7A4E2A')) }),
  tufts: (a, p) => ({ back: both((s) => { const x = a.cx + s * a.headRx * 0.55; const t = a.headTop + 8; return path(`M${x - 10} ${t + 6} Q${x + s * 2} ${t - 12} ${x + s * 14} ${t - 22} Q${x + s * 10} ${t - 4} ${x + 10} ${t + 6} Z`, ink(p.dark, 3)); }) }),
  fuse: (a) => ({ back: path(`M${a.cx + 6} ${a.headTop + 6} Q${a.cx + 18} ${a.headTop - 10} ${a.cx + 10} ${a.headTop - 22}`, line(4, '#8D6E63')) + star4(a.cx + 10, a.headTop - 26, 9, '#FF5A1F') + star4(a.cx + 10, a.headTop - 26, 4.5, GOLD) }),
  tusks: (a) => ({ face: both((s) => path(`M${a.faceX + s * a.eyeR * 1.2} ${a.faceY + a.eyeR * 1.6} Q${a.faceX + s * a.eyeR * 2.4} ${a.faceY + a.eyeR * 1.4} ${a.faceX + s * a.eyeR * 2.2} ${a.faceY - a.eyeR * 0.4} Q${a.faceX + s * a.eyeR * 1.8} ${a.faceY + a.eyeR * 1.0} ${a.faceX + s * a.eyeR * 1.0} ${a.faceY + a.eyeR * 2.1} Z`, ink('#FFF8E1', 2.5))) }),
  leafy: (a) => ({ back: [[-20, -6, 20], [0, -16, 24], [20, -6, 20], [-10, -24, 16], [12, -26, 16]].map(([dx, dy, r]) => circle(a.cx + dx, a.headTop + dy, r, ink('#4CAF50', 3.5))).join('') + circle(a.cx - 6, a.headTop - 20, 6, { fill: '#FFFFFF', opacity: 0.2 }) }),
  bow: (a) => ({ front: both((s) => path(`M${a.cx + s * 3} ${a.headTop + 6} L${a.cx + s * 16} ${a.headTop - 2} L${a.cx + s * 16} ${a.headTop + 14} Z`, ink('#FF6FA5', 3))) + circle(a.cx, a.headTop + 6, 4, ink('#FF6FA5', 2.5)) }),
};
