import artJson from '../data/art.json';
import { creatureSvg, type BodyType, type CreatureSpec, type EyeType, type MouthType } from './creature';
import { PARTS } from './parts';

export interface ArtSpec extends CreatureSpec {
  /** 흰 계열로 그리고 게임에서 속성 색을 입힘 (무작위 속성 적, 보스) */
  readonly tint?: boolean;
}

const BODY_TYPES: readonly BodyType[] = ['round', 'egg', 'wide', 'tall', 'drop', 'slime', 'golem', 'cloud', 'ghost', 'turtle', 'fish'];
const EYE_TYPES: readonly EyeType[] = ['round', 'happy', 'angry', 'sleepy', 'sparkle', 'one', 'dot', 'glow', 'fierce'];
const MOUTH_TYPES: readonly MouthType[] = ['smile', 'open', 'fang', 'cat', 'beak', 'grin', 'none', 'frown', 'o'];
const FLAGS = new Set(['nobelly', 'nocheeks']);
const HEX = /^#[0-9A-Fa-f]{6}$/;

/** art.json 검증. 실패 시 어떤 캐릭터의 어떤 필드인지 에러 */
export function validateArt(raw: unknown): ArtSpec[] {
  const list = (raw as { creatures?: unknown }).creatures;
  if (!Array.isArray(list)) throw new Error('art.json: creatures 배열이 필요합니다');
  return list.map((c: Record<string, unknown>, i) => {
    const where = `art.json: creatures[${i}] (${String(c.id)})`;
    const oneOf = <T extends string>(k: string, allowed: readonly T[]): T => {
      if (!allowed.includes(c[k] as T)) throw new Error(`${where}.${k}: 허용값 ${allowed.join('|')} (받은 값: ${String(c[k])})`);
      return c[k] as T;
    };
    const color = (k: string, required: boolean): string | undefined => {
      if (c[k] === undefined && !required) return undefined;
      if (typeof c[k] !== 'string' || !HEX.test(c[k] as string)) throw new Error(`${where}.${k}: #RRGGBB 색이어야 합니다`);
      return c[k] as string;
    };
    if (typeof c.id !== 'string') throw new Error(`${where}.id: 문자열이어야 합니다`);
    if (!Array.isArray(c.parts)) throw new Error(`${where}.parts: 배열이어야 합니다`);
    for (const p of c.parts) if (!FLAGS.has(p) && !PARTS[p]) throw new Error(`${where}.parts: 알 수 없는 파츠 '${p}'`);
    return {
      id: c.id,
      body: oneOf('body', BODY_TYPES),
      color: color('color', true) as string,
      belly: color('belly', false),
      accent: color('accent', false),
      eyes: oneOf('eyes', EYE_TYPES),
      mouth: oneOf('mouth', MOUTH_TYPES),
      parts: c.parts as string[],
      tint: c.tint === true,
    };
  });
}

export function loadArt(): ArtSpec[] {
  return validateArt(artJson);
}

export { creatureSvg };
export const creatureKey = (id: string) => `cr-${id}`;
