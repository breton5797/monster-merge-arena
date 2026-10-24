import Phaser from 'phaser';
import '@fontsource/jua';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { BattleScene } from './scenes/BattleScene';
import { PickScene } from './scenes/PickScene';
import { ResultScene } from './scenes/ResultScene';
import { CodexScene } from './scenes/CodexScene';
import config from './data/config.json';

// 모바일 사파리 핀치 확대·더블탭 확대 방지
for (const type of ['gesturestart', 'gesturechange', 'dblclick']) {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
}
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: config.screen.width,
  height: config.screen.height,
  backgroundColor: '#0F1729',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 2 },
  render: { antialias: true },
  scene: [BootScene, MenuScene, BattleScene, PickScene, ResultScene, CodexScene],
});

// E2E·디버그 용 핸들
(window as unknown as { __game?: Phaser.Game }).__game = game;
