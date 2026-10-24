import Phaser from 'phaser';
import { COLORS, textStyle } from './theme';

export interface ButtonOptions {
  readonly color?: number;
  readonly fontSize?: number;
  readonly textColor?: string;
  readonly radius?: number;
  readonly onPressSound?: () => void;
}

/** 둥근 사각형 버튼. 터치 영역 = 버튼 크기 (최소 88px 권장) */
export class Button extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  readonly label: Phaser.GameObjects.Text;
  private enabled = true;
  private color: number;

  constructor(scene: Phaser.Scene, x: number, y: number, readonly bw: number, readonly bh: number, text: string, onClick: () => void, private readonly opts: ButtonOptions = {}) {
    super(scene, x, y);
    this.color = opts.color ?? COLORS.panelLight;
    this.bg = scene.add.graphics();
    this.label = scene.add.text(0, 0, text, textStyle(opts.fontSize ?? 30, opts.textColor ?? COLORS.text, { align: 'center' })).setOrigin(0.5);
    this.add([this.bg, this.label]);
    this.draw();
    this.setSize(bw, bh);
    this.setInteractive({ useHandCursor: true });
    // 다른 곳에서 시작한 드래그의 손가락 떼기로 눌리지 않도록, 이 버튼에서 누른 경우에만 클릭 처리
    let pressed = false;
    this.on('pointerout', () => (pressed = false));
    this.on('pointerdown', () => {
      if (!this.enabled) return;
      pressed = true;
      this.opts.onPressSound?.();
      scene.tweens.add({ targets: this, scale: 0.94, duration: 60, yoyo: true });
    });
    this.on('pointerup', () => {
      if (this.enabled && pressed) onClick();
      pressed = false;
    });
    scene.add.existing(this);
  }

  private draw(): void {
    this.bg.clear();
    this.bg.fillStyle(this.enabled ? this.color : 0x3a3a3a, 1);
    this.bg.fillRoundedRect(-this.bw / 2, -this.bh / 2, this.bw, this.bh, this.opts.radius ?? 18);
    this.bg.lineStyle(3, 0xffffff, this.enabled ? 0.18 : 0.06);
    this.bg.strokeRoundedRect(-this.bw / 2, -this.bh / 2, this.bw, this.bh, this.opts.radius ?? 18);
    this.label.setAlpha(this.enabled ? 1 : 0.45);
  }

  setEnabled(v: boolean): this {
    if (v !== this.enabled) {
      this.enabled = v;
      this.draw();
    }
    return this;
  }

  setColor(color: number): this {
    if (color !== this.color) {
      this.color = color;
      this.draw();
    }
    return this;
  }

  setText(text: string): this {
    if (this.label.text !== text) this.label.setText(text);
    return this;
  }
}
