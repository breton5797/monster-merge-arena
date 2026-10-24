import config from '../data/config.json';

// 진행 규칙 (순수 함수): 스테이지 ★ 평가, 오늘의 도전 시드·스테이지

export interface StarThresholds {
  readonly threeStarPct: number;
  readonly twoStarPct: number;
}

/** 승리 시 기지 HP 비율로 ★1~3 (기준: config.stars). 패배는 0 */
export function starRating(result: 'win' | 'lose', baseHp: number, baseHpMax: number, t: StarThresholds = config.stars): number {
  if (result !== 'win') return 0;
  const pct = baseHp / baseHpMax;
  return pct >= t.threeStarPct ? 3 : pct >= t.twoStarPct ? 2 : 1;
}

/** 날짜(로컬) → YYYYMMDD 숫자. 같은 날 모든 플레이어가 같은 시드 */
export function dailySeed(date: Date): number {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

/**
 * 오늘의 도전 스테이지. 오늘 이미 시작했다면 그 기록의 스테이지를 그대로 쓴다
 * (하루 중 해금이 늘어도 도전 스테이지가 바뀌지 않게).
 */
export function dailyStage(seed: number, unlockedStages: number, today: { readonly seed: number; readonly stageId: number } | null): number {
  if (today && today.seed === seed) return today.stageId;
  return (seed % Math.max(1, unlockedStages)) + 1;
}
