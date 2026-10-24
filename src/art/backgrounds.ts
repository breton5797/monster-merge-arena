import { createRng, type Rng } from '../systems/rng';
import { circle, el, ellipse, ink, line, path, r2, shade } from './svg';

// 스테이지 전장 배경 (폭 720, 높이 = 전장 높이). 테마별 팔레트 + 장식, 시드 고정이라 매번 같은 그림.

export type ThemeId = 'forest' | 'canyon' | 'coast' | 'cave' | 'snow' | 'storm';

interface Theme {
  readonly ground: [string, string];
  readonly lane: string;
  readonly detail: string;
  readonly deco: (rng: Rng, x: number, y: number, s: number) => string;
  readonly speck: (rng: Rng, x: number, y: number) => string;
}

const W = 720;

const tree = (x: number, y: number, s: number, c: string) =>
  path(`M${x - 5 * s} ${y} L${x - 5 * s} ${y - 18 * s} L${x + 5 * s} ${y - 18 * s} L${x + 5 * s} ${y} Z`, ink('#6D4C3D', 3)) +
  circle(x, y - 34 * s, 22 * s, ink(c, 3.5)) + circle(x - 14 * s, y - 24 * s, 14 * s, ink(c, 3.5)) + circle(x + 14 * s, y - 24 * s, 14 * s, ink(c, 3.5)) +
  circle(x - 6 * s, y - 40 * s, 7 * s, { fill: '#FFFFFF', opacity: 0.18 });
const boulder = (x: number, y: number, s: number, c: string) =>
  path(`M${x - 22 * s} ${y} L${x - 16 * s} ${y - 20 * s} L${x + 2 * s} ${y - 28 * s} L${x + 20 * s} ${y - 16 * s} L${x + 24 * s} ${y} Z`, ink(c, 3.5)) + path(`M${x - 8 * s} ${y - 20 * s} L${x + 4 * s} ${y - 8 * s}`, line(2.5, shade(c, -0.3)));
const crystal = (x: number, y: number, s: number, c: string) =>
  [[-10, 26, -8], [0, 40, 0], [11, 22, 10]].map(([dx, h, tilt]) => path(`M${x + dx * s - 6 * s} ${y} L${x + dx * s + tilt * 0.4 * s} ${y - h * s} L${x + dx * s + 6 * s} ${y} Z`, ink(c, 3))).join('');
const palm = (x: number, y: number, s: number) =>
  path(`M${x} ${y} Q${x + 6 * s} ${y - 30 * s} ${x + 2 * s} ${y - 54 * s}`, line(7 * s, '#8D6E63')) +
  [-150, -110, -60, -20].map((a) => el('g', { transform: `rotate(${a} ${r2(x + 2 * s)} ${r2(y - 54 * s)})` }, ellipse(x + 2 * s + 22 * s, y - 54 * s, 24 * s, 7 * s, ink('#4CAF50', 3)))).join('');
const pine = (x: number, y: number, s: number) =>
  path(`M${x} ${y - 60 * s} L${x + 22 * s} ${y - 10 * s} L${x - 22 * s} ${y - 10 * s} Z`, ink('#2E7D5B', 3)) + path(`M${x} ${y - 60 * s} L${x + 12 * s} ${y - 36 * s} L${x - 12 * s} ${y - 36 * s} Z`, { fill: '#FFFFFF', opacity: 0.85 }) + path(`M${x - 4 * s} ${y} L${x - 4 * s} ${y - 10 * s} L${x + 4 * s} ${y - 10 * s} L${x + 4 * s} ${y} Z`, ink('#6D4C3D', 2.5));

const THEMES: Record<ThemeId, Theme> = {
  forest: {
    ground: ['#2F6B3E', '#4C9A52'], lane: '#C9A66B', detail: '#7BC86C',
    deco: (r, x, y, s) => (r.next() < 0.75 ? tree(x, y, s, r.next() < 0.5 ? '#3E9B4F' : '#56B45E') : boulder(x, y, s * 0.7, '#9E9E8E')),
    speck: (r, x, y) => path(`M${x} ${y} l-4 -9 M${x} ${y} l0 -11 M${x} ${y} l4 -9`, line(2.5, r.next() < 0.5 ? '#7BC86C' : '#9BDD74')),
  },
  canyon: {
    ground: ['#7A3324', '#B5573A'], lane: '#E0A273', detail: '#E67F4F',
    deco: (r, x, y, s) => boulder(x, y, s, r.next() < 0.5 ? '#A0522D' : '#8D4A2E'),
    speck: (r, x, y) => (r.next() < 0.3 ? path(`M${x} ${y} l8 4 l-4 6 l8 3`, line(2.5, '#FF8A3D')) : circle(x, y, 2.5, { fill: '#5A2A1E', opacity: 0.6 })),
  },
  coast: {
    ground: ['#2A6FA8', '#E8D49A'], lane: '#F3E3B5', detail: '#FFFFFF',
    deco: (r, x, y, s) => (r.next() < 0.6 ? palm(x, y, s) : boulder(x, y, s * 0.6, '#8FA3B0')),
    speck: (r, x, y) => (r.next() < 0.5 ? circle(x, y, 2, { fill: '#C9B27A' }) : path(`M${x - 5} ${y} q5 -6 10 0`, line(2, '#FFFFFF'))),
  },
  cave: {
    ground: ['#1E1B3A', '#3B3566'], lane: '#5E5690', detail: '#9F8CFF',
    deco: (r, x, y, s) => crystal(x, y, s, r.next() < 0.5 ? '#9F8CFF' : '#5FD4E8'),
    speck: (r, x, y) => circle(x, y, r.next() * 2 + 1, { fill: '#B8A9FF', opacity: 0.6 }),
  },
  snow: {
    ground: ['#6F8FAF', '#E3EEF7'], lane: '#C5D7E6', detail: '#FFFFFF',
    deco: (r, x, y, s) => (r.next() < 0.7 ? pine(x, y, s) : boulder(x, y, s * 0.6, '#B0BEC5')),
    speck: (_r, x, y) => circle(x, y, 2.5, { fill: '#FFFFFF', opacity: 0.8 }),
  },
  storm: {
    ground: ['#1F2A3A', '#3E5068'], lane: '#5A6E86', detail: '#FFD23F',
    deco: (r, x, y, s) => (r.next() < 0.5 ? boulder(x, y, s, '#4E5D70') : crystal(x, y, s * 0.8, '#FFD23F')),
    speck: (r, x, y) => (r.next() < 0.15 ? path(`M${x} ${y} l6 -8 l-2 6 l6 -8`, line(2, '#FFE066')) : circle(x, y, 1.8, { fill: '#9DB2CC', opacity: 0.5 })),
  },
};

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];

/** lanes: 레인 중심 x 목록, laneW: 길 폭, H: 전장 높이 */
export function backgroundSvg(theme: ThemeId, lanes: readonly number[], laneW: number, H: number, seed = 7): string {
  const t = THEMES[theme];
  const rng = createRng(seed);
  const defs =
    `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.ground[0]}"/><stop offset="1" stop-color="${t.ground[1]}"/></linearGradient>` +
    `<linearGradient id="fog" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0.55"/><stop offset="0.35" stop-color="#000" stop-opacity="0"/></linearGradient>`;
  let s = el('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#g)' });
  for (let i = 0; i < 220; i++) s += t.speck(rng, rng.next() * W, rng.next() * H);
  for (const x of lanes) {
    let d = `M${x - laneW / 2} 0`;
    for (let y = 0; y <= H; y += 70) d += ` L${r2(x - laneW / 2 + (rng.next() - 0.5) * 10)} ${y}`;
    for (let y = H; y >= 0; y -= 70) d += ` L${r2(x + laneW / 2 + (rng.next() - 0.5) * 10)} ${y}`;
    s += path(`${d} Z`, { fill: t.lane, opacity: 0.38 }) + path(`M${x} 0 L${x} ${H}`, { stroke: t.lane, 'stroke-width': 3, 'stroke-dasharray': '14 18', opacity: 0.45 });
  }
  // 양옆 장식 (레인 바깥 여백) — 아래로 갈수록 크게 (원근)
  for (let y = 40; y < H + 40; y += 70) {
    const k = 0.55 + (y / H) * 0.5;
    s += t.deco(rng, 18 + rng.next() * 18, y, k * 0.75) + t.deco(rng, W - 18 - rng.next() * 18, y + 30, k * 0.75);
  }
  s += el('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#fog)' });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs>${defs}</defs>${s}</svg>`;
}

export const backgroundKey = (theme: ThemeId) => `bg-${theme}`;
export const thumbKey = (theme: ThemeId) => `bgthumb-${theme}`;
