
import { ElementType } from './types';

export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;
export const TILE_SIZE = 50;
export const INITIAL_GOLD = 150;
export const INITIAL_DIAMONDS = 0;
export const INITIAL_HEARTS = 10;
export const MAX_TIER = 5;

export const TOWER_STATS = {
  [ElementType.FIRE]: {
    color: '#ef4444',
    baseDamage: 25,
    baseRange: 120,
    baseFireRate: 1000,
    cost: 50,
    projectileSpeed: 5,
    description: 'Deals burning damage over time'
  },
  [ElementType.WATER]: {
    color: '#3b82f6',
    baseDamage: 10,
    baseRange: 100,
    baseFireRate: 800,
    cost: 40,
    projectileSpeed: 6,
    description: 'Slows enemies down'
  },
  [ElementType.EARTH]: {
    color: '#84cc16',
    baseDamage: 40,
    baseRange: 80,
    baseFireRate: 1500,
    cost: 60,
    projectileSpeed: 4,
    description: 'Stuns enemies on impact'
  },
  [ElementType.AIR]: {
    color: '#06b6d4',
    baseDamage: 15,
    baseRange: 180,
    baseFireRate: 500,
    cost: 45,
    projectileSpeed: 8,
    splashRadius: 60,
    description: 'Rapid fire AoE damage'
  }
};

export const MOB_PATH = [
  { x: 0, y: 100 },
  { x: 200, y: 100 },
  { x: 200, y: 300 },
  { x: 500, y: 300 },
  { x: 500, y: 150 },
  { x: 750, y: 150 },
  { x: 750, y: 500 },
  { x: 0, y: 500 } // Exit
];
