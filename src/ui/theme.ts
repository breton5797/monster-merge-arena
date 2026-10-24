// 공통 UI 스타일 (Arcade Core 분리 후보)
import Phaser from 'phaser';

export const FONT = '"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",system-ui,sans-serif';

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
