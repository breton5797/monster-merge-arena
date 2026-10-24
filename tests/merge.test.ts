import { describe, expect, it } from 'vitest';
import { loadGameData } from '../src/gameData';
import { resolve, findRecipe } from '../src/systems/MergeSystem';
import { getMultiplier } from '../src/systems/elements';
import type { ElementId } from '../src/types';

const data = loadGameData();
const tier1 = data.monsters.filter((m) => m.tier === 1);
const u = (defId: string, star = 1) => ({ defId, star });

describe('MergeSystem.resolve', () => {
  it('fusions.json의 모든 a/b/result id가 monsters.json에 존재한다', () => {
    for (const r of data.fusions.recipes) {
      expect(data.monsterById.has(r.a), r.a).toBe(true);
      expect(data.monsterById.has(r.b), r.b).toBe(true);
      expect(data.monsterById.get(r.result)?.tier, r.result).toBe(2);
    }
    expect(data.monsterById.has(data.fusions.chimeraId)).toBe(true);
  });

  it('레시피는 30개이고 재료 조합이 중복되지 않는다', () => {
    expect(data.fusions.recipes).toHaveLength(30);
    const keys = new Set(data.fusions.recipes.map((r) => [r.a, r.b].sort().join('+')));
    expect(keys.size).toBe(30);
  });

  it.each(data.fusions.recipes.map((r) => [r.a, r.b, r.result]))('%s + %s → %s (양방향)', (a, b, result) => {
    expect(resolve(u(a), u(b), data)).toEqual({ kind: 'recipe', resultId: result, star: 1 });
    expect(resolve(u(b), u(a), data)).toEqual({ kind: 'recipe', resultId: result, star: 1 });
  });

  it('레시피 결과 ★ = 두 재료 ★ 평균 내림', () => {
    expect(resolve(u('ember_pup', 2), u('drip_slime', 2), data)).toMatchObject({ kind: 'recipe', star: 2 });
    expect(resolve(u('ember_pup', 2), u('drip_slime', 1), data)).toMatchObject({ kind: 'recipe', star: 1 });
    expect(resolve(u('ember_pup', 3), u('drip_slime', 2), data)).toMatchObject({ kind: 'recipe', star: 2 });
    expect(resolve(u('ember_pup', 3), u('drip_slime', 3), data)).toMatchObject({ kind: 'recipe', star: 3 });
  });

  it('레시피 없는 서로 다른 기본 조합은 정확히 61가지이고 모두 키메라 ★1', () => {
    let chimeras = 0;
    let recipes = 0;
    for (let i = 0; i < tier1.length; i++) {
      for (let j = i + 1; j < tier1.length; j++) {
        const r = resolve(u(tier1[i].id), u(tier1[j].id), data);
        if (r.kind === 'chimera') {
          chimeras++;
          expect(r).toEqual({ kind: 'chimera', resultId: 'chimera', star: 1 });
        } else if (r.kind === 'recipe') recipes++;
      }
    }
    expect(tier1).toHaveLength(14);
    expect(chimeras).toBe(61);
    expect(recipes).toBe(30);
  });

  it('키메라는 재료 ★와 상관없이 ★1', () => {
    expect(resolve(u('ember_pup', 3), u('pebble_turtle', 3), data)).toEqual({ kind: 'chimera', resultId: 'chimera', star: 1 });
  });

  it('같은 종 같은 ★ → ★+1, maxStar에서는 invalid', () => {
    expect(resolve(u('ember_pup', 1), u('ember_pup', 1), data)).toEqual({ kind: 'star', resultId: 'ember_pup', star: 2 });
    expect(resolve(u('ember_pup', 2), u('ember_pup', 2), data)).toEqual({ kind: 'star', resultId: 'ember_pup', star: 3 });
    expect(resolve(u('ember_pup', 3), u('ember_pup', 3), data)).toEqual({ kind: 'invalid' });
  });

  it('tier2 같은 종 같은 ★ 강화 가능, 키메라끼리도 강화 가능', () => {
    expect(resolve(u('steam_spirit'), u('steam_spirit'), data)).toEqual({ kind: 'star', resultId: 'steam_spirit', star: 2 });
    expect(resolve(u('chimera'), u('chimera'), data)).toEqual({ kind: 'star', resultId: 'chimera', star: 2 });
  });

  it('같은 종 ★ 다름 → invalid (키메라로 빠지지 않음)', () => {
    expect(resolve(u('ember_pup', 1), u('ember_pup', 2), data)).toEqual({ kind: 'invalid' });
    expect(resolve(u('steam_spirit', 2), u('steam_spirit', 1), data)).toEqual({ kind: 'invalid' });
  });

  it('tier2끼리 다른 종, tier2+tier1, 키메라+기본 → invalid', () => {
    expect(resolve(u('steam_spirit'), u('mud_giant'), data)).toEqual({ kind: 'invalid' });
    expect(resolve(u('steam_spirit'), u('ember_pup'), data)).toEqual({ kind: 'invalid' });
    expect(resolve(u('ember_pup'), u('steam_spirit'), data)).toEqual({ kind: 'invalid' });
    expect(resolve(u('chimera'), u('ember_pup'), data)).toEqual({ kind: 'invalid' });
    expect(resolve(u('chimera'), u('steam_spirit'), data)).toEqual({ kind: 'invalid' });
  });

  it('알 수 없는 id는 invalid', () => {
    expect(resolve(u('nope'), u('ember_pup'), data)).toEqual({ kind: 'invalid' });
  });

  it('findRecipe는 순서 무관', () => {
    expect(findRecipe('drip_slime', 'ember_pup', data)?.result).toBe('steam_spirit');
    expect(findRecipe('ember_pup', 'pebble_turtle', data)).toBeUndefined();
  });
});

describe('elements.getMultiplier', () => {
  const cycle: [ElementId, ElementId][] = [
    ['fire', 'grass'],
    ['grass', 'rock'],
    ['rock', 'volt'],
    ['volt', 'water'],
    ['water', 'fire'],
  ];
  it.each(cycle)('%s → %s 유리 ×1.5, 반대 ×0.75', (atk, def) => {
    expect(getMultiplier(atk, def, data.elements)).toBe(1.5);
    expect(getMultiplier(def, atk, data.elements)).toBe(0.75);
  });
  it('같은 속성, 무관한 속성, none은 ×1.0', () => {
    expect(getMultiplier('fire', 'fire', data.elements)).toBe(1);
    expect(getMultiplier('fire', 'rock', data.elements)).toBe(1);
    expect(getMultiplier('none', 'fire', data.elements)).toBe(1);
    expect(getMultiplier('fire', 'none', data.elements)).toBe(1);
  });
});
