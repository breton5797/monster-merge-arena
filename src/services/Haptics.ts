// navigator.vibrate 래퍼 (설정에서 끄기). iOS 사파리는 미지원이라 조용히 무시된다.

export class Haptics {
  enabled = true;

  vibrate(pattern: number | number[]): void {
    if (!this.enabled || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    navigator.vibrate(pattern);
  }
}
