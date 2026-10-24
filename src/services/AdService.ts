// 광고 인터페이스. 시제품은 Noop(광고 미노출). 모바일(AdMob)·Steam(광고 없음)에서 구현체만 교체한다.

export type RewardPlacement = 'revive' | 'reroll';

export interface AdService {
  readonly available: boolean;
  /** 보상형 광고. 끝까지 보면 true */
  showRewarded(placement: RewardPlacement): Promise<boolean>;
  /** 판 종료 후 전면 광고 (빈도 제한은 구현체 책임) */
  maybeShowInterstitial(runsPlayed: number): Promise<void>;
}

export class NoopAdService implements AdService {
  readonly available = false;
  async showRewarded(): Promise<boolean> {
    return false;
  }
  async maybeShowInterstitial(): Promise<void> {}
}
