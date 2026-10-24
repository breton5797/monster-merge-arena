import Phaser from 'phaser';
import { isKnockedOut, type MonsterUnit } from '../entities/Monster';
import { isFrontRow } from '../systems/layout';
import type { GameData } from '../types';
import { HpBar } from '../ui/HpBar';
import { hexToNum, textStyle } from '../ui/theme';

/** 보드 위 몬스터 플레이스홀더: 속성 색 원 + 이모지 + 이름 + ★ + HP */
export class MonsterView extends Phaser.GameObjects.Container {
  private readonly hp: HpBar;
  private readonly shieldRing: Phaser.GameObjects.Graphics;
  private readonly koText: Phaser.GameObjects.Text;
  private readonly idleText: Phaser.GameObjects.Text;
  private readonly visual: Phaser.GameObjects.Container;
  dragging = false;
  cell: number;

  constructor(scene: Phaser.Scene, readonly unit: MonsterUnit, private readonly gd: GameData, hitW: number, hitH: number) {
    super(scene, 0, 0);
    this.cell = unit.cell;
    const R = this.gd.config.layout.monsterRadius;
    const def = unit.def;
    const color = hexToNum(this.gd.elements.elements[def.element].color);

    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.35).fillEllipse(0, R - 4, R * 1.6, R * 0.5);
    g.fillStyle(color, 1).fillCircle(0, 0, R);
    g.fillStyle(0xffffff, 0.18).fillCircle(-R * 0.3, -R * 0.35, R * 0.45);
    if (def.tier === 2) g.lineStyle(5, 0xffd700, 1).strokeCircle(0, 0, R + 1);
    else if (def.tier === 0) g.lineStyle(5, 0xb06cff, 1).strokeCircle(0, 0, R + 1);
    else g.lineStyle(3, 0xffffff, 0.5).strokeCircle(0, 0, R);

    const emoji = scene.add.text(0, -2, def.emoji, textStyle(42)).setOrigin(0.5);
    const stars = scene.add.text(0, -R - 2, '★'.repeat(unit.star), textStyle(22, '#FFD54F', { stroke: '#000', strokeThickness: 4 })).setOrigin(0.5);
    const rangeIcon = scene.add.text(R - 6, -R + 8, def.range === 'melee' ? '⚔️' : '🏹', textStyle(18)).setOrigin(0.5);
    this.shieldRing = scene.add.graphics();
    this.visual = scene.add.container(0, 0, [g, this.shieldRing, emoji, stars, rangeIcon]);

    this.hp = new HpBar(scene, 0, R + 5, R * 1.9, 7);
    const name = scene.add.text(0, R + 17, def.name, textStyle(17, '#FFFFFF', { stroke: '#000', strokeThickness: 4 })).setOrigin(0.5);
    this.koText = scene.add.text(0, -4, '💤', textStyle(40, '#FFFFFF', { stroke: '#000', strokeThickness: 4, align: 'center' })).setOrigin(0.5).setVisible(false);
    this.idleText = scene.add.text(0, R - 18, '대기', textStyle(16, '#FFFFFF', { backgroundColor: '#000000AA', padding: { x: 4, y: 1 } })).setOrigin(0.5).setVisible(false);
    this.add([this.visual, this.hp, name, this.koText, this.idleText]);

    this.setSize(hitW, hitH);
    this.setInteractive({ draggable: true, useHandCursor: true });
    scene.add.existing(this);
  }

  sync(): void {
    const u = this.unit;
    const ko = isKnockedOut(u);
    this.hp.setValue(u.hp / u.maxHp);
    this.visual.setAlpha(ko ? 0.35 : 1);
    this.koText.setVisible(ko);
    if (ko) this.koText.setText(`💤\n${Math.ceil(u.koTimer)}`);
    this.idleText.setVisible(!ko && u.def.range === 'melee' && !isFrontRow(u.cell, this.gd.config));
    this.shieldRing.clear();
    if (u.shield > 0) this.shieldRing.lineStyle(4, 0x7fdbff, 0.9).strokeCircle(0, 0, this.gd.config.layout.monsterRadius + 7);
  }

  punch(): void {
    this.scene.tweens.add({ targets: this.visual, scale: { from: 1.45, to: 1 }, duration: 320, ease: 'Back.Out' });
  }

  shake(): void {
    const x = this.x;
    this.scene.tweens.add({ targets: this, x: { from: x - 14, to: x + 14 }, duration: 50, yoyo: true, repeat: 3, onComplete: () => this.setX(x) });
  }
}
