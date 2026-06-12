import React, { useEffect, useRef, useState } from 'react';
import { Player, MovingPlatform, LevelItem, Particle, Torch, GameStatus } from '../types';
import { LEVELS } from '../levels';
import { sound } from '../audio';
import { Shield, Sparkles, Key, CheckCircle } from 'lucide-react';

interface DungeonCanvasProps {
  levelIndex: number;
  status: GameStatus;
  isMuted: boolean;
  onCoinCollected: (total: number) => void;
  onKeyCollected: (keyCount: number) => void;
  onDoorUnlocked: () => void;
  onCheckpointTriggered: (msg: string) => void;
  onDeath: () => void;
  onLevelComplete: () => void;
  onPauseToggle: () => void;
  timeElapsed: number;
}

// Tile Constant Sizes
const TILE_SIZE = 32;

export const DungeonCanvas: React.FC<DungeonCanvasProps> = ({
  levelIndex,
  status,
  isMuted,
  onCoinCollected,
  onKeyCollected,
  onDoorUnlocked,
  onCheckpointTriggered,
  onDeath,
  onLevelComplete,
  onPauseToggle,
  timeElapsed,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keyboard references
  const keysPressed = useRef<{ [key: string]: boolean }>({});

  // Render loop tracking
  const animationFrameId = useRef<number | null>(null);

  // Level State loaded dynamically
  const level = LEVELS[levelIndex];
  const gridRows = level.grid.length;
  const gridCols = level.grid[0].length;
  const levelWidth = gridCols * TILE_SIZE;
  const levelHeight = gridRows * TILE_SIZE;

  // Viewport sizes
  const [viewSize, setViewSize] = useState({ width: 800, height: 480 });

  // Game Engine entities
  const playerRef = useRef<Player>({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    width: 22, // slightly smaller than tile for smooth corner fitting
    height: 30,
    onGround: false,
    facingLeft: false,
    coyoteTimer: 0,
    jumpBuffered: false,
    jumpBufferTimer: 0,
    isDead: false,
    deathTimer: 0,
    respawnX: 0,
    respawnY: 0,
  });

  const movingPlatformsRef = useRef<MovingPlatform[]>([]);
  const itemsRef = useRef<LevelItem[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const torchesRef = useRef<Torch[]>([]);
  const activeCheckpointRef = useRef<{ x: number; y: number } | null>(null);

  // Tracking if player is holding keys
  const keysCountRef = useRef<number>(0);
  const coinsCountRef = useRef<number>(0);

  // Track the scroll camera position
  const cameraRef = useRef({ x: 0, y: 0 });

  // On-screen Virtual Controls States (for Touch devices UI or visual integration)
  const virtualControlsRef = useRef({
    left: false,
    right: false,
    jump: false,
  });

  // Track animation frame/flicker step
  const animationStep = useRef<number>(0);

  // Initialize Level entities
  const initLevel = () => {
    const rawGrid = level.grid;
    const itemsList: LevelItem[] = [];
    const torchesList: Torch[] = [];

    let spawnX = 64;
    let spawnY = 128;

    // Load static tiles and filter them
    for (let r = 0; r < rawGrid.length; r++) {
      for (let c = 0; c < rawGrid[r].length; c++) {
        const char = rawGrid[r][c];
        const gx = c * TILE_SIZE;
        const gy = r * TILE_SIZE;

        if (char === 'P') {
          spawnX = gx + 5;
          spawnY = gy + (TILE_SIZE - 30);
        } else if (char === 'C') {
          itemsList.push({
            id: `coin-${r}-${c}`,
            gridX: c,
            gridY: r,
            type: 'coin',
            collected: false,
          });
        } else if (char === 'K') {
          itemsList.push({
            id: `key-${r}-${c}`,
            gridX: c,
            gridY: r,
            type: 'key',
            collected: false,
          });
        } else if (char === 'D') {
          itemsList.push({
            id: `door-${r}-${c}`,
            gridX: c,
            gridY: r,
            type: 'door',
            opened: false,
          });
        }

        // Place decorative torches above walls randomly, or near key areas
        if (char === '#' && r > 0 && rawGrid[r - 1][c] === ' ' && Math.random() < 0.15) {
          torchesList.push({
            gridX: c,
            gridY: r - 1,
            flickerTimer: Math.random() * 100,
            intensity: 0.8 + Math.random() * 0.4,
          });
        }
      }
    }

    // Load checkpoint starting location
    if (activeCheckpointRef.current && levelIndex > 0) {
      // Keep checkpoint if LevelIndex is the same, reset on next level
    } else {
      activeCheckpointRef.current = null;
    }

    const pX = activeCheckpointRef.current ? activeCheckpointRef.current.x : spawnX;
    const pY = activeCheckpointRef.current ? activeCheckpointRef.current.y : spawnY;

    // Set player
    playerRef.current = {
      x: pX,
      y: pY,
      vx: 0,
      vy: 0,
      width: 22,
      height: 30,
      onGround: false,
      facingLeft: false,
      coyoteTimer: 0,
      jumpBuffered: false,
      jumpBufferTimer: 0,
      isDead: false,
      deathTimer: 0,
      respawnX: spawnX,
      respawnY: spawnY,
    };

    // Load Moving platforms
    movingPlatformsRef.current = level.movingPlatforms.map((mp, idx) => ({
      ...mp,
      x: mp.startX,
      y: mp.startY,
      progress: 0,
      direction: 1,
    }));

    // Save lists
    itemsRef.current = itemsList;
    torchesRef.current = torchesList;
    particlesRef.current = [];
    keysCountRef.current = 0;
    coinsCountRef.current = 0;

    // Initial callbacks to sync HUD
    onCoinCollected(0);
    onKeyCollected(0);

    // Position camera initially
    cameraRef.current = {
      x: Math.max(0, Math.min(levelWidth - viewSize.width, playerRef.current.x - viewSize.width / 2)),
      y: Math.max(0, Math.min(levelHeight - viewSize.height, playerRef.current.y - viewSize.height / 2)),
    };
  };

  // Re-run init when level changes
  useEffect(() => {
    initLevel();
  }, [levelIndex]);

  // Handle Resize of canvas container dynamically
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const width = Math.max(320, rect.width);
        // Constrain height within responsive limits
        const height = Math.min(540, width * 0.55);
        setViewSize({ width, height });
      }
    };

    handleResize();
    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  // Listeners for Controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = true;

      // Disable browser page scroll on cursor key inputs for games
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key)) {
        e.preventDefault();
      }

      if (e.key === 'p' || e.key === 'Escape') {
        onPauseToggle();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [onPauseToggle]);

  // Spawn visual particles
  const spawnParticles = (x: number, y: number, color: string, count: number, speedVal: number = 3) => {
    const pList: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * speedVal;
      const maxLife = 15 + Math.floor(Math.random() * 25);
      pList.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (Math.random() * 1.5), // slight upward bias
        color,
        size: 2 + Math.random() * 4,
        life: maxLife,
        maxLife,
      });
    }
    particlesRef.current.push(...pList);
  };

  // Helper check for overlap
  const isOverlapping = (
    ax: number, ay: number, aw: number, ah: number,
    bx: number, by: number, bw: number, bh: number
  ) => {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  };

  // Check if position is solid tile
  const isSolidTile = (tileChar: string | undefined): boolean => {
    if (!tileChar) return false;
    // Walkable or items are not solid
    // # is wall, D is door (if not opened yet)
    if (tileChar === '#') return true;
    if (tileChar === 'D') {
      // Find if corresponding door item is opened
      // The canvas holds door items. Checking if any door at that position is still closed
      return true; 
    }
    return false;
  };

  const getTileAtPixel = (x: number, y: number): string => {
    const col = Math.floor(x / TILE_SIZE);
    const row = Math.floor(y / TILE_SIZE);
    if (col < 0 || col >= gridCols || row < 0 || row >= gridRows) return '#'; // Bounds look solid
    return level.grid[row][col];
  };

  // Collision with tile boundaries
  const collidesWithSolid = (px: number, py: number, width: number, height: number): { hit: boolean; tileX: number; tileY: number; type: string } => {
    const left = Math.floor(px / TILE_SIZE);
    const right = Math.floor((px + width) / TILE_SIZE);
    const top = Math.floor(py / TILE_SIZE);
    const bottom = Math.floor((py + height) / TILE_SIZE);

    for (let r = top; r <= bottom; r++) {
      for (let c = left; c <= right; c++) {
        if (c < 0 || c >= gridCols || r < 0 || r >= gridRows) {
          // Out of horizontal/vertical bounds
          return { hit: true, tileX: c, tileY: r, type: 'wall' };
        }
        const char = level.grid[r][c];
        if (char === '#') {
          return { hit: true, tileX: c, tileY: r, type: 'wall' };
        }
        if (char === 'D') {
          // Find this door state
          const door = itemsRef.current.find(item => item.gridX === c && item.gridY === r && item.type === 'door');
          if (door && !door.opened) {
            return { hit: true, tileX: c, tileY: r, type: 'door' };
          }
        }
      }
    }
    return { hit: false, tileX: -1, tileY: -1, type: '' };
  };

  // Main game update physics logic
  const updatePhysics = () => {
    const player = playerRef.current;
    if (player.isDead) {
      player.deathTimer--;
      if (player.deathTimer <= 0) {
        // Respawn
        player.isDead = false;
        player.vx = 0;
        player.vy = 0;
        
        // Spawn at checkpoint or start
        const respawnTarget = activeCheckpointRef.current || { x: player.respawnX, y: player.respawnY };
        player.x = respawnTarget.x;
        player.y = respawnTarget.y;
        
        // Wipe dynamic velocities
        player.coyoteTimer = 0;
        player.jumpBufferTimer = 0;
        player.jumpBuffered = false;
        
        spawnParticles(player.x + player.width / 2, player.y + player.height / 2, '#4ade80', 20, 2);
      }
      return;
    }

    // 1. Advance timers
    if (player.coyoteTimer > 0) player.coyoteTimer--;
    if (player.jumpBufferTimer > 0) {
      player.jumpBufferTimer--;
      if (player.jumpBufferTimer <= 0) player.jumpBuffered = false;
    }

    // 2. Fetch Keyboard and Virtual Controls
    const leftActive = keysPressed.current['a'] || keysPressed.current['arrowleft'] || virtualControlsRef.current.left;
    const rightActive = keysPressed.current['d'] || keysPressed.current['arrowright'] || virtualControlsRef.current.right;
    const jumpActive = keysPressed.current['w'] || keysPressed.current['arrowup'] || keysPressed.current[' '] || virtualControlsRef.current.jump;

    // Buffer jump input
    if (jumpActive) {
      player.jumpBuffered = true;
      player.jumpBufferTimer = 8; // holds buffer for 8 frames
    }

    // 3. Update Moving Platforms Position
    movingPlatformsRef.current.forEach((mp) => {
      // Progress from start to end back and forth
      const dx = mp.endX - mp.startX;
      const dy = mp.endY - mp.startY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 0) {
        // Increment progress
        mp.progress += (mp.speed / dist) * mp.direction;
        if (mp.progress >= 1) {
          mp.progress = 1;
          mp.direction = -1;
        } else if (mp.progress <= 0) {
          mp.progress = 0;
          mp.direction = 1;
        }

        // Interpolated new positions
        const nextX = mp.startX + dx * mp.progress;
        const nextY = mp.startY + dy * mp.progress;

        mp.x = nextX;
        mp.y = nextY;
      }
    });

    // 4. Horizontal movement acceleration & friction
    const acc = 0.65;
    const fGround = 0.82;
    const fAir = 0.96;
    const maxSpeed = 4.8;

    if (leftActive) {
      player.vx -= acc;
      player.facingLeft = true;
    } else if (rightActive) {
      player.vx += acc;
      player.facingLeft = false;
    } else {
      // Friction
      player.vx *= player.onGround ? fGround : fAir;
    }

    // Clamp speed
    if (player.vx > maxSpeed) player.vx = maxSpeed;
    if (player.vx < -maxSpeed) player.vx = -maxSpeed;

    // Small numbers stop
    if (Math.abs(player.vx) < 0.1) player.vx = 0;

    // 5. Gravity
    const gravityForce = 0.45;
    const terminalVelocity = 11;
    player.vy += gravityForce;
    if (player.vy > terminalVelocity) player.vy = terminalVelocity;

    // 6. Resolve Collisions: Horizontal First
    player.x += player.vx;
    let colHoriz = collidesWithSolid(player.x, player.y, player.width, player.height);
    if (colHoriz.hit) {
      if (player.vx > 0) {
        // Moving right, hit wall left side
        const tileColX = colHoriz.tileX * TILE_SIZE;
        player.x = tileColX - player.width - 0.1;
      } else if (player.vx < 0) {
        // Moving left, hit wall right side
        const tileColRightX = (colHoriz.tileX + 1) * TILE_SIZE;
        player.x = tileColRightX + 0.1;
      }
      player.vx = 0;
    }

    // Moving platforms horizontal passenger link
    // Scan if standing on a platform
    let stoodPlatform: MovingPlatform | null = null;
    movingPlatformsRef.current.forEach(mp => {
      const isStandingOn = isOverlapping(
        player.x, player.y + player.height, player.width, 2, // fine check line below player
        mp.x, mp.y, mp.width, 4
      );
      if (isStandingOn && player.vy >= 0) {
        stoodPlatform = mp;
      }
    });

    if (stoodPlatform) {
      // Calculate delta movement
      const mp: MovingPlatform = stoodPlatform;
      const dx = mp.endX - mp.startX;
      const dy = mp.endY - mp.startY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0) {
        const stepSpeedX = (dx / dist) * mp.speed * mp.direction;
        player.x += stepSpeedX;
        // Check if platform push pushes player into walls
        const wallCheck = collidesWithSolid(player.x, player.y, player.width, player.height);
        if (wallCheck.hit) {
          player.x -= stepSpeedX; // revert push
        }
      }
    }

    // 7. Resolve Collisions: Vertical Second
    player.onGround = false;
    player.y += player.vy;
    let colVert = collidesWithSolid(player.x, player.y, player.width, player.height);
    if (colVert.hit) {
      if (player.vy > 0) {
        // Falling down, hit floor
        const tileRowY = colVert.tileY * TILE_SIZE;
        player.y = tileRowY - player.height - 0.1;
        player.onGround = true;
        player.coyoteTimer = 8; // grant coyote time jump option
      } else if (player.vy < 0) {
        // Jumping up, hit ceiling
        const tileRowBottomY = (colVert.tileY + 1) * TILE_SIZE;
        player.y = tileRowBottomY + 0.1;
      }
      player.vy = 0;
    }

    // Vertical Platform checks
    if (!player.onGround && player.vy >= 0) {
      movingPlatformsRef.current.forEach((mp) => {
        // Prioritize landing on top of moving platform
        const wasAbove = (player.y + player.height - player.vy) <= mp.y + 4;
        const nowColliding = isOverlapping(
          player.x, player.y, player.width, player.height + 1,
          mp.x, mp.y, mp.width, mp.height
        );

        if (wasAbove && nowColliding) {
          player.y = mp.y - player.height;
          player.vy = 0;
          player.onGround = true;
          player.coyoteTimer = 8;
        }
      });
    }

    // 8. Handle Jumping
    if (player.jumpBuffered && (player.onGround || player.coyoteTimer > 0)) {
      player.vy = -9.2; // jump force
      player.onGround = false;
      player.coyoteTimer = 0;
      player.jumpBuffered = false;
      sound.playJump();
      
      // Spawn tiny ground dust puff
      spawnParticles(player.x + player.width / 2, player.y + player.height, '#9ca3af', 6, 1.5);
    }

    // 9. Interactive Obstacles (Tile triggers)
    // Check overlapping tiles for spikes, lava, keys, coins, portal, checkpoint
    const checkSpikeCheckpoints = () => {
      const leftCol = Math.floor(player.x / TILE_SIZE);
      const rightCol = Math.floor((player.x + player.width) / TILE_SIZE);
      const topRow = Math.floor(player.y / TILE_SIZE);
      const bottomRow = Math.floor((player.y + player.height) / TILE_SIZE);

      for (let r = Math.max(0, topRow); r <= Math.min(gridRows - 1, bottomRow); r++) {
        for (let c = Math.max(0, leftCol); c <= Math.min(gridCols - 1, rightCol); c++) {
          const char = level.grid[r][c];

          // Triggering Checkpoint
          if (char === 'G') {
            const cpX = c * TILE_SIZE + 5;
            const cpY = r * TILE_SIZE + (TILE_SIZE - player.height);
            if (!activeCheckpointRef.current || activeCheckpointRef.current.x !== cpX || activeCheckpointRef.current.y !== cpY) {
              activeCheckpointRef.current = { x: cpX, y: cpY };
              sound.playKey(); // glowing chime
              onCheckpointTriggered("Checkpoint Activated! Spawn point updated.");
              spawnParticles(c * TILE_SIZE + 16, r * TILE_SIZE + 16, '#22c55e', 24, 2.5);
            }
          }

          // Trigger Spikes or Lava/Magma
          if (char === 'S' || char === 'L') {
            triggerDeath(char === 'L' ? 'lava' : 'spikes');
            return;
          }

          // Exit portal contact
          if (char === 'X') {
            onLevelComplete();
            sound.playWin();
            // Explosion particles around portal
            spawnParticles(c * TILE_SIZE + 16, r * TILE_SIZE + 16, '#a855f7', 40, 4);
            return;
          }
        }
      }
    };

    checkSpikeCheckpoints();

    // 10. Item Overlaps: Keys, Coins, Locking Doors
    itemsRef.current.forEach((item) => {
      if (item.collected || item.opened) return;

      const ix = item.gridX * TILE_SIZE + 6;
      const iy = item.gridY * TILE_SIZE + 6;
      const isize = 20;

      const itemOverlap = isOverlapping(
        player.x, player.y, player.width, player.height,
        ix, iy, isize, isize
      );

      if (itemOverlap) {
        if (item.type === 'coin') {
          item.collected = true;
          coinsCountRef.current++;
          onCoinCollected(coinsCountRef.current);
          sound.playCoin();
          spawnParticles(ix + 10, iy + 10, '#fbbf24', 12, 2.5); // gold sparks
        } else if (item.type === 'key') {
          item.collected = true;
          keysCountRef.current++;
          onKeyCollected(keysCountRef.current);
          sound.playKey();
          spawnParticles(ix + 10, iy + 10, '#38bdf8', 12, 2.5); // sky blue sparks
        } else if (item.type === 'door') {
          // If door, check if player has key
          if (keysCountRef.current > 0) {
            item.opened = true;
            keysCountRef.current--;
            onKeyCollected(keysCountRef.current);
            onDoorUnlocked();
            sound.playUnlock();
            spawnParticles(ix + 10, iy + 10, '#b45309', 20, 3); // wooden shards particles
          }
        }
      }
    });

    // Fall of map death check
    if (player.y > levelHeight + 100) {
      triggerDeath('fall');
    }
  };

  const triggerDeath = (mode: 'spikes' | 'lava' | 'fall') => {
    const player = playerRef.current;
    if (player.isDead) return;

    player.isDead = true;
    player.deathTimer = 40; // 40 frame freeze/wait
    sound.playHit();
    onDeath();

    const deathColor = mode === 'lava' ? '#f97316' : mode === 'spikes' ? '#ef4444' : '#6b7280';
    spawnParticles(player.x + player.width / 2, player.y + player.height / 2, deathColor, 35, 4);
  };

  // Update particles positions
  const updateParticles = () => {
    const activeParticles: Particle[] = [];
    particlesRef.current.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08; // small gravity bias for particles
      p.life--;
      if (p.life > 0) {
        activeParticles.push(p);
      }
    });
    particlesRef.current = activeParticles;
  };

  // Smooth camera following
  const updateCamera = () => {
    const p = playerRef.current;
    // Smooth camera interpolation (lerp)
    const targetCamX = p.x - viewSize.width / 2 + p.width / 2;
    const targetCamY = p.y - viewSize.height / 2 + p.height / 2;

    // Direct clamping to level bounds
    const minX = 0;
    const maxX = Math.max(0, levelWidth - viewSize.width);
    const minY = 0;
    const maxY = Math.max(0, levelHeight - viewSize.height);

    const clampedTargetX = Math.max(minX, Math.min(maxX, targetCamX));
    const clampedTargetY = Math.max(minY, Math.min(maxY, targetCamY));

    // Smooth scroll interpolation factor (0.1)
    cameraRef.current.x += (clampedTargetX - cameraRef.current.x) * 0.1;
    cameraRef.current.y += (clampedTargetY - cameraRef.current.y) * 0.1;
  };

  // Main Draw function called every frame
  const draw = (ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, viewSize.width, viewSize.height);

    // Save camera context offset
    ctx.save();
    ctx.translate(-Math.floor(cameraRef.current.x), -Math.floor(cameraRef.current.y));

    // 1. Draw level background grid with elegant gridlines
    const colsCount = Math.ceil(levelWidth / TILE_SIZE);
    const rowsCount = Math.ceil(levelHeight / TILE_SIZE);
    
    ctx.fillStyle = '#0f172a'; // Slate-900 background
    ctx.fillRect(0, 0, levelWidth, levelHeight);

    // Subtle background guidelines/texture
    ctx.strokeStyle = '#1e293b'; // Slate-800
    ctx.lineWidth = 0.5;
    for (let r = 0; r <= rowsCount; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * TILE_SIZE);
      ctx.lineTo(levelWidth, r * TILE_SIZE);
      ctx.stroke();
    }
    for (let c = 0; c <= colsCount; c++) {
      ctx.beginPath();
      ctx.moveTo(c * TILE_SIZE, 0);
      ctx.lineTo(c * TILE_SIZE, levelHeight);
      ctx.stroke();
    }

    // 2. Draw static level structure
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        const char = level.grid[r][c];
        const gx = c * TILE_SIZE;
        const gy = r * TILE_SIZE;

        // Brick Walls
        if (char === '#') {
          // Main blocks
          ctx.fillStyle = '#334155'; // Slate-700
          ctx.fillRect(gx, gy, TILE_SIZE, TILE_SIZE);

          // Add elegant 3D bevel brick lines
          ctx.fillStyle = '#475569'; // light bevel
          ctx.fillRect(gx, gy, TILE_SIZE, 3); // top
          ctx.fillRect(gx, gy, 3, TILE_SIZE); // left

          ctx.fillStyle = '#1e293b'; // shadow bevel
          ctx.fillRect(gx, gy + TILE_SIZE - 3, TILE_SIZE, 3); // bottom
          ctx.fillRect(gx + TILE_SIZE - 3, gy, 3, TILE_SIZE); // right
        }

        // Spikes Obstacles
        if (char === 'S') {
          ctx.fillStyle = '#e2e8f0'; // sharp white silver
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 1;
          
          const paddingX = 4;
          const spikeWidth = (TILE_SIZE - paddingX * 2) / 3;
          
          for (let sIdx = 0; sIdx < 3; sIdx++) {
            const sx = gx + paddingX + sIdx * spikeWidth;
            ctx.beginPath();
            ctx.moveTo(sx, gy + TILE_SIZE); // left base
            ctx.lineTo(sx + spikeWidth / 2, gy + TILE_SIZE - 20); // tip
            ctx.lineTo(sx + spikeWidth, gy + TILE_SIZE); // right base
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
        }

        // Checkpoints flag trigger
        if (char === 'G') {
          const isCurrentActive = activeCheckpointRef.current && 
            Math.abs(activeCheckpointRef.current.x - (gx + 5)) < 10;

          // Flag stand
          ctx.fillStyle = '#64748b';
          ctx.fillRect(gx + 14, gy + 8, 4, 24);

          // Glowing energy flag circle
          const glowPhase = Math.sin(animationStep.current * 0.1) * 3;
          ctx.beginPath();
          ctx.arc(gx + 16, gy + 12, 6 + Math.abs(glowPhase), 0, Math.PI * 2);
          ctx.fillStyle = isCurrentActive ? '#22c55e' : '#e2e8f0'; // bright green vs silver
          ctx.fill();

          // Flag banner
          ctx.beginPath();
          ctx.moveTo(gx + 18, gy + 8);
          ctx.lineTo(gx + 30, gy + 12);
          ctx.lineTo(gx + 18, gy + 16);
          ctx.closePath();
          ctx.fillStyle = isCurrentActive ? '#15803d' : '#94a3b8';
          ctx.fill();
        }

        // Lava
        if (char === 'L') {
          // Dynamic liquid lava waves
          const wavePhase = Math.sin(animationStep.current * 0.08 + c * 0.5) * 5;
          ctx.fillStyle = '#ea580c'; // Intense orange
          ctx.fillRect(gx, gy + 8 + wavePhase, TILE_SIZE, TILE_SIZE - (8 + wavePhase));

          // Lava Core yellow-hot top liquid layer
          ctx.fillStyle = '#facc15'; // Hot yellow
          ctx.fillRect(gx, gy + 8 + wavePhase, TILE_SIZE, 3);
        }
      }
    }

    // 3. Draw items: Coins, Keys, Locking Doors
    itemsRef.current.forEach((item) => {
      const gx = item.gridX * TILE_SIZE;
      const gy = item.gridY * TILE_SIZE;

      if (item.type === 'coin' && !item.collected) {
        // Floating coin effect
        const bounce = Math.sin(animationStep.current * 0.1 + item.gridX) * 4;
        
        ctx.beginPath();
        // Render beautiful oval 3D spinning coin
        const spinWidth = 10 * Math.cos(animationStep.current * 0.08 + item.gridX);
        ctx.ellipse(gx + 16, gy + 16 + bounce, Math.abs(spinWidth), 11, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#f59e0b'; // Amber Gold
        ctx.strokeStyle = '#fef08a'; // bright outline
        ctx.lineWidth = 1.5;
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fffbeb';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', gx + 16, gy + 16.5 + bounce);
      }

      if (item.type === 'key' && !item.collected) {
        const bounce = Math.cos(animationStep.current * 0.1 + item.gridX) * 3;
        const kx = gx + 16;
        const ky = gy + 16 + bounce;

        // Key head loop hoop
        ctx.beginPath();
        ctx.arc(kx - 4, ky, 5, 0, Math.PI * 2);
        ctx.strokeStyle = '#38bdf8'; // Blue power key
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Key shaft and teeth
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(kx - 1, ky - 2, 10, 3); // shaft
        ctx.fillRect(kx + 5, ky, 2, 4); // tooth 1
        ctx.fillRect(kx + 8, ky, 2, 4); // tooth 2
      }

      if (item.type === 'door' && !item.opened) {
        // Locked Wooden/Iron Gate
        ctx.fillStyle = '#78350f'; // rich brown door
        ctx.fillRect(gx, gy, TILE_SIZE, TILE_SIZE);

        ctx.strokeStyle = '#451a03'; // door plank lines
        ctx.lineWidth = 2;
        ctx.strokeRect(gx + 2, gy + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        ctx.strokeRect(gx + 10, gy + 2, 1, TILE_SIZE - 4);
        ctx.strokeRect(gx + 20, gy + 2, 1, TILE_SIZE - 4);

        // Big Lock Shield in the center
        ctx.fillStyle = '#f59e0b'; // yellow brass lock
        ctx.fillRect(gx + 11, gy + 11, 10, 10);
        ctx.fillStyle = '#1e1b4b'; // lock keyhole
        ctx.beginPath();
        ctx.arc(gx + 16, gy + 14, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(gx + 15, gy + 15, 2, 5);
      }
    });

    // 4. Draw Portal / Exit (magical particle swirling)
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        if (level.grid[r][c] === 'X') {
          const px = c * TILE_SIZE + 16;
          const py = r * TILE_SIZE + 16;

          // Draw portal frame
          ctx.strokeStyle = '#c084fc'; // Light purple glow outer
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.ellipse(px, py, 14, 26, 0, 0, Math.PI * 2);
          ctx.stroke();

          // Swirling magical dynamic gradient core
          const portalGrad = ctx.createRadialGradient(px, py, 2, px, py, 15);
          portalGrad.addColorStop(0, '#faf5ff'); // core white
          portalGrad.addColorStop(0.4, '#a855f7'); // mid purple
          portalGrad.addColorStop(1, '#3b0764'); // deep purple dark
          
          ctx.fillStyle = portalGrad;
          ctx.beginPath();
          ctx.ellipse(px, py, 12, 24, 0, 0, Math.PI * 2);
          ctx.fill();

          // Spitting dynamic orbital purple pixel spikes
          if (Math.random() < 0.25) {
            spawnParticles(px, py + (Math.random() * 20 - 10), '#e9d5ff', 2, 1.5);
          }
        }
      }
    }

    // 5. Draw Platforms
    movingPlatformsRef.current.forEach((mp) => {
      // Wood/Slate floating block platform
      ctx.fillStyle = '#475569'; // lighter grey platform
      ctx.fillRect(mp.x, mp.y, mp.width, mp.height);

      // Support metal bindings or lines
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(mp.x, mp.y, mp.width, 3); // top highlight
      ctx.fillRect(mp.x + 4, mp.y + 4, 6, mp.height - 8);
      ctx.fillRect(mp.x + mp.width - 10, mp.y + 4, 6, mp.height - 8);

      ctx.fillStyle = '#0f172a'; // bottom shadowed bevel
      ctx.fillRect(mp.x, mp.y + mp.height - 3, mp.width, 3);
    });

    // 6. Draw Player
    const player = playerRef.current;
    if (!player.isDead) {
      ctx.save();
      
      const px = Math.floor(player.x);
      const py = Math.floor(player.y);

      // Simple bouncy walking squeeze scale animation
      const walkBounce = Math.abs(player.vx) > 0.1 ? Math.abs(Math.sin(animationStep.current * 0.15)) * 3 : 0;
      const jumpStretch = player.vy < 0 ? 3 : player.vy > 0 ? -3 : 0;

      const pWidth = player.width + jumpStretch;
      const pHeight = player.height - walkBounce - jumpStretch;
      const drawX = px - jumpStretch / 2;
      const drawY = py + walkBounce;

      // Draw character body: Knight or Adventurer styled box model
      // Draw body armor jacket/cape
      ctx.fillStyle = '#3b82f6'; // Knight blue
      ctx.fillRect(drawX, drawY + 8, pWidth, pHeight - 142 + 134); // solid base helper

      // Draw helmet metal / iron blue with face slit
      ctx.fillStyle = '#e2e8f0'; // shining silver armor
      ctx.fillRect(drawX + 1, drawY, pWidth - 2, 11);

      // Golden head plume crest
      ctx.fillStyle = '#de1c1c'; // crimson red plumes plumes
      ctx.fillRect(drawX + pWidth / 2 - 3, drawY - 4, 6, 4);

      // Laser black visor slits
      ctx.fillStyle = '#0f172a';
      const lookOffset = player.facingLeft ? 1 : pWidth - 7;
      ctx.fillRect(drawX + lookOffset, drawY + 3, 6, 3);
      ctx.fillStyle = '#facc15'; // glowing amber eye
      ctx.fillRect(drawX + lookOffset + (player.facingLeft ? 1 : 3), drawY + 3.5, 2, 2);

      // Bronze core chest plate shield emblem
      ctx.fillStyle = '#b45309';
      ctx.fillRect(drawX + pWidth / 2 - 3, drawY + 11, 6, 7);
      ctx.fillStyle = '#fbbf24'; // center crest emblem
      ctx.fillRect(drawX + pWidth / 2 - 1, drawY + 13, 2, 3);

      // Tiny iron feet
      ctx.fillStyle = '#475569';
      if (player.onGround) {
        // alternating walking steps
        const step = Math.sin(animationStep.current * 0.2) > 0;
        ctx.fillRect(drawX + 1, drawY + pHeight - 3, 6, 3); // Left Foot
        ctx.fillRect(drawX + pWidth - 7, drawY + pHeight - 3, 6, 3); // Right Foot
      } else {
        // flying/dangling feet
        ctx.fillRect(drawX + 2, drawY + pHeight - 2, 5, 4);
        ctx.fillRect(drawX + pWidth - 7, drawY + pHeight - 2, 5, 4);
      }

      ctx.restore();
    }

    // 7. Draw flying particles
    particlesRef.current.forEach((p) => {
      ctx.fillStyle = p.color;
      // Fade transparency based on remaining life ratio
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    ctx.globalAlpha = 1.0; // reset transparency

    // 8. Draw immersive ambient lighting vignette (dungeon flare overlay)
    ctx.restore(); // Exit camera translated scope

    // Draw darkness vignette mask
    const gradient = ctx.createRadialGradient(
      player.x + player.width / 2 - cameraRef.current.x,
      player.y + player.height / 2 - cameraRef.current.y,
      30, // core spotlight radius
      player.x + player.width / 2 - cameraRef.current.x,
      player.y + player.height / 2 - cameraRef.current.y,
      Math.max(180, viewSize.width * 0.45) // ambient limits
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)'); // fully lit center
    gradient.addColorStop(0.3, 'rgba(0, 0, 0, 0.45)'); // partial shade
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.96)'); // pitch black corners

    // Composite overlay multiply or soft light
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, viewSize.width, viewSize.height);

    // Render glowing spots on the vignette for Torches & Portal exits to create incredibly atmospheric scenes
    torchesRef.current.forEach(t => {
      const tx = t.gridX * TILE_SIZE + 16 - cameraRef.current.x;
      const ty = t.gridY * TILE_SIZE + 16 - cameraRef.current.y;

      // Draw torch visual representation inside the vignette viewport if visible
      if (tx > -32 && tx < viewSize.width + 32 && ty > -32 && ty < viewSize.height + 32) {
        // Draw fire flames on wall
        const fl = Math.sin(animationStep.current * 0.15 + t.flickerTimer) * 2;
        ctx.fillStyle = '#b45309'; // brown torch base
        ctx.fillRect(tx - 2, ty + 2, 4, 10);

        // flicker flame circles
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.arc(tx, ty - 2 + fl, 5 + fl, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(tx, ty - 1 + fl * 0.5, 3 + fl * 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Glow ring cutout over darkness vignette
        const torchGlow = ctx.createRadialGradient(tx, ty, 3, tx, ty, 60);
        torchGlow.addColorStop(0, 'rgba(251, 146, 60, 0.45)');
        torchGlow.addColorStop(1, 'rgba(251, 146, 60, 0)');
        
        ctx.fillStyle = torchGlow;
        ctx.globalCompositeOperation = 'screen';
        ctx.beginPath();
        ctx.arc(tx, ty, 60, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over'; // restore
      }
    });

    // Portal violet exit flame glow cutout
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        if (level.grid[r][c] === 'X') {
          const px = c * TILE_SIZE + 16 - cameraRef.current.x;
          const py = r * TILE_SIZE + 16 - cameraRef.current.y;

          if (px > -64 && px < viewSize.width + 64 && py > -64 && py < viewSize.height + 64) {
            const portalGlow = ctx.createRadialGradient(px, py, 10, px, py, 90);
            portalGlow.addColorStop(0, 'rgba(192, 132, 252, 0.45)'); // purple light
            portalGlow.addColorStop(1, 'rgba(192, 132, 252, 0)');

            ctx.fillStyle = portalGlow;
            ctx.globalCompositeOperation = 'screen';
            ctx.beginPath();
            ctx.arc(px, py, 90, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
          }
        }
      }
    }

    // Level description banner overlay just at the level start
    if (timeElapsed < 4.0 && status === 'playing') {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
      ctx.fillRect(0, viewSize.height - 42, viewSize.width, 42);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`Level ${levelIndex + 1}: ${level.name}`, 16, viewSize.height - 24);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '9px sans-serif';
      ctx.fillText("Reach the Portal to advance", 16, viewSize.height - 10);
    }
  };

  // Main continuous Engine running cycle
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const mainGameLoop = () => {
      if (status === 'playing') {
        animationStep.current++;
        updatePhysics();
        updateParticles();
        updateCamera();
      }

      draw(ctx);

      // continue frame requests
      animationFrameId.current = requestAnimationFrame(mainGameLoop);
    };

    // Begin loop immediately
    animationFrameId.current = requestAnimationFrame(mainGameLoop);

    return () => {
      if (animationFrameId.current !== null) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [status, viewSize, levelIndex]);

  // Sync mute values on system toggle
  useEffect(() => {
    sound.setMute(isMuted);
  }, [isMuted]);

  return (
    <div className="flex flex-col w-full h-full bg-slate-950 rounded-xl overflow-hidden shadow-2xl relative border border-slate-800">
      {/* Game Stage Area */}
      <div 
        ref={containerRef} 
        className="w-full flex-grow relative bg-slate-900 select-none overflow-hidden"
        style={{ minHeight: '260px' }}
      >
        <canvas
          ref={canvasRef}
          width={viewSize.width}
          height={viewSize.height}
          className="block mx-auto cursor-crosshair touch-none"
        />

        {/* Level Complete / Next Stage overlay banner */}
        {status === 'level_complete' && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col justify-center items-center p-6 text-center z-10">
            <div className="p-3 bg-fuchsia-600/20 text-fuchsia-400 border border-fuchsia-500 rounded-full mb-3 animate-bounce">
              <Sparkles className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold font-sans tracking-tight text-white mb-2">
              Level Clear!
            </h3>
            <p className="text-slate-300 text-sm max-w-sm mb-6">
              You've unlocked the secrets of {level.name}. Ready yourself for the next chamber.
            </p>
            <button
              onClick={() => onLevelComplete()}
              id="next-level-btn"
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg shadow-lg active:scale-95 transition cursor-pointer"
            >
              Enter Next Portal
            </button>
          </div>
        )}

        {/* Death overlay banner frame freeze helper */}
        {playerRef.current.isDead && (
          <div className="absolute inset-x-0 top-1/3 text-center pointer-events-none select-none z-10 animate-pulse">
            <span className="bg-red-950/80 border border-red-800 text-red-500 text-xs px-3 py-1.5 rounded-full font-mono uppercase tracking-widest font-semibold shadow-lg">
              RESPAWNING...
            </span>
          </div>
        )}
      </div>

      {/* On Screen Touch/Mouse Controls (For easy touch interact / standard navigation) */}
      <div className="flex flex-col bg-slate-900/40 p-3 items-center border-t border-slate-800 gap-2">
        <div className="flex justify-between items-center w-full max-w-lg">
          <span className="text-[10px] font-mono text-slate-500 hidden sm:block">
            Controls: AD / W (or Space / Arrow keys)
          </span>

          {/* Touch buttons pads */}
          <div className="flex gap-4 mx-auto sm:mx-0">
            {/* Horizontal joystick mock */}
            <div className="flex gap-1">
              <button
                id="ctrl-dpad-left"
                onTouchStart={() => { virtualControlsRef.current.left = true; }}
                onTouchEnd={() => { virtualControlsRef.current.left = false; }}
                onMouseDown={() => { virtualControlsRef.current.left = true; }}
                onMouseUp={() => { virtualControlsRef.current.left = false; }}
                onMouseLeave={() => { virtualControlsRef.current.left = false; }}
                className="w-12 h-12 bg-slate-800 active:bg-slate-700 hover:bg-slate-750 border border-slate-700 text-white rounded-lg flex items-center justify-center font-bold text-lg select-none cursor-pointer touch-none"
                style={{ minWidth: '44px', minHeight: '44px' }}
                title="Go Left"
              >
                ◀
              </button>
              <button
                id="ctrl-dpad-right"
                onTouchStart={() => { virtualControlsRef.current.right = true; }}
                onTouchEnd={() => { virtualControlsRef.current.right = false; }}
                onMouseDown={() => { virtualControlsRef.current.right = true; }}
                onMouseUp={() => { virtualControlsRef.current.right = false; }}
                onMouseLeave={() => { virtualControlsRef.current.right = false; }}
                className="w-12 h-12 bg-slate-800 active:bg-slate-700 hover:bg-slate-750 border border-slate-700 text-white rounded-lg flex items-center justify-center font-bold text-lg select-none cursor-pointer touch-none"
                style={{ minWidth: '44px', minHeight: '44px' }}
                title="Go Right"
              >
                ▶
              </button>
            </div>

            {/* Jump button */}
            <button
              id="ctrl-dpad-jump"
              onTouchStart={() => { virtualControlsRef.current.jump = true; }}
              onTouchEnd={() => { virtualControlsRef.current.jump = false; }}
              onMouseDown={() => { virtualControlsRef.current.jump = true; }}
              onMouseUp={() => { virtualControlsRef.current.jump = false; }}
              onMouseLeave={() => { virtualControlsRef.current.jump = false; }}
              className="w-20 h-12 bg-indigo-600 active:bg-indigo-500 hover:bg-indigo-580 border border-indigo-500 text-white font-semibold rounded-lg flex items-center justify-center gap-1 select-none cursor-pointer touch-none shadow-md shadow-indigo-600/10"
              style={{ minWidth: '44px', minHeight: '44px' }}
              title="Jump"
            >
              JUMP
            </button>
          </div>

          <div className="flex gap-2 text-xs font-mono text-slate-400 items-center justify-end">
            <span className="text-amber-400 font-bold">{Math.round(1000 / 60)}ms</span> latency
          </div>
        </div>
      </div>
    </div>
  );
};
