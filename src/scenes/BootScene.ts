import Phaser from 'phaser';
import { loadGameData } from '../gameData';
import { createServices } from '../services';
import { COLORS, FONT, textStyle } from '../ui/theme';
import { buildTextures } from '../views/textures';

/** JSON 검증 → 폰트·텍스처 준비(로딩 바) → 메뉴 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    const { width, height } = this.scale;
    const bar = this.add.graphics();
    const label = this.add.text(width / 2, height / 2 + 50, '몬스터 소환 중…', textStyle(26, COLORS.textDim)).setOrigin(0.5);
    const draw = (p: number) => {
      bar.clear();
      bar.fillStyle(0x2a2f3a, 1).fillRoundedRect(width / 2 - 220, height / 2 - 14, 440, 28, 14);
      bar.fillStyle(COLORS.accent, 1).fillRoundedRect(width / 2 - 216, height / 2 - 10, Math.max(20, 432 * p), 20, 10);
    };
    draw(0);
    this.boot(draw).catch((err: unknown) => {
      console.error('[BootScene] 초기화 실패', err);
      bar.clear();
      label.setText(`로딩 오류\n${err instanceof Error ? err.message : String(err)}`).setColor('#FF6B6B').setWordWrapWidth(660);
    });
  }

  private async boot(onProgress: (p: number) => void): Promise<void> {
    const data = loadGameData();
    const debug = new URLSearchParams(window.location.search).get(data.config.debug.queryParam) === '1';
    const services = createServices(debug);
    this.registry.set('data', data);
    this.registry.set('services', services);
    // 텍스트가 대체 폰트로 먼저 그려지지 않도록 게임 폰트를 기다린다 (실패해도 진행)
    await Promise.race([document.fonts?.load(`32px ${FONT}`, '몬스터머지아레나0123456789') ?? Promise.resolve(), new Promise((r) => setTimeout(r, 3000))]).catch(() => undefined);
    const art = await buildTextures(this, data, onProgress);
    this.registry.set('art', art);
    const isFirstSession = services.save.startSession();
    services.analytics.track('session_start', { sessionId: services.analytics.sessionId, isFirstSession });
    window.addEventListener('pointerdown', () => services.sound.unlock(), { once: true });
    this.scene.start('MenuScene');
  }
}
