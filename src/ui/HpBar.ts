import Phaser from 'phaser';

/** 가로 HP 바. setValue(0~1) */
export class HpBar extends Phaser.GameObjects.Graphics {
  private value = 1;

  constructor(scene: Phaser.Scene, x: number, y: number, private readonly barW: number, private readonly barH: number, private readonly color = 0x4caf50, private readonly lowColor = 0xe53935) {
    super(scene, { x, y });
    scene.add.existing(this);
    this.redraw();
  }

  setValue(v: number): this {
    const c = Phaser.Math.Clamp(v, 0, 1);
    if (Math.abs(c - this.value) > 0.001) {
      this.value = c;
      this.redraw();
    }
    return this;
  }

  private redraw(): void {
    this.clear();
    this.fillStyle(0x000000, 0.6);
    this.fillRect(-this.barW / 2, -this.barH / 2, this.barW, this.barH);
    this.fillStyle(this.value < 0.3 ? this.lowColor : this.color, 1);
    this.fillRect(-this.barW / 2, -this.barH / 2, this.barW * this.value, this.barH);
  }
}
