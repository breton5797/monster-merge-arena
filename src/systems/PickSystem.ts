import { ELEMENT_IDS, PICK_KINDS, type ElementId, type GameData, type PickKind } from '../types';
import { pickOne, shuffled, weightedPick, type Rng } from './rng';

// GAME_DESIGN.md §6 라운드 3택 생성 (순수 함수, 시드 RNG 주입)

export type PickOption =
  | { readonly kind: 'monster'; readonly monsterId: string; readonly recipeHint: boolean }
  | { readonly kind: 'monster_pair'; readonly monsterId: string }
  | { readonly kind: 'recipe_hint'; readonly resultId: string; readonly revealId: string }
  | { readonly kind: 'buff_element'; readonly element: ElementId }
  | { readonly kind: 'heal' }
  | { readonly kind: 'energy' };

export interface PickContext {
  readonly data: GameData;
  /** 보드 위 모든 몬스터 defId */
  readonly boardIds: readonly string[];
  readonly emptyCount: number;
  readonly discovered: ReadonlySet<string>;
  readonly hints: Readonly<Record<string, string>>;
  readonly rng: Rng;
}

const PLAY_ELEMENTS = ELEMENT_IDS.filter((e) => e !== 'none');
const MAX_ATTEMPTS = 40;

export function optionKey(o: PickOption): string {
  switch (o.kind) {
    case 'monster':
    case 'monster_pair':
      return `${o.kind}:${o.monsterId}`;
    case 'recipe_hint':
      return `${o.kind}:${o.resultId}`;
    case 'buff_element':
      return `${o.kind}:${o.element}`;
    default:
      return o.kind;
  }
}

/** 보드의 tier1 몬스터와 합치면 미발견 레시피가 되는 기본 몬스터 id 목록 */
export function undiscoveredPartners(boardIds: readonly string[], discovered: ReadonlySet<string>, data: GameData): string[] {
  const onBoard = new Set(boardIds.filter((id) => data.monsterById.get(id)?.tier === 1));
  const out = new Set<string>();
  for (const r of data.fusions.recipes) {
    if (discovered.has(r.result)) continue;
    if (onBoard.has(r.a)) out.add(r.b);
    if (onBoard.has(r.b)) out.add(r.a);
  }
  return [...out];
}

function needsCells(kind: PickKind): number {
  if (kind === 'monster' || kind === 'recipe_hint') return 1;
  if (kind === 'monster_pair') return 2;
  return 0;
}

/** 힌트 카드 대상: 미발견 + 아직 힌트를 받지 않은 레시피 (기존 힌트를 덮어쓰지 않도록) */
function hintableRecipes(ctx: PickContext) {
  return ctx.data.fusions.recipes.filter((r) => !ctx.discovered.has(r.result) && ctx.hints[r.result] === undefined);
}

function isFeasible(kind: PickKind, ctx: PickContext): boolean {
  if (ctx.emptyCount < needsCells(kind)) return false;
  if (kind === 'recipe_hint') return hintableRecipes(ctx).length > 0;
  return true;
}

function makeOption(kind: PickKind, ctx: PickContext): PickOption {
  const { rng, data } = ctx;
  const baseIds = data.monsters.filter((m) => m.tier === 1).map((m) => m.id);
  switch (kind) {
    case 'monster':
      return { kind, monsterId: pickOne(rng, baseIds), recipeHint: false };
    case 'monster_pair':
      return { kind, monsterId: pickOne(rng, baseIds) };
    case 'recipe_hint': {
      const r = pickOne(rng, hintableRecipes(ctx));
      return { kind, resultId: r.result, revealId: pickOne(rng, [r.a, r.b]) };
    }
    case 'buff_element': {
      const onBoard = ctx.boardIds.map((id) => data.monsterById.get(id)?.element).filter((e): e is ElementId => !!e && e !== 'none');
      return { kind, element: pickOne(rng, onBoard.length > 0 ? onBoard : PLAY_ELEMENTS) };
    }
    case 'heal':
      return { kind };
    case 'energy':
      return { kind };
  }
}

export function generatePicks(ctx: PickContext): PickOption[] {
  const { config } = ctx.data;
  const count = config.pick.optionCount;
  const options: PickOption[] = [];
  const keys = new Set<string>();
  const add = (o: PickOption): boolean => {
    const k = optionKey(o);
    if (keys.has(k)) return false;
    keys.add(k);
    options.push(o);
    return true;
  };

  if (config.pick.guaranteeUndiscoveredRecipeCard && ctx.emptyCount >= 1) {
    const partners = undiscoveredPartners(ctx.boardIds, ctx.discovered, ctx.data);
    if (partners.length > 0) add({ kind: 'monster', monsterId: pickOne(ctx.rng, partners), recipeHint: true });
  }

  for (let attempt = 0; options.length < count && attempt < MAX_ATTEMPTS; attempt++) {
    const kindCounts = new Map<PickKind, number>();
    for (const o of options) kindCounts.set(o.kind, (kindCounts.get(o.kind) ?? 0) + 1);
    const entries = PICK_KINDS.filter((k) => isFeasible(k, ctx) && (kindCounts.get(k) ?? 0) < count - 1).map((k) => [k, config.pick.weights[k]] as const);
    const kind = weightedPick(ctx.rng, entries);
    if (!kind) break;
    add(makeOption(kind, ctx));
  }
  // 극단적인 경우(가중치 0 등) 무조건 채운다
  const fallbacks: PickOption[] = [{ kind: 'energy' }, { kind: 'heal' }, ...PLAY_ELEMENTS.map((element) => ({ kind: 'buff_element' as const, element }))];
  for (const f of fallbacks) {
    if (options.length >= count) break;
    add(f);
  }
  return shuffled(ctx.rng, options);
}
