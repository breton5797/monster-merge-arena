import { describe, expect, it } from 'vitest';
import monsters from '../src/data/monsters.json';
import fusions from '../src/data/fusions.json';
import elements from '../src/data/elements.json';
import enemies from '../src/data/enemies.json';
import stages from '../src/data/stages.json';
import config from '../src/data/config.json';
import { buildGameData, type RawGameData } from '../src/types';

const raw: RawGameData = { monsters, fusions, elements, enemies, stages, config };
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

describe('JSON 로드 검증', () => {
  it('현재 데이터는 통과', () => {
    const d = buildGameData(raw);
    expect(d.monsters).toHaveLength(26);
    expect(d.stages).toHaveLength(3);
  });

  it('필수 숫자 필드 누락 → 파일·항목·필드를 알려준다', () => {
    const m = clone(monsters);
    delete (m.monsters[3] as Record<string, unknown>).hp;
    expect(() => buildGameData({ ...raw, monsters: m })).toThrow(/monsters\.json: monsters\[3\] \(bubble_fish\)\.hp: 숫자여야/);
  });

  it('스킬 파라미터 누락', () => {
    const m = clone(monsters);
    delete (m.monsters[3].skill as Record<string, unknown>).slowPct;
    expect(() => buildGameData({ ...raw, monsters: m })).toThrow(/bubble_fish.*skill\.slowPct/);
  });

  it('알 수 없는 스킬 id / 속성', () => {
    const m = clone(monsters);
    (m.monsters[3].skill as Record<string, unknown>).id = 'laser';
    expect(() => buildGameData({ ...raw, monsters: m })).toThrow(/skill\.id: 허용값/);
    const m2 = clone(monsters);
    m2.monsters[0].element = 'ice';
    expect(() => buildGameData({ ...raw, monsters: m2 })).toThrow(/ember_pup.*element/);
  });

  it('레시피가 없는 몬스터를 참조', () => {
    const f = clone(fusions);
    f.recipes[0].result = 'ghost';
    expect(() => buildGameData({ ...raw, fusions: f })).toThrow(/fusions\.json: recipes\[0\]\.result: 'ghost'/);
  });

  it('스테이지가 없는 적을 참조', () => {
    const s = clone(stages);
    s.stages[0].waves[0].enemyId = 'dragon';
    expect(() => buildGameData({ ...raw, stages: s })).toThrow(/stages\.json: stage 1 waves\[0\]\.enemyId 'dragon'/);
  });

  it('config 섹션 누락', () => {
    const c = clone(config) as Record<string, unknown>;
    delete c.layout;
    expect(() => buildGameData({ ...raw, config: c })).toThrow(/config\.json: layout: 객체여야/);
  });

  it('armored 적은 armor 필요, 중복 id 금지', () => {
    const e = clone(enemies);
    delete (e.enemies[2] as Record<string, unknown>).armor;
    expect(() => buildGameData({ ...raw, enemies: e })).toThrow(/beetle.*armor/);
    const m = clone(monsters);
    m.monsters[1].id = 'ember_pup';
    expect(() => buildGameData({ ...raw, monsters: m })).toThrow(/중복/);
  });
});
