// 공통 UI 스타일 (Arcade Core 분리 후보)
import Phaser from 'phaser';

export const FONT = '"Jua","Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",system-ui,sans-serif';

export const COLORS = {
  bg: 0x111111,
  panel: 0x1c1f26,
  panelLight: 0x2a2f3a,
  line: 0x3a4150,
  text: '#F5F5F5',
  textDim: '#9AA3B2',
  accent: 0xffb703,
  accentText: '#FFB703',
  good: 0x4caf50,
  bad: 0xe53935,
  energy: '#7FDBFF',
  adv: '#FF9F1C',
  dis: '#8A8A8A',
  crit: '#FF3B3B',
} as const;

export function hexToNum(hex: string): number {
  return Phaser.Display.Color.HexStringToColor(hex).color;
}

export function textStyle(size: number, color: string = COLORS.text, extra: Phaser.Types.GameObjects.Text.TextStyle = {}): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: FONT, fontSize: `${size}px`, color, ...extra };
}

export function formatTime(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** 숫자 색을 밝게(+)/어둡게(-) (-1~1) */
export function shadeNum(color: number, amount: number): number {
  const c = Phaser.Display.Color.IntegerToColor(color);
  const f = (v: number) => Math.round(amount >= 0 ? v + (255 - v) * amount : v * (1 + amount));
  return Phaser.Display.Color.GetColor(f(c.red), f(c.green), f(c.blue));
}

/** 반투명 패널 (외곽선 + 상단 하이라이트) */
export function drawPanel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number = COLORS.panel, radius = 22): Phaser.GameObjects.Graphics {
  g.fillStyle(0x2a1f2d, 1).fillRoundedRect(x - 3, y - 3, w + 6, h + 6, radius + 3);
  g.fillStyle(color, 0.96).fillRoundedRect(x, y, w, h, radius);
  g.fillStyle(0xffffff, 0.06).fillRoundedRect(x + 6, y + 6, w - 12, Math.min(40, h * 0.3), { tl: radius - 4, tr: radius - 4, bl: 4, br: 4 });
  return g;
}

/** 굵은 외곽선 제목 스타일 */
export function titleStyle(size: number, color = '#FFFFFF'): Phaser.Types.GameObjects.Text.TextStyle {
  return textStyle(size, color, { stroke: '#2A1F2D', strokeThickness: Math.max(4, size / 7) });
}
