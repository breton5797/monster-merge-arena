import Phaser from 'phaser';
import { creatureKey } from '../art';
import { iconKey } from '../art/icons';
import { isKnockedOut, type MonsterUnit } from '../entities/Monster';
import { isFrontRow } from '../systems/layout';
import type { GameData } from '../types';
import { HpBar } from '../ui/HpBar';
import { textStyle } from '../ui/theme';

const ART_PX = 136;
const ART_Y = -6;

/** 보드 위 몬스터: 캐릭터 일러스트 + ★ + 속성 배지 + HP + 이름 */
export class MonsterView extends Phaser.GameObjects.Container {
  private readonly hp: HpBar;
  private readonly shieldRing: Phaser.GameObjects.Graphics;
  private readonly koText: Phaser.GameObjects.Text;
  private readonly idleBadge: Phaser.GameObjects.Text;
  private readonly art: Phaser.GameObjects.Image;
  private readonly visual: Phaser.GameObjects.Container;
  private wasKo = false;
  dragging = false;
  cell: number;

  constructor(scene: Phaser.Scene, readonly unit: MonsterUnit, private readonly gd: GameData, hitW: number, hitH: number) {
    super(scene, 0, 0);
    this.cell = unit.cell;
    const def = unit.def;

    this.art = scene.add.image(0, ART_Y, creatureKey(def.id)).setDisplaySize(ART_PX, ART_PX);
    this.shieldRing = scene.add.graphics();
    const stars = Array.from({ length: unit.star }, (_, i) => scene.add.image(-52 + i * 17, -50, iconKey('star')).setDisplaySize(22, 22));
    const badge = scene.add.image(52, -48, iconKey(`el_${def.element}`)).setDisplaySize(26, 26);
    this.visual = scene.add.container(0, 0, [this.shieldRing, this.art, ...stars, badge]);
    if (def.tier === 2) this.visual.addAt(scene.add.ellipse(0, 36, 96, 22, 0xffd54f, 0.35), 0);
    else if (def.tier === 0) this.visual.addAt(scene.add.ellipse(0, 36, 96, 22, 0xb06cff, 0.35), 0);

    this.hp = new HpBar(scene, 0, 46, 92, 7);
    const name = scene.add.text(0, 57, def.name, textStyle(15, '#FFFFFF', { stroke: '#000', strokeThickness: 4 })).setOrigin(0.5);
    this.koText = scene.add.text(0, -10, '', textStyle(30, '#FFFFFF', { stroke: '#000', strokeThickness: 5, align: 'center' })).setOrigin(0.5).setVisible(false);
    this.idleBadge = scene.add.text(0, 26, '대기', textStyle(15, '#FFFFFF', { backgroundColor: '#000000AA', padding: { x: 5, y: 1 } })).setOrigin(0.5).setVisible(false);
    this.add([this.visual, this.hp, name, this.koText, this.idleBadge]);

    this.setSize(hitW, hitH);
    this.setInteractive({ draggable: true, useHandCursor: true });
    scene.add.existing(this);
    // 대기 모션: 살짝 숨쉬기 (몬스터마다 박자 다르게)
    scene.tweens.add({ targets: this.art, scaleY: this.art.scaleY * 0.95, scaleX: this.art.scaleX * 1.03, y: ART_Y + 2, duration: 700 + (unit.uid % 5) * 60, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }

  sync(): void {
    const u = this.unit;
    const ko = isKnockedOut(u);
    this.hp.setValue(u.hp / u.maxHp);
    if (ko !== this.wasKo) {
      this.wasKo = ko;
      this.visual.setAlpha(ko ? 0.55 : 1);
      if (ko) this.art.setTint(0x666677);
      else this.art.clearTint();
      this.koText.setVisible(ko);
    }
    if (ko) this.koText.setText(`zZ\n${Math.ceil(u.koTimer)}`);
    this.idleBadge.setVisible(!ko && u.def.range === 'melee' && !isFrontRow(u.cell, this.gd.config));
    this.shieldRing.clear();
    if (u.shield > 0) this.shieldRing.lineStyle(5, 0x7fdbff, 0.9).strokeCircle(0, ART_Y + 4, 50).fillStyle(0x7fdbff, 0.12).fillCircle(0, ART_Y + 4, 50);
  }

  punch(): void {
    this.scene.tweens.add({ targets: this.visual, scale: { from: 1.5, to: 1 }, duration: 360, ease: 'Back.Out' });
  }

  /** 공격 모션: 위로 살짝 돌진 */
  lunge(): void {
    if (this.dragging) return;
    this.scene.tweens.add({ targets: this.visual, y: -10, duration: 70, yoyo: true, ease: 'Quad.Out' });
  }

  hurt(): void {
    this.art.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => {
      if (!this.active) return;
      if (this.wasKo) this.art.setTint(0x666677);
      else this.art.clearTint();
    });
  }

  override destroy(fromScene?: boolean): void {
    this.scene?.tweens.killTweensOf([this, this.art, this.visual]);
    super.destroy(fromScene);
  }

  shake(): void {
    const x = this.x;
    this.scene.tweens.add({ targets: this, x: { from: x - 14, to: x + 14 }, duration: 50, yoyo: true, repeat: 3, onComplete: () => this.setX(x) });
  }
}
