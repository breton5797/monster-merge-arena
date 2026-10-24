import Phaser from 'phaser';
import { iconKey } from '../art/icons';
import { COLORS, shadeNum, textStyle } from './theme';

export interface ButtonOptions {
  readonly color?: number;
  readonly fontSize?: number;
  readonly textColor?: string;
  readonly radius?: number;
  /** 왼쪽 아이콘 (src/art/icons.ts 이름) */
  readonly icon?: string;
  readonly onPressSound?: () => void;
}

const LIP = 7;
const OUTLINE = 0x2a1f2d;

/** 입체 버튼 (캐릭터와 같은 외곽선). 터치 영역 = 버튼 크기 (최소 88px 권장) */
export class Button extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly face: Phaser.GameObjects.Container;
  readonly label: Phaser.GameObjects.Text;
  private readonly iconImg: Phaser.GameObjects.Image | null;
  private enabled = true;
  private color: number;

  constructor(scene: Phaser.Scene, x: number, y: number, readonly bw: number, readonly bh: number, text: string, onClick: () => void, private readonly opts: ButtonOptions = {}) {
    super(scene, x, y);
    this.color = opts.color ?? COLORS.panelLight;
    this.bg = scene.add.graphics();
    const size = opts.fontSize ?? 30;
    this.label = scene.add.text(0, -2, text, textStyle(size, opts.textColor ?? COLORS.text, { align: 'center', stroke: '#00000055', strokeThickness: 4 })).setOrigin(0.5);
    this.iconImg = opts.icon ? scene.add.image(0, -2, iconKey(opts.icon)).setDisplaySize(size * 1.25, size * 1.25) : null;
    this.face = scene.add.container(0, 0, this.iconImg ? [this.label, this.iconImg] : [this.label]);
    this.add([this.bg, this.face]);
    this.layout();
    this.draw(false);
    this.setSize(bw, bh + LIP);
    this.setInteractive({ useHandCursor: true });

    // 다른 곳에서 시작한 드래그의 손가락 떼기로 눌리지 않도록, 이 버튼에서 누른 경우에만 클릭 처리
    let pressed = false;
    this.on('pointerout', () => {
      pressed = false;
      this.draw(false);
    });
    this.on('pointerdown', () => {
      if (!this.enabled) return;
      pressed = true;
      this.opts.onPressSound?.();
      this.draw(true);
    });
    this.on('pointerup', () => {
      this.draw(false);
      if (this.enabled && pressed) onClick();
      pressed = false;
    });
    scene.add.existing(this);
  }

  private layout(): void {
    if (!this.iconImg) return;
    const gap = 10;
    const total = this.iconImg.displayWidth + (this.label.text ? gap + this.label.width : 0);
    this.iconImg.x = -total / 2 + this.iconImg.displayWidth / 2;
    this.label.x = this.iconImg.x + this.iconImg.displayWidth / 2 + gap + this.label.width / 2;
  }

  private draw(down: boolean): void {
    const { bw: w, bh: h } = this;
    const r = this.opts.radius ?? 20;
    const c = this.enabled ? this.color : 0x4a4f5a;
    const dy = down ? LIP - 2 : 0;
    this.bg.clear();
    this.bg.fillStyle(OUTLINE, 1).fillRoundedRect(-w / 2 - 3, -h / 2 - 3 + dy, w + 6, h + 6 + LIP - dy, r + 3);
    this.bg.fillStyle(shadeNum(c, -0.35), 1).fillRoundedRect(-w / 2, -h / 2 + LIP, w, h, r);
    this.bg.fillStyle(c, 1).fillRoundedRect(-w / 2, -h / 2 + dy, w, h, r);
    this.bg.fillStyle(0xffffff, this.enabled ? 0.22 : 0.08).fillRoundedRect(-w / 2 + 8, -h / 2 + dy + 6, w - 16, h * 0.34, { tl: r - 6, tr: r - 6, bl: 6, br: 6 });
    this.face.y = dy;
    this.face.setAlpha(this.enabled ? 1 : 0.5);
  }

  setEnabled(v: boolean): this {
    if (v !== this.enabled) {
      this.enabled = v;
      this.draw(false);
    }
    return this;
  }

  setColor(color: number): this {
    if (color !== this.color) {
      this.color = color;
      this.draw(false);
    }
    return this;
  }

  setText(text: string): this {
    if (this.label.text !== text) {
      this.label.setText(text);
      this.layout();
    }
    return this;
  }

  setIcon(name: string): this {
    this.iconImg?.setTexture(iconKey(name));
    return this;
  }
}
