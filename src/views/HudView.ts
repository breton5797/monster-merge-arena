import Phaser from 'phaser';
import { iconKey } from '../art/icons';
import type { Battle } from '../systems/Battle';
import type { GameData } from '../types';
import { Button } from '../ui/Button';
import { HpBar } from '../ui/HpBar';
import { COLORS, formatTime, hexToNum, textStyle, titleStyle } from '../ui/theme';

export interface HudHandlers {
  onSummon(): void;
  onPause(): void;
}

/** 상단 바(기지 HP·시간·일시정지·보스 HP) + 하단 바(에너지·소환·도감 알림) */
export class HudView {
  private readonly timer: Phaser.GameObjects.Text;
  private readonly baseBar: HpBar;
  private readonly baseText: Phaser.GameObjects.Text;
  private readonly bossBar: HpBar;
  private readonly bossLabel: Phaser.GameObjects.Text;
  private readonly energyText: Phaser.GameObjects.Text;
  private readonly summonBtn: Button;
  private readonly codexDot: Phaser.GameObjects.Container;
  private readonly pickInfo: Phaser.GameObjects.Text;
  readonly speedText: Phaser.GameObjects.Text;
  readonly energyPos: { x: number; y: number };

  constructor(private readonly scene: Phaser.Scene, private readonly battle: Battle, private readonly data: GameData, handlers: HudHandlers, click: () => void, title: string) {
    const cfg = data.config;
    const W = cfg.screen.width;
    const top = cfg.layout.topBarBottom;
    const bottomY = (cfg.layout.boardBottom + cfg.screen.height) / 2;
    const D = 100;

    const bar = scene.add.graphics().setDepth(D);
    bar.fillGradientStyle(0x1b1530, 0x1b1530, 0x110d20, 0x110d20, 1).fillRect(0, 0, W, top);
    bar.fillStyle(0x2a1f2d, 1).fillRect(0, top - 4, W, 4);
    scene.add.image(44, 44, iconKey('base')).setDisplaySize(42, 42).setDepth(D + 1);
    scene.add.text(72, 44, title, textStyle(20, COLORS.textDim)).setOrigin(0, 0.5).setDepth(D + 1);
    this.baseBar = new HpBar(scene, 150, 88, 236, 24).setDepth(D + 1);
    this.baseText = scene.add.text(150, 88, '', textStyle(18, '#FFFFFF', { stroke: '#000', strokeThickness: 4 })).setOrigin(0.5).setDepth(D + 2);
    this.timer = scene.add.text(W / 2 + 40, 52, '3:00', titleStyle(58)).setOrigin(0.5).setDepth(D + 1);
    this.pickInfo = scene.add.text(W / 2 + 40, 98, '', textStyle(18, '#C9B8FF')).setOrigin(0.5).setDepth(D + 1);
    new Button(scene, W - 58, 54, 84, 76, '', handlers.onPause, { icon: 'pause', fontSize: 32, color: 0x34495e, onPressSound: click }).setDepth(D + 1);

    this.bossLabel = scene.add.text(W / 2, top + 22, '', titleStyle(24)).setOrigin(0.5).setDepth(D + 1).setVisible(false);
    this.bossBar = new HpBar(scene, W / 2, top + 50, W - 120, 16, 0xff5252, 0xff5252).setDepth(D + 1).setVisible(false);

    const bb = scene.add.graphics().setDepth(D);
    bb.fillGradientStyle(0x151026, 0x151026, 0x0b0814, 0x0b0814, 1).fillRect(0, cfg.layout.boardBottom, W, cfg.screen.height - cfg.layout.boardBottom);
    bb.fillStyle(0x2a1f2d, 1).fillRect(0, cfg.layout.boardBottom, W, 4);
    this.energyPos = { x: 110, y: bottomY };
    scene.add.image(66, bottomY, iconKey('energy')).setDisplaySize(64, 64).setDepth(D + 1);
    this.energyText = scene.add.text(102, bottomY, '', titleStyle(52, '#7FDBFF')).setOrigin(0, 0.5).setDepth(D + 1);
    this.summonBtn = new Button(scene, W / 2 + 70, bottomY - 4, 290, 112, '', handlers.onSummon, { color: 0x2e7d32, fontSize: 34, icon: 'energy', onPressSound: click }).setDepth(D + 1);
    const dotImg = scene.add.image(0, -10, iconKey('book')).setDisplaySize(52, 52);
    const dotTxt = scene.add.text(0, 30, 'NEW', titleStyle(20, '#FF5C7A')).setOrigin(0.5);
    this.codexDot = scene.add.container(W - 54, bottomY, [dotImg, dotTxt]).setDepth(D + 1).setVisible(false);
    this.speedText = scene.add.text(W / 2, top + 84, '', titleStyle(22, '#FF6B6B')).setOrigin(0.5).setDepth(D + 1);
  }

  update(): void {
    const s = this.battle.state;
    const overtime = s.stage.bossRequired && s.time >= s.stage.durationSec && !s.bossDefeated;
    this.timer.setText(overtime ? '보스!' : formatTime(this.battle.remainingSec));
    this.timer.setColor(overtime || this.battle.remainingSec <= 10 ? '#FF5252' : '#FFFFFF');
    this.baseBar.setValue(s.baseHp / s.baseHpMax);
    this.baseText.setText(`${Math.ceil(s.baseHp)} / ${s.baseHpMax}`);
    const picksLeft = Math.max(0, Math.floor((s.stage.durationSec - 1e-6) / this.data.config.pick.intervalSec) - s.picksShown);
    this.pickInfo.setText(picksLeft > 0 ? `다음 보상까지 ${Math.max(0, Math.ceil(s.nextPickAt - s.time))}초` : '');
    this.energyText.setText(`${Math.floor(s.energy)}`);
    this.summonBtn.setText(`소환 ${this.battle.summonCost()}`);
    this.summonBtn.setEnabled(this.battle.canSummon());
    const boss = this.battle.boss;
    this.bossLabel.setVisible(!!boss);
    this.bossBar.setVisible(!!boss);
    if (boss) {
      const el = this.data.elements.elements[boss.element];
      this.bossBar.setValue(boss.hp / boss.maxHp);
      this.bossLabel.setText(`${boss.def.name} · ${el.name} 속성`).setColor(el.color);
    }
  }

  showCodexDot(): void {
    this.codexDot.setVisible(true);
    this.scene.tweens.add({ targets: this.codexDot, scale: { from: 1.6, to: 1 }, duration: 300, ease: 'Back.Out' });
  }

  pulseEnergy(): void {
    this.scene.tweens.add({ targets: this.energyText, scale: { from: 1.25, to: 1 }, duration: 160 });
  }

  bossColor(): number {
    const boss = this.battle.boss;
    return boss ? hexToNum(this.data.elements.elements[boss.element].color) : 0xffffff;
  }
}
