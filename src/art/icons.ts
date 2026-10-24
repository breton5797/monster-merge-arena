import { circle, ellipse, ink, line, OUTLINE, path, svgDoc } from './svg';

// UI 아이콘 (64×64). 캐릭터와 같은 외곽선 화풍 — 플랫폼마다 다른 이모지 대신 사용한다.

const S = 64;
const GOLD = '#FFC93C';

const bolt = (fill: string) => path('M36 6 L14 36 L30 36 L26 58 L50 26 L34 26 Z', ink(fill, 4));
const drop = (fill: string) => path('M32 6 C38 18 52 28 52 40 A20 20 0 1 1 12 40 C12 28 26 18 32 6 Z', ink(fill, 4)) + ellipse(25, 38, 4, 7, { fill: '#FFFFFF', opacity: 0.6 });
const flame = (fill: string) => path('M32 4 C44 18 52 26 50 40 C48 54 38 60 32 60 C22 60 12 52 14 38 C15 30 20 26 22 18 C26 26 28 28 30 30 C30 22 30 12 32 4 Z', ink(fill, 4)) + path('M32 30 C38 38 40 44 38 50 C36 56 28 56 26 50 C24 44 28 40 32 30 Z', { fill: GOLD });
const leaf = (fill: string) => path('M10 54 C10 26 26 8 56 8 C56 38 38 54 10 54 Z', ink(fill, 4)) + path('M14 50 L44 20', line(3, '#2F6B2F'));
const rock = (fill: string) => path('M10 44 L18 18 L36 10 L54 24 L56 46 L40 56 L18 56 Z', ink(fill, 4)) + path('M18 18 L30 30 L36 10 M30 30 L40 56', line(3, '#6B5236'));
const star = (fill: string, stroke = 4) => path('M32 5 L40 23 L59 25 L45 38 L49 57 L32 47 L15 57 L19 38 L5 25 L24 23 Z', ink(fill, stroke));

export const ICONS: Record<string, string> = {
  energy: bolt('#7FDBFF'),
  heart: path('M32 56 C10 42 6 30 8 22 C10 12 22 8 32 18 C42 8 54 12 56 22 C58 30 54 42 32 56 Z', ink('#FF5C7A', 4)) + ellipse(20, 22, 5, 4, { fill: '#FFFFFF', opacity: 0.6 }),
  base: path('M10 56 L10 24 L18 24 L18 16 L26 16 L26 24 L38 24 L38 16 L46 16 L46 24 L54 24 L54 56 Z', ink('#B0BEC5', 4)) + path('M26 56 L26 42 A6 6 0 0 1 38 42 L38 56 Z', ink('#5D4037', 3)),
  pause: path('M18 12 L28 12 L28 52 L18 52 Z M36 12 L46 12 L46 52 L36 52 Z', ink('#FFFFFF', 4)),
  play: path('M18 10 L54 32 L18 54 Z', ink('#FFFFFF', 4)),
  book: path('M8 14 Q20 8 32 16 Q44 8 56 14 L56 52 Q44 46 32 54 Q20 46 8 52 Z', ink('#FFB74D', 4)) + path('M32 16 L32 54', line(3)),
  star: star(GOLD),
  star_empty: star('#3A4150', 3),
  lock: path('M20 28 L20 20 A12 12 0 0 1 44 20 L44 28', line(6, '#CFD8DC')) + path('M14 28 L50 28 L50 56 L14 56 Z', ink('#FFC93C', 4)) + circle(32, 40, 4, { fill: OUTLINE }),
  home: path('M8 32 L32 10 L56 32 L48 32 L48 56 L16 56 L16 32 Z', ink('#FFFFFF', 4)) + path('M27 56 L27 42 L37 42 L37 56', line(3)),
  replay: path('M48 22 A20 20 0 1 0 52 38', line(7, '#FFFFFF')) + path('M40 10 L54 22 L38 28 Z', ink('#FFFFFF', 3)),
  dice: path('M10 10 L54 10 L54 54 L10 54 Z', { ...ink('#FFFFFF', 4), rx: 8 }) + [[22, 22], [42, 42], [32, 32], [42, 22], [22, 42]].map(([x, y]) => circle(x, y, 4.5, { fill: OUTLINE })).join(''),
  sound_on: path('M8 24 L18 24 L32 12 L32 52 L18 40 L8 40 Z', ink('#FFFFFF', 4)) + path('M40 22 Q48 32 40 42 M46 14 Q60 32 46 50', line(4, '#FFFFFF')),
  sound_off: path('M8 24 L18 24 L32 12 L32 52 L18 40 L8 40 Z', ink('#90A4AE', 4)) + path('M40 24 L56 40 M56 24 L40 40', line(5, '#FF5C7A')),
  music: path('M24 46 L24 14 L52 8 L52 40', line(5, '#FFFFFF')) + ellipse(18, 46, 9, 7, ink('#FFFFFF', 3)) + ellipse(46, 40, 9, 7, ink('#FFFFFF', 3)),
  vibrate: path('M22 8 L42 8 L42 56 L22 56 Z', ink('#FFFFFF', 4)) + path('M10 20 L6 26 L10 32 L6 38 L10 44 M54 20 L58 26 L54 32 L58 38 L54 44', line(3.5, '#FFFFFF')),
  sword: path('M44 6 L58 6 L58 20 L26 50 L14 38 Z', ink('#E0E6EE', 4)) + path('M10 34 L30 54 M18 46 L8 56', line(6, '#8D6E63')),
  gift: path('M8 24 L56 24 L56 34 L8 34 Z M12 34 L52 34 L52 58 L12 58 Z', ink('#FF7A8A', 4)) + path('M32 24 L32 58', line(6, GOLD)) + path('M32 24 Q20 6 14 16 Q12 24 32 24 Q52 24 50 16 Q44 6 32 24 Z', ink(GOLD, 3)),
  trophy: path('M18 8 L46 8 L44 30 Q32 42 20 30 Z', ink(GOLD, 4)) + path('M18 14 Q6 14 10 24 Q14 30 20 28 M46 14 Q58 14 54 24 Q50 30 44 28', line(4)) + path('M28 38 L36 38 L36 48 L44 56 L20 56 L28 48 Z', ink(GOLD, 3)),
  clipboard: path('M14 12 L50 12 L50 58 L14 58 Z', ink('#ECEFF1', 4)) + path('M24 6 L40 6 L40 16 L24 16 Z', ink('#90A4AE', 3)) + path('M22 28 L42 28 M22 38 L42 38 M22 48 L34 48', line(3.5)),
  calendar: path('M8 14 L56 14 L56 58 L8 58 Z', ink('#FFFFFF', 4)) + path('M8 14 L56 14 L56 26 L8 26 Z', ink('#FF5C7A', 4)) + path('M20 8 L20 18 M44 8 L44 18', line(5)) + circle(24, 40, 4, { fill: OUTLINE }) + circle(40, 40, 4, { fill: OUTLINE }),
  skull: path('M12 30 A20 20 0 0 1 52 30 L52 42 L44 46 L44 56 L20 56 L20 46 L12 42 Z', ink('#ECEFF1', 4)) + circle(24, 32, 6, { fill: OUTLINE }) + circle(40, 32, 6, { fill: OUTLINE }),
  shield: path('M32 6 L54 14 Q54 42 32 58 Q10 42 10 14 Z', ink('#7FDBFF', 4)),
  clock: circle(32, 34, 24, ink('#FFFFFF', 4)) + path('M32 20 L32 34 L42 40', line(4.5)),
  gear: Array.from({ length: 8 }, (_, i) => `<rect x="27" y="4" width="10" height="14" rx="3" transform="rotate(${i * 45} 32 32)" fill="#CFD8DC" stroke="${OUTLINE}" stroke-width="3"/>`).join('') + circle(32, 32, 18, ink('#CFD8DC', 4)) + circle(32, 32, 7, ink('#455A64', 3)),
  check: path('M10 34 L26 50 L54 16', line(8, '#69F0AE')),
  close: path('M14 14 L50 50 M50 14 L14 50', line(8, '#FFFFFF')),
  question: circle(32, 32, 26, ink('#3A4150', 4)) + path('M22 24 Q22 12 32 12 Q44 12 42 24 Q40 30 32 34 L32 40', line(5.5, '#FFFFFF')) + circle(32, 50, 3.5, { fill: '#FFFFFF' }),
  el_fire: flame('#FF6B3D'),
  el_water: drop('#3DA5FF'),
  el_grass: leaf('#5BC35B'),
  el_rock: rock('#B8946A'),
  el_volt: bolt('#FFD23F'),
  el_none: star('#B58CE0'),
};

export function iconSvg(name: string, px = S): string {
  const body = ICONS[name];
  if (!body) throw new Error(`알 수 없는 아이콘: ${name}`);
  return svgDoc(S, body).replace(`width="${S}" height="${S}"`, `width="${px}" height="${px}"`);
}

export const iconKey = (name: string) => `ic-${name}`;
export const ICON_NAMES = Object.keys(ICONS);
