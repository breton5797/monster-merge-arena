import type { GameData, Recipe } from '../types';

/** 합성 판정에 필요한 최소 정보 */
export interface MergeInput {
  readonly defId: string;
  readonly star: number;
}

export type MergeResult =
  | { readonly kind: 'star' | 'recipe' | 'chimera'; readonly resultId: string; readonly star: number }
  | { readonly kind: 'invalid' };

const INVALID: MergeResult = { kind: 'invalid' };

export function findRecipe(aId: string, bId: string, data: GameData): Recipe | undefined {
  return data.fusions.recipes.find((r) => (r.a === aId && r.b === bId) || (r.a === bId && r.b === aId));
}

/**
 * GAME_DESIGN.md §4 합성 판정 (순수 함수).
 * 1) 같은 종·같은 ★(maxStar 미만) → ★+1
 * 2) 서로 다른 tier1 + 레시피 → 합성 몬스터, ★ = floor(평균)
 * 3) 서로 다른 tier1 + 레시피 없음 → 키메라 ★1
 * 4) 그 외(같은 종 ★ 다름, tier2/키메라가 섞인 다른 종) → invalid
 */
export function resolve(a: MergeInput, b: MergeInput, data: GameData): MergeResult {
  const defA = data.monsterById.get(a.defId);
  const defB = data.monsterById.get(b.defId);
  if (!defA || !defB) return INVALID;

  if (defA.id === defB.id) {
    if (a.star === b.star && a.star < data.config.maxStar) return { kind: 'star', resultId: defA.id, star: a.star + 1 };
    return INVALID;
  }
  if (defA.tier !== 1 || defB.tier !== 1) return INVALID;

  const recipe = findRecipe(defA.id, defB.id, data);
  if (recipe) return { kind: 'recipe', resultId: recipe.result, star: Math.floor((a.star + b.star) / 2) };
  return { kind: 'chimera', resultId: data.fusions.chimeraId, star: 1 };
}
