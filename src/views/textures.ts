import Phaser from 'phaser';
import { creatureKey, creatureSvg, loadArt, type ArtSpec } from '../art';
import { backgroundKey, backgroundSvg, thumbKey, THEME_IDS } from '../art/backgrounds';
import { ICON_NAMES, iconKey, iconSvg } from '../art/icons';
import { toDataUri } from '../art/svg';
import { laneX } from '../systems/layout';
import type { GameData } from '../types';

/** 캐릭터 텍스처 해상도(px). 화면 표시 크기의 약 2배 → 고해상도 폰에서도 선명 */
const CREATURE_PX = 320;
const ICON_PX = 96;
/** 메뉴 스테이지 카드용 배경 높이 (폭 720 기준) */
const THUMB_H = 320;

function resize(svg: string, px: number): string {
  return svg.replace(/width="[\d.]+" height="[\d.]+"/, `width="${px}" height="${px}"`);
}

function addSvg(scene: Phaser.Scene, key: string, svg: string): Promise<void> {
  if (scene.textures.exists(key)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      scene.textures.addImage(key, img);
      resolve();
    };
    img.onerror = () => reject(new Error(`텍스처 생성 실패: ${key}`));
    img.src = toDataUri(svg);
  });
}

/** 모든 캐릭터·아이콘·배경 SVG를 텍스처로 만든다. onProgress(0~1) */
export async function buildTextures(scene: Phaser.Scene, data: GameData, onProgress: (p: number) => void): Promise<Map<string, ArtSpec>> {
  const art = loadArt();
  const ids = new Set([...data.monsters.map((m) => m.id), ...data.enemies.map((e) => e.id)]);
  const missing = [...ids].filter((id) => !art.some((a) => a.id === id));
  if (missing.length) throw new Error(`art.json에 캐릭터 스펙이 없습니다: ${missing.join(', ')}`);
  const lanes = Array.from({ length: data.config.board.cols }, (_, i) => laneX(i, data.config));
  const fieldH = data.config.layout.boardTop - data.config.layout.fieldTop;
  const jobs: (() => Promise<void>)[] = [
    ...art.map((s) => () => addSvg(scene, creatureKey(s.id), resize(creatureSvg(s), CREATURE_PX))),
    ...ICON_NAMES.map((n) => () => addSvg(scene, iconKey(n), iconSvg(n, ICON_PX))),
    ...THEME_IDS.map((t) => () => addSvg(scene, backgroundKey(t), backgroundSvg(t, lanes, data.config.board.cellSize - 40, fieldH))),
    ...THEME_IDS.map((t) => () => addSvg(scene, thumbKey(t), backgroundSvg(t, lanes, data.config.board.cellSize - 40, THUMB_H, 3))),
  ];
  let done = 0;
  // 순차보다 빠르게, 너무 많이 동시에 디코딩하지 않도록 8개씩
  for (let i = 0; i < jobs.length; i += 8) {
    await Promise.all(jobs.slice(i, i + 8).map((j) => j().then(() => onProgress(++done / jobs.length))));
  }
  return new Map(art.map((a) => [a.id, a]));
}
