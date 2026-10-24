import type Phaser from 'phaser';
import type { Services } from './services';
import type { GameData } from './types';

// Phaser 레지스트리에 저장된 전역 객체를 타입 안전하게 꺼낸다 (BootScene에서 저장)

export function getData(scene: Phaser.Scene): GameData {
  const d: unknown = scene.registry.get('data');
  if (!d) throw new Error('GameData가 로드되지 않았습니다 (BootScene 확인)');
  return d as GameData;
}

export function getServices(scene: Phaser.Scene): Services {
  const s: unknown = scene.registry.get('services');
  if (!s) throw new Error('Services가 초기화되지 않았습니다 (BootScene 확인)');
  return s as Services;
}
