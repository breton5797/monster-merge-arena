import Phaser from 'phaser';
import { getData, getServices } from '../registry';
import { Button } from '../ui/Button';
import { discoveredCount } from '../ui/codex';
import { COLORS, formatTime, hexToNum, textStyle } from '../ui/theme';

/** 제목, 스테이지 선택(잠금·최고 기록), 도감, 설정 */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create(): void {
    const data = getData(this);
    const sv = getServices(this);
    const { width } = this.scale;
    const cx = width / 2;
    const click = () => sv.sound.play('button');
    this.cameras.main.fadeIn(200);

    this.add.text(cx, 190, '🧪', textStyle(110)).setOrigin(0.5);
    this.add.text(cx, 320, 'Monster Merge Arena', textStyle(52, COLORS.text, { fontStyle: 'bold' })).setOrigin(0.5);
    this.add.text(cx, 380, '이 둘을 합치면 뭐가 나올까?', textStyle(28, COLORS.textDim)).setOrigin(0.5);

    const save = sv.save.data;
    data.stages.forEach((st, i) => {
      const locked = st.id > save.unlockedStages;
      const best = save.bestTime[st.id];
      const label = locked ? `🔒  ${st.id}. ${st.name}` : `${st.id}. ${st.name}${st.bossRequired ? '  👹' : ''}`;
      const btn = new Button(this, cx, 520 + i * 130, 560, 110, label, () => this.startStage(st.id), { color: hexToNum(st.background), fontSize: 34, onPressSound: click });
      btn.setEnabled(!locked);
      const sub = locked ? `스테이지 ${st.id - 1} 클리어 시 해금` : best ? `최고 기록 ${formatTime(best)}` : '도전!';
      this.add.text(cx, 520 + i * 130 + 34, sub, textStyle(20, COLORS.textDim)).setOrigin(0.5);
    });

    const total = data.monsters.length;
    const found = discoveredCount(data, save.discovered);
    new Button(this, cx, 940, 560, 100, `📖 도감  ${found} / ${total}`, () => {
      sv.analytics.track('codex_open', { from: 'menu', discoveredCount: found });
      this.scene.start('CodexScene', { from: 'menu' });
    }, { color: 0x34495e, fontSize: 34, onPressSound: click });

    const soundBtn = new Button(this, cx - 145, 1070, 270, 80, '', () => {
      sv.save.updateSettings({ sound: !sv.save.data.settings.sound });
      sv.sound.enabled = sv.save.data.settings.sound;
      refresh();
    }, { fontSize: 26, onPressSound: click });
    const vibBtn = new Button(this, cx + 145, 1070, 270, 80, '', () => {
      sv.save.updateSettings({ vibration: !sv.save.data.settings.vibration });
      sv.haptics.enabled = sv.save.data.settings.vibration;
      sv.haptics.vibrate(30);
      refresh();
    }, { fontSize: 26, onPressSound: click });
    const refresh = () => {
      soundBtn.setText(`소리 ${sv.save.data.settings.sound ? 'ON 🔊' : 'OFF 🔇'}`);
      vibBtn.setText(`진동 ${sv.save.data.settings.vibration ? 'ON 📳' : 'OFF'}`);
    };
    refresh();

    if (sv.debug) this.add.text(cx, 1200, 'DEBUG 모드 (?debug=1)  ·  &bot=1 자동 플레이', textStyle(20, '#FF6B6B')).setOrigin(0.5);
    else this.add.text(cx, 1200, 'v0.1 prototype', textStyle(18, COLORS.textDim)).setOrigin(0.5);
  }

  private startStage(stageId: number): void {
    this.cameras.main.fadeOut(150);
    this.time.delayedCall(150, () => this.scene.start('BattleScene', { stageId }));
  }
}
