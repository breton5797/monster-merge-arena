import Phaser from 'phaser';
import { textStyle } from './theme';

/** 화면 하단 중앙에 잠깐 뜨는 안내 문구 */
export function showToast(scene: Phaser.Scene, text: string, sec: number, y = 760): void {
  const t = scene.add.text(scene.scale.width / 2, y, text, textStyle(28, '#FFFFFF', { backgroundColor: '#000000CC', padding: { x: 22, y: 12 }, align: 'center' }));
  t.setOrigin(0.5).setDepth(1000).setAlpha(0);
  scene.tweens.add({ targets: t, alpha: 1, y: y - 20, duration: 180 });
  scene.tweens.add({ targets: t, alpha: 0, delay: sec * 1000, duration: 300, onComplete: () => t.destroy() });
}
