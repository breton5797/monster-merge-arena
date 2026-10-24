import Phaser from 'phaser';
import { loadGameData } from '../gameData';
import { createServices } from '../services';
import { textStyle } from '../ui/theme';

/** JSON 로드·검증 → 레지스트리 저장 → 메뉴 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    try {
      const data = loadGameData();
      const debug = new URLSearchParams(window.location.search).get(data.config.debug.queryParam) === '1';
      const services = createServices(debug);
      this.registry.set('data', data);
      this.registry.set('services', services);
      const isFirstSession = services.save.startSession();
      services.analytics.track('session_start', { sessionId: services.analytics.sessionId, isFirstSession });
      // 오디오는 첫 터치에서 잠금 해제
      this.input.once('pointerdown', () => services.sound.unlock());
      window.addEventListener('pointerdown', () => services.sound.unlock(), { once: true });
      this.scene.start('MenuScene');
    } catch (err) {
      console.error('[BootScene] 데이터 로드 실패', err);
      this.add.text(24, 24, `데이터 오류\n${String(err instanceof Error ? err.message : err)}`, textStyle(24, '#FF6B6B', { wordWrap: { width: 672 } }));
    }
  }
}
