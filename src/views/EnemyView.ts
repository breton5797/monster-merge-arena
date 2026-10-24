import Phaser from 'phaser';
import { creatureKey, type ArtSpec } from '../art';
import { isBoss, type EnemyUnit } from '../entities/Enemy';
import type { GameData } from '../types';
import { HpBar } from '../ui/HpBar';
import { hexToNum, textStyle } from '../ui/theme';

const ENEMY_PX = 100;
const BOSS_PX = 220;
const FLY_LIFT = 22;

/** 적: 캐릭터 일러스트(무작위 속성·보스는 속성 색을 입힘) + 속성 고리 + HP + 상태이상 아이콘 */
export class EnemyView extends Phaser.GameObjects.Container {
  private readonly art: Phaser.GameObjects.Image;
  private readonly ring: Phaser.GameObjects.Ellipse;
  private readonly hp: HpBar;
  private readonly status: Phaser.GameObjects.Text;
  private drawnElement = '';
  private readonly jitterX: number;
  private readonly size: number;
  private flashing = false;

  constructor(scene: Phaser.Scene, readonly enemy: EnemyUnit, private readonly gd: GameData, private readonly spec: ArtSpec | undefined) {
    super(scene, enemy.x, enemy.y);
    const boss = isBoss(enemy);
    this.size = boss ? BOSS_PX : ENEMY_PX;
    this.jitterX = boss ? 0 : ((enemy.uid % 5) - 2) * 6;
    this.ring = scene.add.ellipse(0, this.size * 0.3, this.size * 0.55, this.size * 0.16).setStrokeStyle(4, 0xffffff, 0.9);
    this.art = scene.add.image(0, 0, creatureKey(enemy.def.id)).setDisplaySize(this.size, this.size);
    this.hp = new HpBar(scene, 0, -this.size * 0.36, this.size * (boss ? 0.8 : 0.6), boss ? 12 : 7, 0xff5252, 0xff5252);
    this.status = scene.add.text(0, -this.size * 0.36 - 18, '', textStyle(boss ? 26 : 18)).setOrigin(0.5);
    this.add([this.ring, this.art, this.hp, this.status]);
    this.setDepth(boss ? 6 : 5);
    scene.add.existing(this);
    // 걷기 모션
    scene.tweens.add({ targets: this.art, angle: { from: -5, to: 5 }, duration: 260 + (enemy.uid % 4) * 40, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.setScale(0.3);
    scene.tweens.add({ targets: this, scale: 1, duration: 220, ease: 'Back.Out' });
    this.sync();
  }

  sync(): void {
    const e = this.enemy;
    this.setPosition(e.x + this.jitterX, e.y);
    this.art.y = e.flying ? -FLY_LIFT : 0;
    this.hp.setValue(e.hp / e.maxHp);
    if (this.drawnElement !== e.element) {
      this.drawnElement = e.element;
      const color = hexToNum(this.gd.elements.elements[e.element].color);
      this.ring.setStrokeStyle(4, color, 0.95).setFillStyle(color, 0.22);
      if (this.spec?.tint && !this.flashing) this.art.setTint(color);
      if (isBoss(e)) this.scene.tweens.add({ targets: this.art, scale: { from: this.art.scale * 1.25, to: this.art.scale }, duration: 400, ease: 'Back.Out' });
    }
    const icons = `${e.slow.t > 0 || e.auraSlow > 0 ? '🐌' : ''}${e.burn.t > 0 ? '🔥' : ''}${e.poison.t > 0 ? '☠️' : ''}${e.stun > 0 ? '💫' : ''}`;
    if (this.status.text !== icons) this.status.setText(icons);
  }

  /** 피격 시 흰색 번쩍 */
  hurt(): void {
    if (this.flashing) return;
    this.flashing = true;
    this.art.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => {
      this.flashing = false;
      if (!this.active) return;
      if (this.spec?.tint) this.art.setTint(hexToNum(this.gd.elements.elements[this.enemy.element].color));
      else this.art.clearTint();
    });
  }

  override destroy(fromScene?: boolean): void {
    this.scene?.tweens.killTweensOf([this, this.art]);
    super.destroy(fromScene);
  }
}
