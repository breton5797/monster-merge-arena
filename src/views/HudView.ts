import Phaser from 'phaser';
import type { Battle } from '../systems/Battle';
import type { GameData } from '../types';
import { Button } from '../ui/Button';
import { HpBar } from '../ui/HpBar';
import { COLORS, formatTime, hexToNum, textStyle } from '../ui/theme';

export interface HudHandlers {
  onSummon(): void;
  onPause(): void;
}

/** 상단 바(시간·기지 HP·일시정지·보스 HP) + 하단 바(에너지·소환·도감 알림) */
export class HudView {
  private readonly timer: Phaser.GameObjects.Text;
  private readonly baseBar: HpBar;
  private readonly baseText: Phaser.GameObjects.Text;
  private readonly bossBar: HpBar;
  private readonly bossLabel: Phaser.GameObjects.Text;
  private readonly energyText: Phaser.GameObjects.Text;
  private readonly summonBtn: Button;
  private readonly codexDot: Phaser.GameObjects.Text;
  private readonly pickInfo: Phaser.GameObjects.Text;
  readonly speedText: Phaser.GameObjects.Text;
  readonly energyPos: { x: number; y: number };

  constructor(private readonly scene: Phaser.Scene, private readonly battle: Battle, private readonly data: GameData, handlers: HudHandlers, click: () => void) {
    const cfg = data.config;
    const W = cfg.screen.width;
    const bottomY = (cfg.layout.boardBottom + cfg.screen.height) / 2;

    scene.add.rectangle(W / 2, cfg.layout.topBarBottom / 2, W, cfg.layout.topBarBottom, 0x000000, 0.55).setDepth(100);
    scene.add.text(30, 22, `🏰 기지`, textStyle(22, COLORS.textDim)).setDepth(101);
    this.baseBar = new HpBar(scene, 150, 78, 240, 22).setDepth(101);
    this.baseText = scene.add.text(150, 78, '', textStyle(18, '#FFFFFF', { stroke: '#000', strokeThickness: 3 })).setOrigin(0.5).setDepth(102);
    this.timer = scene.add.text(W / 2 + 30, 60, '3:00', textStyle(56, '#FFFFFF', { fontStyle: 'bold' })).setOrigin(0.5).setDepth(101);
    this.pickInfo = scene.add.text(W / 2 + 30, 100, '', textStyle(18, COLORS.textDim)).setOrigin(0.5).setDepth(101);
    new Button(scene, W - 64, 60, 96, 88, '⏸', handlers.onPause, { fontSize: 40, onPressSound: click }).setDepth(101);
    scene.add.text(W - 150, 26, battle.state.stage.name, textStyle(18, COLORS.textDim)).setOrigin(1, 0).setDepth(101);

    this.bossLabel = scene.add.text(W / 2, cfg.layout.topBarBottom + 18, '👹 킹 키메라', textStyle(22, '#FF8A80', { stroke: '#000', strokeThickness: 4 })).setOrigin(0.5).setDepth(101).setVisible(false);
    this.bossBar = new HpBar(scene, W / 2, cfg.layout.topBarBottom + 44, W - 120, 16, 0xff5252, 0xff5252).setDepth(101).setVisible(false);

    scene.add.rectangle(W / 2, bottomY, W, cfg.screen.height - cfg.layout.boardBottom, 0x0b0d12, 1).setDepth(100);
    this.energyPos = { x: 120, y: bottomY };
    scene.add.text(120, bottomY - 44, '에너지', textStyle(20, COLORS.textDim)).setOrigin(0.5).setDepth(101);
    this.energyText = scene.add.text(120, bottomY + 6, '', textStyle(48, COLORS.energy, { fontStyle: 'bold' })).setOrigin(0.5).setDepth(101);
    this.summonBtn = new Button(scene, W / 2 + 60, bottomY, 300, 120, '', handlers.onSummon, { color: 0x2e7d32, fontSize: 32, onPressSound: click }).setDepth(101);
    this.codexDot = scene.add.text(W - 60, bottomY, '📖\nNEW', textStyle(22, '#FF5252', { align: 'center', fontStyle: 'bold' })).setOrigin(0.5).setDepth(101).setVisible(false);
    this.speedText = scene.add.text(W / 2, cfg.layout.topBarBottom + 80, '', textStyle(22, '#FF6B6B')).setOrigin(0.5).setDepth(101);
  }

  update(): void {
    const s = this.battle.state;
    const overtime = s.stage.bossRequired && s.time >= s.stage.durationSec && !s.bossDefeated;
    this.timer.setText(overtime ? '보스!' : formatTime(this.battle.remainingSec));
    this.timer.setColor(overtime || this.battle.remainingSec <= 10 ? '#FF5252' : '#FFFFFF');
    this.baseBar.setValue(s.baseHp / s.baseHpMax);
    this.baseText.setText(`${Math.ceil(s.baseHp)} / ${s.baseHpMax}`);
    const picksLeft = Math.max(0, Math.floor((s.stage.durationSec - 1e-6) / this.data.config.pick.intervalSec) - s.picksShown);
    this.pickInfo.setText(picksLeft > 0 ? `다음 보상 ${Math.max(0, Math.ceil(s.nextPickAt - s.time))}초` : '');
    this.energyText.setText(`⚡${Math.floor(s.energy)}`);
    const cost = this.battle.summonCost();
    this.summonBtn.setText(`소환  ⚡${cost}`);
    this.summonBtn.setEnabled(this.battle.canSummon());
    const boss = this.battle.boss;
    this.bossLabel.setVisible(!!boss);
    this.bossBar.setVisible(!!boss);
    if (boss) {
      this.bossBar.setValue(boss.hp / boss.maxHp);
      this.bossLabel.setText(`👹 킹 키메라 · ${this.data.elements.elements[boss.element].name} 속성`);
      this.bossLabel.setColor(this.data.elements.elements[boss.element].color);
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
