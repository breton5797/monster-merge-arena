import monsters from './data/monsters.json';
import fusions from './data/fusions.json';
import elements from './data/elements.json';
import enemies from './data/enemies.json';
import stages from './data/stages.json';
import config from './data/config.json';
import { buildGameData, type GameData } from './types';

/** src/data/*.json을 검증해 GameData로 만든다. 실패 시 어떤 파일 어떤 항목인지 에러. */
export function loadGameData(): GameData {
  return buildGameData({ monsters, fusions, elements, enemies, stages, config });
}
