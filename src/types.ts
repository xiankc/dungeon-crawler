export interface Point {
  x: number;
  y: number;
}

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  onGround: boolean;
  facingLeft: boolean;
  coyoteTimer: number; // For smooth jumping just after leaving a edge
  jumpBuffered: boolean; // For jump registers slightly before landing
  jumpBufferTimer: number;
  isDead: boolean;
  deathTimer: number;
  respawnX: number;
  respawnY: number;
}

export interface MovingPlatform {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  speed: number;
  direction: 1 | -1; // 1 = forward, -1 = backward
  progress: number; // 0 to 1
}

export interface LevelItem {
  id: string;
  gridX: number;
  gridY: number;
  type: 'coin' | 'key' | 'door';
  collected?: boolean;
  opened?: boolean;
}

export interface Torch {
  gridX: number;
  gridY: number;
  flickerTimer: number;
  intensity: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export interface Level {
  name: string;
  description: string;
  grid: string[];
  movingPlatforms: Omit<MovingPlatform, 'x' | 'y' | 'progress' | 'direction'>[];
}

export type GameStatus = 'menu' | 'playing' | 'paused' | 'level_complete' | 'victory' | 'game_over';
