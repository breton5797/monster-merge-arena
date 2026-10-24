import type Phaser from 'phaser';
import type { ArtSpec } from './art';
import type { Services } from './services';
import type { GameData } from './types';

// Phaser 레지스트리에 저장된 전역 객체를 타입 안전하게 꺼낸다 (BootScene에서 저장)

export function getData(scene: Phaser.Scene): GameData {
  const d: unknown = scene.registry.get('data');
  if (!d) throw new Error('GameData가 로드되지 않았습니다 (BootScene 확인)');
  return d as GameData;
}

export function getArt(scene: Phaser.Scene): ReadonlyMap<string, ArtSpec> {
  const a: unknown = scene.registry.get('art');
  if (!a) throw new Error('아트가 준비되지 않았습니다 (BootScene 확인)');
  return a as ReadonlyMap<string, ArtSpec>;
}

export function getServices(scene: Phaser.Scene): Services {
  const s: unknown = scene.registry.get('services');
  if (!s) throw new Error('Services가 초기화되지 않았습니다 (BootScene 확인)');
  return s as Services;
}
