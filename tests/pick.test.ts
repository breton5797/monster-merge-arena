import { describe, expect, it } from 'vitest';
import { loadGameData } from '../src/gameData';
import { generatePicks, optionKey, undiscoveredPartners, type PickContext } from '../src/systems/PickSystem';
import { createRng } from '../src/systems/rng';

const data = loadGameData();
const n = data.config.pick.optionCount;

function ctx(over: Partial<PickContext> = {}, seed = 1): PickContext {
  return { data, boardIds: ['ember_pup'], emptyCount: 4, discovered: new Set(), hints: {}, rng: createRng(seed), ...over };
}

describe('PickSystem.generatePicks', () => {
  it('항상 optionCount장, 중복 카드 없음, 같은 종류 3장 금지 (시드 200개)', () => {
    for (let s = 1; s <= 200; s++) {
      const opts = generatePicks(ctx({}, s));
      expect(opts).toHaveLength(n);
      expect(new Set(opts.map(optionKey)).size).toBe(n);
      expect(new Set(opts.map((o) => o.kind)).size).toBeGreaterThan(1);
    }
  });

  it('가능하면 1장은 보드 몬스터와 합치면 미발견 레시피가 되는 몬스터 카드', () => {
    const partners = undiscoveredPartners(['ember_pup'], new Set(), data);
    expect(partners.sort()).toEqual(['drip_slime', 'sprout_bunny', 'thorn_hog', 'zap_mouse'].sort());
    for (let s = 1; s <= 100; s++) {
      const opts = generatePicks(ctx({}, s));
      expect(opts.some((o) => o.kind === 'monster' && o.recipeHint && partners.includes(o.monsterId))).toBe(true);
    }
  });

  it('이미 발견한 레시피의 파트너는 보정 대상이 아니다', () => {
    const discovered = new Set(['steam_spirit', 'phoenix_chick', 'blaze_vine']);
    expect(undiscoveredPartners(['ember_pup'], discovered, data)).toEqual(['zap_mouse']);
  });

  it('tier2/키메라만 있으면 보정 카드 없음', () => {
    expect(undiscoveredPartners(['steam_spirit', 'chimera'], new Set(), data)).toEqual([]);
  });

  it('빈칸이 없으면 몬스터·레시피힌트 카드 제외, 1칸이면 2마리 카드 제외', () => {
    for (let s = 1; s <= 100; s++) {
      const full = generatePicks(ctx({ emptyCount: 0 }, s));
      expect(full.every((o) => ['buff_element', 'heal', 'energy'].includes(o.kind))).toBe(true);
      const one = generatePicks(ctx({ emptyCount: 1 }, s));
      expect(one.some((o) => o.kind === 'monster_pair')).toBe(false);
    }
  });

  it('레시피 힌트 카드는 미발견 레시피의 재료 하나를 공개', () => {
    let seen = 0;
    const discovered = new Set(data.fusions.recipes.slice(0, 14).map((r) => r.result));
    for (let s = 1; s <= 300; s++) {
      for (const o of generatePicks(ctx({ discovered, boardIds: [] }, s))) {
        if (o.kind !== 'recipe_hint') continue;
        seen++;
        const r = data.fusions.recipes[14];
        expect(o.resultId).toBe(r.result);
        expect([r.a, r.b]).toContain(o.revealId);
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('모든 레시피를 발견하면 레시피 힌트 카드가 나오지 않는다', () => {
    const discovered = new Set(data.fusions.recipes.map((r) => r.result));
    for (let s = 1; s <= 100; s++) {
      expect(generatePicks(ctx({ discovered }, s)).some((o) => o.kind === 'recipe_hint')).toBe(false);
    }
  });

  it('같은 시드는 같은 결과 (재현 가능)', () => {
    expect(generatePicks(ctx({}, 42))).toEqual(generatePicks(ctx({}, 42)));
  });

  it('카드 종류 분포가 가중치를 대체로 따른다', () => {
    const counts: Record<string, number> = {};
    for (let s = 1; s <= 2000; s++) {
      for (const o of generatePicks(ctx({ boardIds: [] , discovered: new Set() }, s))) counts[o.kind] = (counts[o.kind] ?? 0) + 1;
    }
    expect(counts.monster).toBeGreaterThan(counts.heal);
    expect(counts.monster).toBeGreaterThan(counts.recipe_hint);
  });

  it('이미 힌트를 받은 레시피는 다시 힌트 카드로 나오지 않는다 (기존 힌트 덮어쓰기 방지)', () => {
    const r = data.fusions.recipes[14];
    const discovered = new Set(data.fusions.recipes.slice(0, 14).map((x) => x.result));
    for (let s = 1; s <= 200; s++) {
      const opts = generatePicks(ctx({ discovered, boardIds: [], hints: { [r.result]: r.a } }, s));
      expect(opts.some((o) => o.kind === 'recipe_hint')).toBe(false);
    }
  });
});

