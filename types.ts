
export enum ElementType {
  FIRE = 'FIRE',
  WATER = 'WATER',
  EARTH = 'EARTH',
  AIR = 'AIR'
}

export interface Position {
  x: number;
  y: number;
}

export interface Tower {
  id: string;
  type: ElementType;
  tier: number; // 1 to 5
  x: number;
  y: number;
  lastFired: number;
  range: number;
  damage: number;
  fireRate: number; // ms
  cost: number;
  projectileSpeed: number;
  color: string;
}

export interface StatusEffect {
  type: 'burn' | 'slow' | 'stun';
  duration: number; // ms
  value?: number; // Damage per tick for burn, factor for slow
}

export interface Enemy {
  id: string;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  speed: number;
  reward: number;
  pathIndex: number;
  isBoss: boolean;
  slowFactor: number; // base slow factor
  activeEffects: StatusEffect[];
}

export interface Projectile {
  id: string;
  x: number;
  y: number;
  targetId: string;
  damage: number;
  speed: number;
  color: string;
  type: ElementType;
}

export interface GameState {
  gold: number;
  diamonds: number;
  hearts: number;
  wave: number;
  isGameOver: boolean;
  isGameStarted: boolean;
  isPaused: boolean;
  selectedTowerId: string | null;
  draggingTowerId: string | null;
  dragPosition: Position | null;
  dragStartPos: Position | null;
  originalTowerPos: Position | null;
  gameSpeed: number;
}
