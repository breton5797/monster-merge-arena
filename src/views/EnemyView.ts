import Phaser from 'phaser';
import { isBoss, type EnemyUnit } from '../entities/Enemy';
import type { GameData } from '../types';
import { HpBar } from '../ui/HpBar';
import { hexToNum, textStyle } from '../ui/theme';

const BOSS_SCALE = 1.9;

/** 적 플레이스홀더: 속성 색 원 + 이모지 + HP + 상태이상 아이콘 */
export class EnemyView extends Phaser.GameObjects.Container {
  private readonly circle: Phaser.GameObjects.Graphics;
  private readonly hp: HpBar;
  private readonly status: Phaser.GameObjects.Text;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private drawnElement = '';
  private readonly radius: number;
  private readonly jitterX: number;

  constructor(scene: Phaser.Scene, readonly enemy: EnemyUnit, private readonly gd: GameData) {
    super(scene, enemy.x, enemy.y);
    const boss = isBoss(enemy);
    this.radius = this.gd.config.layout.enemyRadius * (boss ? BOSS_SCALE : 1);
    this.jitterX = boss ? 0 : ((enemy.uid % 5) - 2) * 6;
    this.shadow = scene.add.ellipse(0, this.radius + 18, this.radius * 1.4, this.radius * 0.4, 0x000000, 0.35);
    this.circle = scene.add.graphics();
    const emoji = scene.add.text(0, 0, enemy.def.emoji, textStyle(boss ? 72 : 36)).setOrigin(0.5);
    this.hp = new HpBar(scene, 0, -this.radius - 8, this.radius * 1.8, boss ? 10 : 6, 0xff5252, 0xff5252);
    this.status = scene.add.text(0, -this.radius - 26, '', textStyle(boss ? 26 : 18)).setOrigin(0.5);
    this.add([this.shadow, this.circle, emoji, this.hp, this.status]);
    this.setDepth(boss ? 6 : 5);
    scene.add.existing(this);
    this.sync();
  }

  sync(): void {
    const e = this.enemy;
    this.setPosition(e.x + this.jitterX, e.y);
    this.hp.setValue(e.hp / e.maxHp);
    this.shadow.setVisible(e.flying);
    if (this.drawnElement !== e.element) {
      this.drawnElement = e.element;
      this.circle.clear();
      this.circle.fillStyle(hexToNum(this.gd.elements.elements[e.element].color), 0.85).fillCircle(0, 0, this.radius);
      this.circle.lineStyle(3, 0x000000, 0.6).strokeCircle(0, 0, this.radius);
      if (isBoss(e)) this.scene.tweens.add({ targets: this, scale: { from: 1.3, to: 1 }, duration: 400, ease: 'Back.Out' });
    }
    const icons = `${e.slow.t > 0 || e.auraSlow > 0 ? '🐌' : ''}${e.burn.t > 0 ? '🔥' : ''}${e.poison.t > 0 ? '☠️' : ''}${e.stun > 0 ? '💫' : ''}`;
    if (this.status.text !== icons) this.status.setText(icons);
  }
}
