import Phaser from 'phaser';
import { creatureKey } from '../art';
import { thumbKey } from '../art/backgrounds';
import { iconKey } from '../art/icons';
import { getData, getServices } from '../registry';
import type { Services } from '../services';
import { dailySeed, dailyStage } from '../systems/Progress';
import type { StageDef } from '../types';
import { Button } from '../ui/Button';
import { discoveredCount } from '../ui/codex';
import { openSettings } from '../ui/SettingsPanel';
import { COLORS, formatTime, textStyle, titleStyle } from '../ui/theme';

const CARD_W = 316;
const CARD_H = 150;
const CARD_TOP = 600;
const CARD_GAP_Y = 172;

/** 타이틀, 스테이지 선택(★·잠금·최고 기록), 오늘의 도전, 도감, 설정 */
export class MenuScene extends Phaser.Scene {
  private starting = false;

  constructor() {
    super('MenuScene');
  }

  create(): void {
    this.starting = false;
    const gd = getData(this);
    const sv = getServices(this);
    const cx = this.scale.width / 2;
    const click = () => sv.sound.play('button');
    sv.sound.music.play('menu');
    this.cameras.main.fadeIn(250);
    this.drawBackdrop();
    this.drawLogo(cx);

    this.add.text(36, CARD_TOP - 104, '스테이지', titleStyle(30)).setOrigin(0, 0.5);
    const totalStars = Object.values(sv.save.data.stars).reduce((a, b) => a + b, 0);
    this.add.image(this.scale.width - 150, CARD_TOP - 104, iconKey('star')).setDisplaySize(34, 34);
    this.add.text(this.scale.width - 128, CARD_TOP - 104, `${totalStars} / ${gd.stages.length * 3}`, titleStyle(26)).setOrigin(0, 0.5);
    gd.stages.forEach((st, i) => this.stageCard(sv, st, cx + (i % 2 === 0 ? -1 : 1) * (CARD_W / 2 + 12), CARD_TOP + Math.floor(i / 2) * CARD_GAP_Y - 60));

    const seed = dailySeed(new Date());
    const dStage = dailyStage(seed, sv.save.data.unlockedStages, sv.save.data.daily);
    const daily = sv.save.data.daily?.seed === seed ? sv.save.data.daily : null;
    const dailyLabel = daily ? `오늘의 도전 ${'★'.repeat(Math.max(0, Math.min(3, daily.bestStars))) || '도전 중'}` : `오늘의 도전 · ${dStage}스테이지`;
    new Button(this, cx - 165, 1090, 310, 96, dailyLabel, () => this.start({ stageId: dStage, daily: seed }), { color: 0xc2185b, fontSize: 25, icon: 'calendar', onPressSound: click });
    const found = discoveredCount(gd, sv.save.data.discovered);
    new Button(this, cx + 165, 1090, 310, 96, `도감 ${found}/${gd.monsters.length}`, () => {
      sv.analytics.track('codex_open', { from: 'menu', discoveredCount: found });
      this.scene.start('CodexScene', { from: 'menu' });
    }, { color: 0x1565c0, fontSize: 27, icon: 'book', onPressSound: click });
    new Button(this, this.scale.width - 64, 64, 84, 76, '', () => openSettings(this, sv), { icon: 'gear', fontSize: 34, color: 0x34495e, onPressSound: click });

    const foot = sv.debug ? 'DEBUG (?debug=1) · &bot=1 자동 플레이' : 'v1.0';
    this.add.text(cx, 1225, foot, textStyle(18, sv.debug ? '#FF6B6B' : COLORS.textDim)).setOrigin(0.5);
  }

  private drawBackdrop(): void {
    const { width, height } = this.scale;
    const g = this.add.graphics();
    g.fillGradientStyle(0x2b1b5a, 0x2b1b5a, 0x0f1729, 0x0f1729, 1).fillRect(0, 0, width, height);
    for (let i = 0; i < 40; i++) g.fillStyle(0xffffff, 0.05 + (i % 5) * 0.03).fillCircle((i * 97) % width, (i * 173) % 480, 1.5 + (i % 3));
  }

  private drawLogo(cx: number): void {
    const trio: [string, number, number, number][] = [['ember_pup', cx - 230, 250, 150], ['drip_slime', cx + 230, 250, 150], ['sprout_bunny', cx, 120, 120]];
    trio.forEach(([id, x, y, size], i) => {
      const img = this.add.image(x, y, creatureKey(id)).setDisplaySize(size, size);
      this.tweens.add({ targets: img, y: y - 10, duration: 900 + i * 150, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    });
    this.add.text(cx, 232, 'MONSTER', titleStyle(70, '#FFD54F')).setOrigin(0.5);
    this.add.text(cx, 306, 'MERGE ARENA', titleStyle(60, '#FFFFFF')).setOrigin(0.5);
    this.add.text(cx, 372, '이 둘을 합치면 뭐가 나올까?', textStyle(26, '#C9B8FF', { stroke: '#2A1F2D', strokeThickness: 4 })).setOrigin(0.5);
  }

  private stageCard(sv: Services, st: StageDef, x: number, y: number): void {
    const save = sv.save.data;
    const locked = st.id > save.unlockedStages;
    const stars = save.stars[st.id] ?? 0;
    const best = save.bestTime[st.id];
    const g = this.add.graphics();
    g.fillStyle(0x2a1f2d, 1).fillRoundedRect(x - CARD_W / 2 - 3, y - CARD_H / 2 - 3, CARD_W + 6, CARD_H + 6, 22);
    const thumb = this.add.image(x, y, thumbKey(st.theme)).setDisplaySize(CARD_W, CARD_H);
    const maskShape = this.make.graphics({}, false).fillRoundedRect(x - CARD_W / 2, y - CARD_H / 2, CARD_W, CARD_H, 20);
    this.events.once('shutdown', () => maskShape.destroy());
    const mask = maskShape.createGeometryMask();
    thumb.setMask(mask);
    const shade = this.add.graphics().fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.75, 0.75).fillRect(x - CARD_W / 2, y - CARD_H / 2, CARD_W, CARD_H).setMask(mask);
    const items: Phaser.GameObjects.GameObject[] = [g, thumb, shade];
    items.push(this.add.text(x - CARD_W / 2 + 16, y - CARD_H / 2 + 12, `${st.id}`, titleStyle(34, '#FFD54F')));
    items.push(this.add.text(x - CARD_W / 2 + 16, y + 18, st.name, titleStyle(30)).setOrigin(0, 0.5));
    const sub = locked ? `${st.id - 1}스테이지 클리어 시 해금` : best ? `최고 ${formatTime(best)}` : st.bossRequired ? '보스 스테이지' : '도전!';
    items.push(this.add.text(x - CARD_W / 2 + 16, y + 52, sub, textStyle(18, '#E0E0E0', { stroke: '#000', strokeThickness: 3 })).setOrigin(0, 0.5));
    for (let i = 0; i < 3; i++) items.push(this.add.image(x + CARD_W / 2 - 92 + i * 34, y - CARD_H / 2 + 30, iconKey(i < stars ? 'star' : 'star_empty')).setDisplaySize(30, 30));
    if (st.bossRequired) items.push(this.add.image(x + CARD_W / 2 - 34, y + 40, iconKey('skull')).setDisplaySize(40, 40));
    if (locked) {
      items.splice(3, 0, this.add.graphics().fillStyle(0x000000, 0.55).fillRoundedRect(x - CARD_W / 2, y - CARD_H / 2, CARD_W, CARD_H, 20));
      items.push(this.add.image(x + CARD_W / 2 - 48, y + 4, iconKey('lock')).setDisplaySize(60, 60));
    }
    const card = this.add.container(0, 0, items);
    if (locked) return;
    const hit = this.add.zone(x, y, CARD_W, CARD_H).setInteractive({ useHandCursor: true });
    let pressed = false;
    hit.on('pointerdown', () => {
      pressed = true;
      sv.sound.play('button');
      this.tweens.add({ targets: card, alpha: 0.7, duration: 70, yoyo: true });
    });
    hit.on('pointerout', () => (pressed = false));
    hit.on('pointerup', () => pressed && this.start({ stageId: st.id }));
  }

  private start(data: { stageId: number; daily?: number }): void {
    if (this.starting) return;
    this.starting = true;
    this.cameras.main.fadeOut(160);
    this.time.delayedCall(160, () => this.scene.start('BattleScene', data));
  }
}
