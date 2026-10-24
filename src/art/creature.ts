import { circle, el, ellipse, ink, line, OUTLINE, path, r2, shade, svgDoc } from './svg';
import { PARTS, type PartLayer } from './parts';

// 캐릭터 SVG 생성: 몸통 + 음영 + 배 + 파츠 + 얼굴. 모든 캐릭터가 같은 화풍(두꺼운 외곽선, 큰 눈)을 공유한다.

export const ART_SIZE = 128;
/** 캔버스 여백 — 최종 viewBox는 ART_SIZE + 2×ART_PAD */
export const ART_PAD = 22;

export type BodyType = 'round' | 'egg' | 'wide' | 'tall' | 'drop' | 'slime' | 'golem' | 'cloud' | 'ghost' | 'turtle' | 'fish';
export type EyeType = 'round' | 'happy' | 'angry' | 'sleepy' | 'sparkle' | 'one' | 'dot' | 'glow' | 'fierce';
export type MouthType = 'smile' | 'open' | 'fang' | 'cat' | 'beak' | 'grin' | 'none' | 'frown' | 'o';

export interface CreatureSpec {
  readonly id: string;
  readonly body: BodyType;
  readonly color: string;
  readonly belly?: string;
  readonly accent?: string;
  readonly eyes: EyeType;
  readonly mouth: MouthType;
  readonly parts: readonly string[];
}

export interface Anchors {
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly faceX: number;
  readonly faceY: number;
  readonly eyeGap: number;
  readonly eyeR: number;
  /** 머리 위 파츠 기준 (몸통과 머리가 다른 거북 등) */
  readonly headTop: number;
  readonly headRx: number;
}

export interface Palette {
  readonly main: string;
  readonly dark: string;
  readonly light: string;
  readonly belly: string;
  readonly accent: string;
}

interface Body {
  /** 채우기용 도형 (외곽선 없음) */
  readonly fill: (color: string) => string;
  /** 외곽선 */
  readonly outline: string;
  /** clipPath 내용 */
  readonly clip: string;
  readonly a: Anchors;
  /** 원 여러 개로 된 몸통은 외곽선을 채우기 뒤에 그려 내부 선을 숨긴다 */
  readonly outlineBehind?: boolean;
  /** 몸통 외곽선 위에 그리는 별도 부위 (거북 머리 등) */
  readonly overlay?: (p: Palette) => string;
}

function anchors(cx: number, cy: number, rx: number, ry: number, over: Partial<Anchors> = {}): Anchors {
  return {
    cx, cy, rx, ry,
    top: cy - ry, bottom: cy + ry, left: cx - rx, right: cx + rx,
    faceX: cx, faceY: cy - ry * 0.1, eyeGap: rx * 0.4, eyeR: Math.min(rx, ry) * 0.23,
    headTop: cy - ry, headRx: rx,
    ...over,
  };
}

function pathBody(d: string, a: Anchors): Body {
  return { fill: (c) => path(d, { fill: c }), outline: path(d, ink('none')), clip: path(d), a };
}

function ellipseBody(cx: number, cy: number, rx: number, ry: number, over: Partial<Anchors> = {}): Body {
  return { fill: (c) => ellipse(cx, cy, rx, ry, { fill: c }), outline: ellipse(cx, cy, rx, ry, ink('none')), clip: ellipse(cx, cy, rx, ry), a: anchors(cx, cy, rx, ry, over) };
}

function circlesBody(circles: readonly [number, number, number][], a: Anchors): Body {
  const each = (attrs: Record<string, string | number>) => circles.map(([x, y, r]) => circle(x, y, r, attrs)).join('');
  return { fill: (c) => each({ fill: c }), outline: each({ ...ink(OUTLINE), 'stroke-width': 8 }), clip: each({}), a, outlineBehind: true };
}

const BODIES: Record<BodyType, () => Body> = {
  round: () => ellipseBody(64, 76, 38, 35),
  egg: () => ellipseBody(64, 72, 32, 40, { faceY: 66 }),
  wide: () => ellipseBody(64, 82, 46, 30, { faceY: 78, eyeR: 7.5 }),
  tall: () => ellipseBody(64, 70, 29, 44, { faceY: 58 }),
  drop: () => pathBody('M64 22 C72 40 100 56 100 80 A36 36 0 1 1 28 80 C28 56 56 40 64 22 Z', anchors(64, 80, 36, 36, { top: 30, headTop: 34, faceY: 80 })),
  slime: () =>
    pathBody(
      'M20 108 C18 64 36 40 64 40 C92 40 110 64 108 108 C100 114 94 108 86 112 C78 116 72 108 64 112 C56 116 50 108 42 112 C34 116 28 108 20 108 Z',
      anchors(64, 78, 44, 36, { top: 40, faceY: 76 }),
    ),
  golem: () => pathBody('M30 40 Q30 32 40 32 L88 32 Q98 32 98 40 L104 104 Q104 112 96 112 L32 112 Q24 112 24 104 Z', anchors(64, 72, 40, 40, { top: 32, faceY: 62, eyeR: 7.5, eyeGap: 17 })),
  cloud: () =>
    circlesBody(
      [[64, 62, 28], [40, 78, 24], [88, 78, 24], [64, 88, 26], [48, 58, 16], [82, 58, 16]],
      anchors(64, 76, 46, 36, { top: 34, faceY: 72, eyeGap: 15, eyeR: 8 }),
    ),
  ghost: () => pathBody('M28 108 L28 64 C28 38 44 26 64 26 C84 26 100 38 100 64 L100 108 L90 100 L80 110 L70 100 L58 110 L48 100 L38 110 Z', anchors(64, 70, 36, 42, { top: 26, faceY: 62 })),
  turtle: () => {
    // 등껍질 돔(뒤) + 머리(앞). 얼굴은 머리 기준
    const shell = 'M16 98 C16 58 38 40 64 40 C90 40 112 58 112 98 Z';
    const a = anchors(64, 84, 48, 44, { top: 40, bottom: 104, faceX: 64, faceY: 86, eyeGap: 10, eyeR: 6.5, headTop: 40, headRx: 46 });
    return {
      fill: (c) => path(shell, { fill: c }),
      outline: path(shell, ink('none')),
      clip: path(shell),
      a,
      overlay: (p) =>
        ellipse(46, 104, 9, 7, ink(p.belly)) + ellipse(82, 104, 9, 7, ink(p.belly)) +
        circle(64, 86, 22, ink(p.belly)) + ellipse(56, 78, 7, 5, { fill: '#FFFFFF', opacity: 0.45 }),
    };
  },
  fish: () => ellipseBody(60, 74, 44, 32, { faceX: 50, faceY: 70, eyeGap: 15 }),
};

export function palette(spec: CreatureSpec): Palette {
  const main = spec.color;
  return { main, dark: shade(main, -0.32), light: shade(main, 0.45), belly: spec.belly ?? shade(main, 0.62), accent: spec.accent ?? shade(main, -0.45) };
}

// ---------------------------------------------------------------- 얼굴

function eye(x: number, y: number, r: number, type: EyeType, p: Palette, side: -1 | 1): string {
  switch (type) {
    case 'happy':
      return path(`M${x - r} ${y + 2} Q${x} ${y - r * 1.3} ${x + r} ${y + 2}`, line(4.5));
    case 'sleepy':
      return path(`M${x - r} ${y} Q${x} ${y + r} ${x + r} ${y}`, line(4.5)) + path(`M${x - r} ${y - 1} L${x + r} ${y - 1}`, line(3));
    case 'dot':
      return ellipse(x, y, r * 0.42, r * 0.6, { fill: OUTLINE }) + circle(x + r * 0.15, y - r * 0.25, r * 0.16, { fill: '#fff' });
    case 'glow':
      return ellipse(x, y, r * 0.95, r * 0.55, { fill: p.accent, stroke: OUTLINE, 'stroke-width': 3 }) + ellipse(x, y, r * 0.5, r * 0.25, { fill: '#FFFFFF', opacity: 0.8 });
    default: {
      const big = type === 'sparkle' || type === 'one';
      const rr = big ? r * 1.15 : r;
      const iris = type === 'sparkle' ? p.accent : OUTLINE;
      let s = circle(x, y, rr, ink('#FFFFFF', 3)) + circle(x + side * rr * 0.12, y + rr * 0.12, rr * 0.62, { fill: iris });
      if (type === 'sparkle') s += circle(x + side * rr * 0.12, y + rr * 0.12, rr * 0.32, { fill: OUTLINE });
      s += circle(x + side * rr * 0.12 + rr * 0.22, y - rr * 0.2, rr * 0.24, { fill: '#FFFFFF' });
      if (type === 'sparkle') s += circle(x - rr * 0.18, y + rr * 0.38, rr * 0.12, { fill: '#FFFFFF' });
      if (type === 'angry' || type === 'fierce') {
        const by = y - rr * 1.25;
        s += path(`M${x - side * rr * 1.1} ${by - (type === 'fierce' ? 5 : 3)} L${x + side * rr * 0.9} ${by + 4}`, line(5));
      }
      return s;
    }
  }
}

function mouth(a: Anchors, type: MouthType, eyeR: number): string {
  const x = a.faceX;
  const y = a.faceY + eyeR * 1.7;
  const w = eyeR * 0.9;
  switch (type) {
    case 'smile':
      return path(`M${x - w} ${y} Q${x} ${y + w * 1.1} ${x + w} ${y}`, line(3.5));
    case 'open':
      return path(`M${x - w} ${y - 1} Q${x} ${y + w * 2} ${x + w} ${y - 1} Z`, ink('#7A2335', 3)) + ellipse(x, y + w * 0.7, w * 0.5, w * 0.3, { fill: '#FF8FA3' });
    case 'fang':
      return path(`M${x - w} ${y} Q${x} ${y + w} ${x + w} ${y}`, line(3.5)) + path(`M${x - w * 0.5} ${y + 1} L${x - w * 0.3} ${y + w * 0.9} L${x - w * 0.05} ${y + 2}`, ink('#FFFFFF', 2));
    case 'cat':
      return path(`M${x - w} ${y} Q${x - w / 2} ${y + w * 0.8} ${x} ${y} Q${x + w / 2} ${y + w * 0.8} ${x + w} ${y}`, line(3.5));
    case 'beak':
      return path(`M${x - w * 0.9} ${y - 3} L${x + w * 0.9} ${y - 3} L${x} ${y + w * 1.2} Z`, ink('#FFB020', 3));
    case 'grin':
      return path(`M${x - w * 1.3} ${y - 2} Q${x} ${y + w * 1.6} ${x + w * 1.3} ${y - 2} Z`, ink('#FFFFFF', 3)) + path(`M${x - w * 0.4} ${y - 1} L${x - w * 0.4} ${y + w * 0.8} M${x + w * 0.4} ${y - 1} L${x + w * 0.4} ${y + w * 0.8}`, line(2));
    case 'frown':
      return path(`M${x - w} ${y + w * 0.6} Q${x} ${y - w * 0.4} ${x + w} ${y + w * 0.6}`, line(3.5));
    case 'o':
      return ellipse(x, y + w * 0.4, w * 0.45, w * 0.55, ink('#7A2335', 3));
    case 'none':
      return '';
  }
}

function face(spec: CreatureSpec, a: Anchors, p: Palette): string {
  if (spec.eyes === 'one') return eye(a.faceX, a.faceY - 2, a.eyeR * 1.3, 'one', p, 1) + mouth(a, spec.mouth, a.eyeR * 1.2);
  return eye(a.faceX - a.eyeGap, a.faceY, a.eyeR, spec.eyes, p, -1) + eye(a.faceX + a.eyeGap, a.faceY, a.eyeR, spec.eyes, p, 1) + mouth(a, spec.mouth, a.eyeR);
}

// ---------------------------------------------------------------- 조립

export function bodyAnchors(type: BodyType): Anchors {
  return BODIES[type]().a;
}

export function creatureSvg(spec: CreatureSpec): string {
  const body = BODIES[spec.body]();
  const a = body.a;
  const p = palette(spec);
  const layers: Record<PartLayer, string[]> = { back: [], mid: [], front: [], face: [] };
  const parts = spec.parts.filter((x) => x !== 'nobelly' && x !== 'nocheeks');
  for (const name of parts) {
    const fn = PARTS[name];
    if (!fn) throw new Error(`art: 알 수 없는 파츠 '${name}' (${spec.id})`);
    const out = fn(a, p, spec);
    for (const k of Object.keys(out) as PartLayer[]) layers[k].push(out[k] ?? '');
  }
  const clipId = `c-${spec.id}`;
  const belly = spec.parts.includes('nobelly') || spec.body === 'turtle' ? '' : ellipse(a.cx, a.cy + a.ry * 0.38, a.rx * 0.58, a.ry * 0.5, { fill: p.belly, opacity: 0.9 });
  const shading =
    ellipse(a.cx + a.rx * 0.25, a.bottom + a.ry * 0.15, a.rx * 1.1, a.ry * 0.75, { fill: p.dark, opacity: 0.45 }) +
    ellipse(a.cx - a.rx * 0.35, a.top + a.ry * 0.45, a.rx * 0.32, a.ry * 0.22, { fill: '#FFFFFF', opacity: 0.45 });
  const cheeks = spec.parts.includes('nocheeks') || spec.eyes === 'glow' ? '' : ellipse(a.faceX - a.eyeGap - a.eyeR * 0.6, a.faceY + a.eyeR * 1.35, a.eyeR * 0.75, a.eyeR * 0.42, { fill: '#FF6F91', opacity: 0.45 }) + ellipse(a.faceX + a.eyeGap + a.eyeR * 0.6, a.faceY + a.eyeR * 1.35, a.eyeR * 0.75, a.eyeR * 0.42, { fill: '#FF6F91', opacity: 0.45 });
  const ground = ellipse(64, 116, 40, 7, { fill: '#000000', opacity: 0.22 });
  const filled = el('g', { 'clip-path': `url(#${clipId})` }, body.fill(p.main) + belly + layers.mid.join('') + shading);
  const outlined = body.outlineBehind ? body.outline + filled : filled + body.outline;
  const doc = ground + layers.back.join('') + outlined + (body.overlay?.(p) ?? '') + layers.front.join('') + face(spec, a, p) + cheeks + layers.face.join('');
  return svgDoc(ART_SIZE, doc, el('clipPath', { id: clipId }, body.clip), ART_PAD);
}

export { r2 };
