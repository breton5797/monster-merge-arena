// SVG 문자열 조립 헬퍼 (Phaser 의존 없음)

export const OUTLINE = '#2A1F2D';
export const STROKE_W = 4;

export type Attrs = Record<string, string | number | undefined>;

export function el(tag: string, attrs: Attrs, children = ''): string {
  const a = Object.entries(attrs)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');
  return children ? `<${tag} ${a}>${children}</${tag}>` : `<${tag} ${a}/>`;
}

export const path = (d: string, attrs: Attrs = {}) => el('path', { d, ...attrs });
export const circle = (cx: number, cy: number, r: number, attrs: Attrs = {}) => el('circle', { cx: r2(cx), cy: r2(cy), r: r2(r), ...attrs });
export const ellipse = (cx: number, cy: number, rx: number, ry: number, attrs: Attrs = {}) => el('ellipse', { cx: r2(cx), cy: r2(cy), rx: r2(rx), ry: r2(ry), ...attrs });

export function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 외곽선 + 채우기 기본 스타일 */
export function ink(fill: string, width = STROKE_W): Attrs {
  return { fill, stroke: OUTLINE, 'stroke-width': width, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };
}

export function line(width = STROKE_W, color = OUTLINE): Attrs {
  return { fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
}

/** pad: 파츠(귀·날개·가시)가 잘리지 않도록 그림 영역 바깥 여백 */
export function svgDoc(size: number, body: string, defs = '', pad = 0): string {
  const v = size + pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${pad ? -pad - 6 : 0} ${v} ${v}" width="${v}" height="${v}">${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>`;
}

// ---------------------------------------------------------------- 색 계산

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(n)) throw new Error(`잘못된 색: ${hex}`);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(rgb: [number, number, number]): string {
  return `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}

/** amount > 0 밝게, < 0 어둡게 (-1~1) */
export function shade(hex: string, amount: number): string {
  const rgb = parseHex(hex);
  return toHex(rgb.map((v) => (amount >= 0 ? v + (255 - v) * amount : v * (1 + amount))) as [number, number, number]);
}

export function mix(a: string, b: string, t: number): string {
  const x = parseHex(a);
  const y = parseHex(b);
  return toHex([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * t) as [number, number, number]);
}

export function toDataUri(svg: string): string {
  // btoa는 Latin-1만 지원 → UTF-8 안전하게 인코딩
  const bytes = new TextEncoder().encode(svg);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return `data:image/svg+xml;base64,${btoa(bin)}`;
}
