import type { ElementId, ElementsFile } from '../types';

/** 공격 속성 → 방어 속성 데미지 배율. 순환: 불→풀→바위→번개→물→불 */
export function getMultiplier(attacker: ElementId, defender: ElementId, elements: ElementsFile): number {
  const { multiplier } = elements;
  if (elements.elements[attacker].beats === defender) return multiplier.advantage;
  if (elements.elements[defender].beats === attacker) return multiplier.disadvantage;
  return multiplier.neutral;
}
