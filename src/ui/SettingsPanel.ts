import Phaser from 'phaser';
import type { Services } from '../services';
import { Button } from './Button';
import { COLORS, drawPanel, titleStyle } from './theme';

/** 설정 오버레이: 배경음악 / 효과음 / 진동. 닫으면 onClose */
export function openSettings(scene: Phaser.Scene, sv: Services, onClose: () => void = () => undefined): Phaser.GameObjects.Container {
  const { width, height } = scene.scale;
  const click = () => sv.sound.play('button');
  const blocker = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.65).setInteractive();
  const panel = drawPanel(scene.add.graphics(), 80, 380, width - 160, 520, COLORS.panel);
  const title = scene.add.text(width / 2, 440, '설정', titleStyle(48)).setOrigin(0.5);
  const s = () => sv.save.data.settings;
  const rows: { label: string; icon: () => string; get: () => boolean; toggle: () => void }[] = [
    { label: '배경음악', icon: () => (s().music ? 'music' : 'sound_off'), get: () => s().music, toggle: () => { sv.save.updateSettings({ music: !s().music }); sv.sound.music.setEnabled(s().music); } },
    { label: '효과음', icon: () => (s().sound ? 'sound_on' : 'sound_off'), get: () => s().sound, toggle: () => { sv.save.updateSettings({ sound: !s().sound }); sv.sound.enabled = s().sound; } },
    { label: '진동', icon: () => 'vibrate', get: () => s().vibration, toggle: () => { sv.save.updateSettings({ vibration: !s().vibration }); sv.haptics.enabled = s().vibration; sv.haptics.vibrate(30); } },
  ];
  const buttons = rows.map((r, i) => {
    const b: Button = new Button(scene, width / 2, 540 + i * 110, 440, 86, '', () => {
      r.toggle();
      paint();
    }, { fontSize: 30, icon: r.icon(), onPressSound: click });
    const paint = () => b.setText(`${r.label}  ${r.get() ? 'ON' : 'OFF'}`).setIcon(r.icon()).setColor(r.get() ? 0x2e7d32 : 0x4a4f5a);
    paint();
    return b;
  });
  const container = scene.add.container(0, 0);
  const close = new Button(scene, width / 2, 840, 300, 76, '닫기', () => {
    container.destroy();
    onClose();
  }, { color: 0x34495e, fontSize: 28, icon: 'close', onPressSound: click });
  container.add([blocker, panel, title, ...buttons, close]).setDepth(900);
  return container;
}
