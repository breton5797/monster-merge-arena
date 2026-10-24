import type { GameData } from '../types';

/** 도감 발견 수 (저장 데이터에 남은 알 수 없는 id는 제외) — 메뉴·결과·도감에서 같은 값을 쓴다 */
export function discoveredCount(gd: GameData, discovered: readonly string[]): number {
  return discovered.filter((id) => gd.monsterById.has(id)).length;
}
