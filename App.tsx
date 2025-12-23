
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ElementType, 
  Tower, 
  Enemy, 
  Projectile, 
  GameState, 
  Position,
  StatusEffect
} from './types';
import { 
  CANVAS_WIDTH, 
  CANVAS_HEIGHT, 
  TILE_SIZE, 
  INITIAL_GOLD, 
  INITIAL_DIAMONDS,
  INITIAL_HEARTS, 
  MAX_TIER, 
  TOWER_STATS, 
  MOB_PATH 
} from './constants';
import { getBossFlavor } from './geminiService';

const PATH_WIDTH = 40;
const CLICK_THRESHOLD = 5; // Pixels to distinguish click from drag

interface Quest {
  id: string;
  title: string;
  reward: number;
  platform: 'facebook' | 'x' | 'youtube' | 'social';
}

const QUESTS: Quest[] = [
  { id: 'fb-like', title: 'Like Facebook page', reward: 50, platform: 'facebook' },
  { id: 'fb-comment', title: 'Comment on Facebook page', reward: 50, platform: 'facebook' },
  { id: 'fb-share', title: 'Share Facebook page', reward: 100, platform: 'facebook' },
  { id: 'x-like', title: 'Like X page', reward: 50, platform: 'x' },
  { id: 'x-comment', title: 'Comment on X page', reward: 50, platform: 'x' },
  { id: 'x-share', title: 'Share X page', reward: 100, platform: 'x' },
  { id: 'yt-like', title: 'Like YouTube channel', reward: 50, platform: 'youtube' },
  { id: 'yt-comment', title: 'Comment on YouTube channel', reward: 50, platform: 'youtube' },
  { id: 'yt-share', title: 'Share YouTube channel', reward: 100, platform: 'youtube' },
  { id: 'invite', title: 'Invite your friends', reward: 150, platform: 'social' },
];

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [totalGold, setTotalGold] = useState(INITIAL_GOLD);
  const [totalDiamonds, setTotalDiamonds] = useState(INITIAL_DIAMONDS);
  const [completedQuests, setCompletedQuests] = useState<string[]>([]);
  
  const [bgmVolume, setBgmVolume] = useState(0.5);
  const [sfxVolume, setSfxVolume] = useState(0.5);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isQuestsOpen, setIsQuestsOpen] = useState(false);
  const [mousePos, setMousePos] = useState<Position | null>(null);

  const [gameState, setGameState] = useState<GameState>({
    gold: INITIAL_GOLD,
    diamonds: INITIAL_DIAMONDS,
    hearts: INITIAL_HEARTS,
    wave: 0,
    isGameOver: false,
    isGameStarted: false,
    isPaused: false,
    selectedTowerId: null,
    draggingTowerId: null,
    dragPosition: null,
    dragStartPos: null,
    originalTowerPos: null,
    gameSpeed: 1
  });

  const [towers, setTowers] = useState<Tower[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [flavorText, setFlavorText] = useState<string>("Welcome, Commander. Build your defenses.");
  const [placingType, setPlacingType] = useState<ElementType | null>(null);
  const [scale, setScale] = useState(1);

  // Sync state gold and diamonds with persistent totals
  useEffect(() => {
    if (gameState.isGameStarted) {
       setTotalGold(gameState.gold);
       setTotalDiamonds(gameState.diamonds);
    }
  }, [gameState.gold, gameState.diamonds, gameState.isGameStarted]);

  const towersRef = useRef<Tower[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const gameStateRef = useRef<GameState>(gameState);
  const mousePosRef = useRef<Position | null>(null);
  const placingTypeRef = useRef<ElementType | null>(null);

  useEffect(() => { towersRef.current = towers; }, [towers]);
  useEffect(() => { enemiesRef.current = enemies; }, [enemies]);
  useEffect(() => { projectilesRef.current = projectiles; }, [projectiles]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { mousePosRef.current = mousePos; }, [mousePos]);
  useEffect(() => { placingTypeRef.current = placingType; }, [placingType]);

  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      const padding = 20;
      const maxWidth = clientWidth - padding;
      const maxHeight = clientHeight - padding;
      const scaleX = maxWidth / CANVAS_WIDTH;
      const scaleY = maxHeight / CANVAS_HEIGHT;
      const newScale = Math.min(scaleX, scaleY, 1);
      setScale(newScale);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [gameState.isGameStarted]);

  useEffect(() => {
    if (!gameState.isGameStarted || gameState.isGameOver) return;
    let requestRef: number;
    let lastTime = performance.now();
    const loop = (time: number) => {
      const dt = time - lastTime;
      lastTime = time;
      if (!gameStateRef.current.isPaused) {
        update(dt * gameStateRef.current.gameSpeed);
      }
      draw();
      requestRef = requestAnimationFrame(loop);
    };
    requestRef = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef);
  }, [gameState.isGameStarted, gameState.isGameOver]);

  const update = (dt: number) => {
    if (gameStateRef.current.isGameOver) return;

    const updatedEnemies = [...enemiesRef.current];
    for (let i = updatedEnemies.length - 1; i >= 0; i--) {
      const enemy = updatedEnemies[i];

      // Process Status Effects
      let currentSlow = 1;
      let isStunned = false;
      const nextEffects: StatusEffect[] = [];

      enemy.activeEffects.forEach(effect => {
        effect.duration -= dt;
        if (effect.duration > 0) {
          nextEffects.push(effect);
          if (effect.type === 'burn') {
            enemy.health -= (effect.value || 0.1) * (dt / 16);
          } else if (effect.type === 'slow') {
            currentSlow = Math.min(currentSlow, effect.value || 0.5);
          } else if (effect.type === 'stun') {
            isStunned = true;
          }
        }
      });
      enemy.activeEffects = nextEffects;

      if (enemy.health <= 0) {
        setGameState(prev => ({ ...prev, gold: prev.gold + enemy.reward }));
        updatedEnemies.splice(i, 1);
        continue;
      }

      if (isStunned) continue;

      const target = MOB_PATH[enemy.pathIndex + 1];
      if (!target) {
        updatedEnemies.splice(i, 1);
        setGameState(prev => ({
          ...prev,
          hearts: prev.hearts - 1,
          isGameOver: prev.hearts <= 1
        }));
        continue;
      }

      const dx = target.x - enemy.x;
      const dy = target.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const moveDist = enemy.speed * enemy.slowFactor * currentSlow * (dt / 16);
      
      if (dist < moveDist) {
        enemy.x = target.x; enemy.y = target.y; enemy.pathIndex++;
      } else {
        enemy.x += (dx / dist) * moveDist;
        enemy.y += (dy / dist) * moveDist;
      }
    }
    enemiesRef.current = updatedEnemies;
    setEnemies(updatedEnemies);

    const now = Date.now();
    const newProjectiles = [...projectilesRef.current];
    const updatedTowers = towersRef.current.map(tower => {
      const adjustedFireRate = tower.fireRate / gameStateRef.current.gameSpeed;
      if (now - tower.lastFired >= adjustedFireRate) {
        let nearest: Enemy | null = null;
        let minDist = tower.range;
        for (const enemy of updatedEnemies) {
          const dx = enemy.x - tower.x; const dy = enemy.y - tower.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDist) { minDist = dist; nearest = enemy; }
        }
        if (nearest) {
          newProjectiles.push({
            id: Math.random().toString(), x: tower.x, y: tower.y, targetId: nearest.id,
            damage: tower.damage, speed: tower.projectileSpeed, color: tower.color, type: tower.type
          });
          return { ...tower, lastFired: now };
        }
      }
      return tower;
    });
    setTowers(updatedTowers);

    for (let i = newProjectiles.length - 1; i >= 0; i--) {
      const proj = newProjectiles[i];
      const target = updatedEnemies.find(e => e.id === proj.targetId);
      if (!target) { newProjectiles.splice(i, 1); continue; }
      
      const dx = target.x - proj.x; const dy = target.y - proj.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const moveDist = proj.speed * (dt / 16);
      
      if (dist < moveDist) {
        const applyImpact = (enemy: Enemy, damage: number, type: ElementType) => {
          enemy.health -= damage;
          if (type === ElementType.FIRE) {
            enemy.activeEffects = [...enemy.activeEffects.filter(e => e.type !== 'burn'), { type: 'burn', duration: 2000, value: 0.5 }];
          } else if (type === ElementType.WATER) {
            enemy.activeEffects = [...enemy.activeEffects.filter(e => e.type !== 'slow'), { type: 'slow', duration: 3000, value: 0.4 }];
          } else if (type === ElementType.EARTH) {
            enemy.activeEffects = [...enemy.activeEffects, { type: 'stun', duration: 500 }];
          }
        };

        if (proj.type === ElementType.AIR) {
          const radius = (TOWER_STATS[ElementType.AIR] as any).splashRadius || 60;
          updatedEnemies.forEach(e => {
            const d = Math.sqrt((e.x - proj.x) ** 2 + (e.y - proj.y) ** 2);
            if (d <= radius) applyImpact(e, proj.damage, proj.type);
          });
        } else {
          applyImpact(target, proj.damage, proj.type);
        }

        if (target.health <= 0) {
          setGameState(prev => ({ ...prev, gold: prev.gold + target.reward }));
          const idx = updatedEnemies.findIndex(e => e.id === target.id);
          if (idx !== -1) updatedEnemies.splice(idx, 1);
        }
        newProjectiles.splice(i, 1);
      } else {
        proj.x += (dx / dist) * moveDist;
        proj.y += (dy / dist) * moveDist;
      }
    }
    projectilesRef.current = newProjectiles;
    setProjectiles(newProjectiles);

    if (updatedEnemies.length === 0 && gameStateRef.current.isGameStarted) {
      startNextWave();
    }
  };

  const startNextWave = useCallback(async () => {
    const prevWave = gameStateRef.current.wave;
    if (prevWave > 0) {
      const diamondReward = prevWave; 
      setGameState(prev => ({ ...prev, diamonds: prev.diamonds + diamondReward }));
    }

    const nextWave = prevWave + 1;
    setGameState(prev => ({ ...prev, wave: nextWave }));
    const isBossWave = nextWave % 5 === 0;
    if (isBossWave) {
      const flavor = await getBossFlavor(nextWave);
      setFlavorText(flavor);
    }
    const enemyCount = 5 + nextWave * 2;
    const baseHealth = 20 + nextWave * 10;
    const newEnemies: Enemy[] = [];
    for (let i = 0; i < enemyCount; i++) {
      const isBoss = isBossWave && i === enemyCount - 1;
      newEnemies.push({
        id: `enemy-${nextWave}-${i}`, x: MOB_PATH[0].x - (i * 40), y: MOB_PATH[0].y,
        health: isBoss ? baseHealth * 8 : baseHealth, maxHealth: isBoss ? baseHealth * 8 : baseHealth,
        speed: (isBoss ? 0.4 : 0.6 + (nextWave * 0.02)), reward: isBoss ? 100 : 15,
        pathIndex: 0, isBoss, slowFactor: 1, activeEffects: []
      });
    }
    setEnemies(newEnemies);
  }, []);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1;
    for (let x = 0; x <= CANVAS_WIDTH; x += TILE_SIZE) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_HEIGHT); ctx.stroke(); }
    for (let y = 0; y <= CANVAS_HEIGHT; y += TILE_SIZE) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_WIDTH, y); ctx.stroke(); }
    
    ctx.strokeStyle = '#334155'; ctx.lineWidth = 30; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(MOB_PATH[0].x, MOB_PATH[0].y);
    for (let i = 1; i < MOB_PATH.length; i++) ctx.lineTo(MOB_PATH[i].x, MOB_PATH[i].y);
    ctx.stroke();

    towersRef.current.forEach(tower => {
      const isBeingDragged = gameStateRef.current.draggingTowerId === tower.id;
      const isSelected = gameStateRef.current.selectedTowerId === tower.id;
      
      if (isSelected || isBeingDragged) {
        ctx.beginPath(); ctx.arc(tower.x, tower.y, tower.range, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'; ctx.fill(); ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; ctx.stroke();
      }

      ctx.save();
      if (isBeingDragged) ctx.globalAlpha = 0.6;
      ctx.fillStyle = tower.color; ctx.shadowBlur = 15; ctx.shadowColor = tower.color;
      ctx.beginPath(); ctx.roundRect(tower.x - 20, tower.y - 20, 40, 40, 5); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = 'white'; ctx.font = 'bold 14px Inter'; ctx.textAlign = 'center'; ctx.fillText(`T${tower.tier}`, tower.x, tower.y + 5);
      ctx.restore();
    });

    if (placingTypeRef.current && mousePosRef.current) {
      const { x, y } = mousePosRef.current;
      const invalid = isPositionOnPath(x, y) || gameStateRef.current.gold < TOWER_STATS[placingTypeRef.current].cost;
      const stats = TOWER_STATS[placingTypeRef.current];
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.arc(x, y, stats.baseRange, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'; ctx.fill();
      ctx.strokeStyle = invalid ? 'rgba(239, 68, 68, 0.5)' : 'rgba(34, 197, 94, 0.5)';
      ctx.setLineDash([5, 5]); ctx.stroke();
      ctx.shadowBlur = 15; ctx.shadowColor = invalid ? '#ef4444' : '#22c55e';
      ctx.fillStyle = stats.color;
      ctx.beginPath(); ctx.roundRect(x - 20, y - 20, 40, 40, 5); ctx.fill();
      ctx.restore();
    }

    enemiesRef.current.forEach(enemy => {
      ctx.save();
      if (enemy.activeEffects.some(e => e.type === 'burn')) {
        ctx.shadowBlur = 10; ctx.shadowColor = '#f97316';
      } else if (enemy.activeEffects.some(e => e.type === 'slow')) {
        ctx.shadowBlur = 10; ctx.shadowColor = '#3b82f6';
      } else if (enemy.activeEffects.some(e => e.type === 'stun')) {
        ctx.shadowBlur = 10; ctx.shadowColor = '#cbd5e1';
      }

      if (enemy.isBoss) {
        ctx.fillStyle = '#f59e0b';
        const bossSize = 40;
        ctx.beginPath(); ctx.arc(enemy.x, enemy.y, bossSize, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'white'; ctx.font = '24px Inter'; ctx.textAlign = 'center';
        ctx.fillText('👑', enemy.x, enemy.y + 8);
      } else {
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath(); ctx.arc(enemy.x, enemy.y, 12, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();

      const size = enemy.isBoss ? 40 : 12;
      const barWidth = size * 2;
      ctx.fillStyle = '#ef4444'; ctx.fillRect(enemy.x - size, enemy.y - size - 15, barWidth, 6);
      ctx.fillStyle = '#22c55e'; ctx.fillRect(enemy.x - size, enemy.y - size - 15, barWidth * (enemy.health / enemy.maxHealth), 6);
    });

    projectilesRef.current.forEach(proj => {
      ctx.fillStyle = proj.color; ctx.beginPath(); ctx.arc(proj.x, proj.y, 4, 0, Math.PI * 2); ctx.fill();
    });
  };

  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent): Position => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX; clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX; clientY = (e as React.MouseEvent).clientY;
    }
    return {
      x: (clientX - rect.left) / scale,
      y: (clientY - rect.top) / scale
    };
  };

  const isPositionOnPath = (x: number, y: number): boolean => {
    for (let i = 0; i < MOB_PATH.length - 1; i++) {
      const p1 = MOB_PATH[i];
      const p2 = MOB_PATH[i + 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const lengthSquared = dx * dx + dy * dy;
      let t = ((x - p1.x) * dx + (y - p1.y) * dy) / lengthSquared;
      t = Math.max(0, Math.min(1, t));
      const projX = p1.x + t * dx;
      const projY = p1.y + t * dy;
      const dist = Math.sqrt((x - projX) ** 2 + (y - projY) ** 2);
      if (dist < PATH_WIDTH / 2 + 15) return true;
    }
    return false;
  };

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (gameState.isPaused) return;
    const coords = getCanvasCoords(e);
    
    if (placingType) {
      if (isPositionOnPath(coords.x, coords.y)) {
        setFlavorText("Invalid position: Path blocked!");
        return;
      }
      const stats = TOWER_STATS[placingType];
      if (gameState.gold >= stats.cost) {
        setTowers(prev => [...prev, {
          id: Math.random().toString(), type: placingType!, tier: 1, x: coords.x, y: coords.y, lastFired: 0,
          range: stats.baseRange, damage: stats.baseDamage, fireRate: stats.baseFireRate,
          cost: stats.cost, projectileSpeed: stats.projectileSpeed, color: stats.color
        }]);
        setGameState(prev => ({ ...prev, gold: prev.gold - stats.cost, selectedTowerId: null }));
        setPlacingType(null);
      } else {
        setFlavorText("Not enough gold!");
      }
      return;
    }

    const clickedTower = towersRef.current.find(t => Math.sqrt((t.x - coords.x) ** 2 + (t.y - coords.y) ** 2) < 25);
    if (clickedTower) {
      setGameState(prev => ({ 
        ...prev, 
        draggingTowerId: clickedTower.id, 
        dragPosition: coords,
        dragStartPos: coords,
        originalTowerPos: { x: clickedTower.x, y: clickedTower.y }
      }));
    } else {
      setGameState(prev => ({ ...prev, selectedTowerId: null }));
    }
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    const coords = getCanvasCoords(e);
    setMousePos(coords);
    if (!gameState.draggingTowerId || gameState.isPaused) return;

    // Distinguish click vs drag
    const dist = Math.sqrt((coords.x - (gameState.dragStartPos?.x || 0)) ** 2 + (coords.y - (gameState.dragStartPos?.y || 0)) ** 2);
    
    if (dist > CLICK_THRESHOLD) {
      setGameState(prev => ({ ...prev, dragPosition: coords }));
      // Update tower position visually during drag
      setTowers(prev => prev.map(t => t.id === gameState.draggingTowerId ? { ...t, x: coords.x, y: coords.y } : t));
    }
  };

  const handleMouseUp = (e: React.MouseEvent | React.TouchEvent) => {
    if (!gameState.draggingTowerId) return;

    const coords = getCanvasCoords(e);
    const distMoved = Math.sqrt((coords.x - (gameState.dragStartPos?.x || 0)) ** 2 + (coords.y - (gameState.dragStartPos?.y || 0)) ** 2);
    
    if (distMoved < CLICK_THRESHOLD) {
      // It's a click: toggle selection
      const towerId = gameState.draggingTowerId;
      setGameState(prev => ({ 
        ...prev, 
        selectedTowerId: prev.selectedTowerId === towerId ? null : towerId,
        draggingTowerId: null,
        dragPosition: null,
        dragStartPos: null,
        originalTowerPos: null
      }));
      // Ensure tower is at its original position
      return;
    }

    // It's a drag: check for fusion or move
    const dragSourceId = gameState.draggingTowerId;
    const dragSource = towersRef.current.find(t => t.id === dragSourceId);
    const originalPos = gameState.originalTowerPos!;

    const dropTarget = towersRef.current.find(t => 
      t.id !== dragSourceId && Math.sqrt((t.x - coords.x) ** 2 + (t.y - coords.y) ** 2) < 30
    );

    let success = false;
    if (dragSource && dropTarget && dragSource.type === dropTarget.type && dragSource.tier === dropTarget.tier && dragSource.tier < MAX_TIER) {
      const upgradeCost = Math.floor(TOWER_STATS[dragSource.type].cost * 0.8 * dragSource.tier);
      if (gameState.gold >= upgradeCost) {
        const newTier = dragSource.tier + 1;
        const stats = TOWER_STATS[dropTarget.type];
        const upgradedTower: Tower = {
          ...dropTarget, 
          tier: newTier,
          damage: stats.baseDamage * (1.8 ** (newTier - 1)),
          range: stats.baseRange + (20 * (newTier - 1)),
          fireRate: stats.baseFireRate * (0.9 ** (newTier - 1)),
        };
        setTowers(prev => prev.filter(t => t.id !== dragSourceId && t.id !== dropTarget.id).concat(upgradedTower));
        setGameState(prev => ({ 
          ...prev, 
          gold: prev.gold - upgradeCost, 
          draggingTowerId: null, 
          dragPosition: null,
          dragStartPos: null,
          originalTowerPos: null,
          selectedTowerId: upgradedTower.id 
        }));
        setFlavorText(`FUSION SUCCESS: Tier ${newTier} ${dropTarget.type} Tower online.`);
        success = true;
      } else {
        setFlavorText("Treasury empty! Cannot fuse.");
      }
    } else if (dragSource && !dropTarget && !isPositionOnPath(coords.x, coords.y)) {
      // Moving tower to a new valid empty spot
      setTowers(prev => prev.map(t => t.id === dragSourceId ? { ...t, x: coords.x, y: coords.y } : t));
      setGameState(prev => ({ ...prev, draggingTowerId: null, dragPosition: null, dragStartPos: null, originalTowerPos: null }));
      success = true;
    }

    if (!success) {
      // Revert to original location if fusion failed or dropped in invalid area
      setTowers(prev => prev.map(t => t.id === dragSourceId ? { ...t, x: originalPos.x, y: originalPos.y } : t));
      setGameState(prev => ({ 
        ...prev, 
        draggingTowerId: null, 
        dragPosition: null, 
        dragStartPos: null, 
        originalTowerPos: null 
      }));
    }
  };

  const handleStartGame = () => {
    setGameState(prev => ({ 
      ...prev, isGameStarted: true, isGameOver: false, wave: 0, hearts: INITIAL_HEARTS, gold: totalGold, diamonds: totalDiamonds, selectedTowerId: null, draggingTowerId: null, gameSpeed: 1 
    }));
    setTowers([]); setEnemies([]); setProjectiles([]);
    startNextWave();
  };

  const togglePause = () => setGameState(prev => ({ ...prev, isPaused: !prev.isPaused }));
  const handleAbandon = () => setGameState(prev => ({ ...prev, isGameStarted: false, isPaused: false, gameSpeed: 1 }));
  const cycleGameSpeed = () => {
    setGameState(prev => ({
      ...prev,
      gameSpeed: prev.gameSpeed === 1 ? 2 : prev.gameSpeed === 2 ? 4 : 1
    }));
  };

  const handlePlacingToggle = (type: ElementType) => {
    if (placingType === type) {
      setPlacingType(null);
    } else {
      setPlacingType(type);
    }
  };

  const claimQuest = (quest: Quest) => {
    if (completedQuests.includes(quest.id)) return;
    setCompletedQuests(prev => [...prev, quest.id]);
    setTotalDiamonds(prev => prev + quest.reward);
    setGameState(prev => ({ ...prev, diamonds: prev.diamonds + quest.reward }));
  };

  const selectedTower = towers.find(t => t.id === gameState.selectedTowerId);

  return (
    <div 
      className="flex flex-col md:flex-row h-[100dvh] bg-slate-950 text-slate-100 overflow-hidden select-none relative"
      onMouseMove={handleMouseMove}
      onTouchMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchEnd={handleMouseUp}
    >
      <div className="w-full z-10 p-2 md:p-4 shrink-0">
        <div className="max-w-4xl mx-auto flex justify-between items-center bg-slate-900/80 backdrop-blur-md px-4 md:px-8 py-2 md:py-3 rounded-full border border-slate-700 shadow-xl">
          <div className="flex items-center gap-3 md:gap-6">
            <div className="flex items-center gap-1 md:gap-2">
              <span className="text-yellow-400 text-lg md:text-xl">💰</span>
              <span className="text-base md:text-xl font-bold font-cinzel">{gameState.gold}</span>
            </div>
            <div className="flex items-center gap-1 md:gap-2">
              <span className="text-cyan-400 text-lg md:text-xl">💎</span>
              <span className="text-base md:text-xl font-bold font-cinzel">{gameState.diamonds}</span>
            </div>
            <div className="flex items-center gap-1 md:gap-2">
              <span className="text-red-500 text-lg md:text-xl">❤️</span>
              <span className="text-base md:text-xl font-bold font-cinzel">{gameState.hearts}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {gameState.isGameStarted ? (
              <>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] md:text-xs text-slate-400 uppercase tracking-tighter font-bold">Wave</span>
                  <span className="text-sm md:text-xl font-bold font-cinzel text-cyan-400 leading-none">{gameState.wave}</span>
                </div>
                <div className="flex gap-1 md:gap-2">
                  <button 
                    onClick={cycleGameSpeed} 
                    className="w-10 h-10 md:w-12 md:h-10 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-600 transition-colors text-[10px] md:text-xs font-bold text-cyan-400"
                  >
                    {gameState.gameSpeed}x
                  </button>
                  <button onClick={togglePause} className="w-10 h-10 md:w-12 md:h-10 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-600 transition-colors">
                    {gameState.isPaused ? "▶️" : "⏸️"}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-1 items-end">
                <button 
                  onClick={() => setIsSettingsOpen(true)}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-full border border-slate-600 transition-colors flex items-center gap-2 text-[10px] md:text-xs font-bold"
                >
                  ⚙️ SETTINGS
                </button>
                <button 
                  onClick={() => setIsQuestsOpen(true)}
                  className="px-4 py-1.5 bg-cyan-900/40 hover:bg-cyan-800/60 rounded-full border border-cyan-700/50 transition-colors flex items-center gap-2 text-[10px] md:text-xs font-bold text-cyan-200"
                >
                  📜 QUESTS
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 relative flex flex-col items-center justify-center overflow-hidden py-4">
        {!gameState.isGameStarted ? (
          <div className="flex flex-col items-center h-full w-full max-w-2xl px-6 justify-between animate-in fade-in zoom-in duration-700">
            {/* Header / Title Area */}
            <div className="flex flex-col items-center gap-4 text-center mt-4">
              <h1 className="text-4xl md:text-6xl font-cinzel font-bold text-transparent bg-clip-text bg-gradient-to-b from-cyan-400 to-blue-700 drop-shadow-lg uppercase tracking-widest mb-2">
                Elemental Siege
              </h1>
              <div className="flex gap-3 md:gap-6">
                <div className="bg-slate-900/50 px-4 py-2 rounded-xl border border-slate-800 shadow-inner">
                  <p className="text-yellow-400 font-cinzel text-sm md:text-lg">💰 ${totalGold}</p>
                </div>
                <div className="bg-slate-900/50 px-4 py-2 rounded-xl border border-slate-800 shadow-inner">
                  <p className="text-cyan-400 font-cinzel text-sm md:text-lg">💎 {totalDiamonds}</p>
                </div>
              </div>
              <p className="text-slate-400 max-w-sm text-xs md:text-sm italic opacity-80">
                "Deploy elemental forces. Combine to ascend. Defend the realm."
              </p>
            </div>
            
            {/* Primary Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xs sm:max-w-none justify-center">
              <button onClick={handleStartGame} className="px-10 py-4 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-lg md:text-xl font-bold transition-all shadow-xl shadow-cyan-900/40 active:scale-95 border-b-4 border-cyan-800">
                ENTER BATTLE
              </button>
              <button onClick={() => window.location.reload()} className="px-10 py-4 bg-slate-800 hover:bg-slate-700 rounded-xl text-lg md:text-xl font-bold transition-all active:scale-95 border-b-4 border-slate-900">
                QUIT GAME
              </button>
            </div>
            
            {/* Social Media Buttons Footer */}
            <div className="flex justify-center gap-6 pb-8">
              <button 
                className="w-12 h-12 rounded-full bg-[#1877F2] hover:scale-110 active:scale-90 transition-all shadow-lg shadow-blue-900/40 flex items-center justify-center text-white text-xl font-bold ring-2 ring-white/10"
                title="Facebook"
              >
                f
              </button>
              <button 
                className="w-12 h-12 rounded-full bg-black hover:scale-110 active:scale-90 transition-all shadow-lg shadow-black/60 flex items-center justify-center text-white text-2xl ring-2 ring-white/20"
                title="X (Twitter)"
              >
                𝕏
              </button>
              <button 
                className="w-12 h-12 rounded-full bg-[#FF0000] hover:scale-110 active:scale-90 transition-all shadow-lg shadow-red-900/40 flex items-center justify-center text-white text-xl ring-2 ring-white/10"
                title="YouTube"
              >
                ▶
              </button>
            </div>
          </div>
        ) : (
          <div className="relative border-2 md:border-4 border-slate-800 rounded-lg md:rounded-xl overflow-hidden shadow-2xl bg-slate-900"
            style={{ width: CANVAS_WIDTH * scale, height: CANVAS_HEIGHT * scale }}>
            <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} onMouseDown={handleMouseDown} onTouchStart={handleMouseDown}
              style={{ transform: `scale(${scale})`, transformOrigin: 'top left', filter: gameState.isPaused ? 'blur(4px)' : 'none' }}
              className="absolute top-0 left-0 bg-slate-900 cursor-crosshair transition-[filter] duration-300"
            />
            {gameState.isPaused && !gameState.isGameOver && (
              <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md flex flex-col items-center justify-center p-6 z-50">
                <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl shadow-2xl max-w-xs w-full flex flex-col gap-6">
                  <h2 className="text-2xl font-cinzel font-bold text-center text-cyan-400">COMMAND PAUSED</h2>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-bold text-slate-400 uppercase"><span>Music Volume</span><span>{Math.round(bgmVolume * 100)}%</span></div>
                      <input type="range" min="0" max="1" step="0.1" value={bgmVolume} onChange={(e) => setBgmVolume(parseFloat(e.target.value))} className="w-full accent-cyan-500" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button onClick={togglePause} className="w-full py-3 bg-cyan-600 rounded font-bold">RESUME</button>
                    <button onClick={handleAbandon} className="w-full py-3 bg-slate-800 rounded font-bold text-slate-300">ABANDON MISSION</button>
                  </div>
                </div>
              </div>
            )}
            {gameState.isGameOver && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-8 backdrop-blur-sm z-50 text-center">
                <h2 className="text-3xl md:text-5xl font-cinzel font-bold text-red-500 mb-2 uppercase">Sanctuary Fallen</h2>
                <p className="text-base md:text-xl text-slate-300 mb-8">Wave {gameState.wave} was your limit.</p>
                <div className="flex gap-4">
                  <button onClick={handleStartGame} className="px-8 py-3 bg-red-600 rounded-md font-bold text-lg">REDEPLOY</button>
                  <button onClick={handleAbandon} className="px-8 py-3 bg-slate-700 rounded-md font-bold text-lg">MENU</button>
                </div>
              </div>
            )}
          </div>
        )}

        {isSettingsOpen && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl flex flex-col items-center justify-center p-6 z-[100] animate-in fade-in">
            <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl shadow-2xl max-md w-full flex flex-col gap-6">
              <h2 className="text-3xl font-cinzel font-bold text-center text-cyan-400">COMMAND SETTINGS</h2>
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-bold text-slate-400 uppercase"><span>Master Music</span><span>{Math.round(bgmVolume * 100)}%</span></div>
                  <input type="range" min="0" max="1" step="0.1" value={bgmVolume} onChange={(e) => setBgmVolume(parseFloat(e.target.value))} className="w-full accent-cyan-500 h-2 rounded-lg bg-slate-800 appearance-none cursor-pointer" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-bold text-slate-400 uppercase"><span>Sound Effects</span><span>{Math.round(sfxVolume * 100)}%</span></div>
                  <input type="range" min="0" max="1" step="0.1" value={sfxVolume} onChange={(e) => setSfxVolume(parseFloat(e.target.value))} className="w-full accent-cyan-500 h-2 rounded-lg bg-slate-800 appearance-none cursor-pointer" />
                </div>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 rounded-xl font-bold transition-all text-xl mt-4">
                SAVE & RETURN
              </button>
            </div>
          </div>
        )}

        {isQuestsOpen && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl flex flex-col items-center justify-center p-6 z-[100] animate-in fade-in">
            <div className="bg-slate-900 border border-slate-700 p-6 md:p-8 rounded-2xl shadow-2xl max-w-lg w-full flex flex-col gap-6 h-[80vh]">
              <div className="flex justify-between items-center border-b border-slate-700 pb-4">
                <h2 className="text-3xl font-cinzel font-bold text-cyan-400">QUEST LOG</h2>
                <div className="flex items-center gap-2 px-3 py-1 bg-slate-800 rounded-full border border-slate-700">
                  <span className="text-cyan-400 text-sm">💎</span>
                  <span className="text-sm font-bold">{totalDiamonds}</span>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                {QUESTS.map(quest => {
                  const isCompleted = completedQuests.includes(quest.id);
                  return (
                    <div key={quest.id} className={`p-4 rounded-xl border flex items-center justify-between transition-all ${isCompleted ? 'bg-emerald-900/10 border-emerald-900/50' : 'bg-slate-800/50 border-slate-700 hover:border-cyan-700/50'}`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${isCompleted ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                          {isCompleted ? '✓' : '!'}
                        </div>
                        <div>
                          <p className={`font-bold text-sm ${isCompleted ? 'text-slate-500' : 'text-slate-100'}`}>{quest.title}</p>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-cyan-400">💎</span>
                            <span className="text-[10px] font-bold text-cyan-400">{quest.reward} Rewards</span>
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => claimQuest(quest)}
                        disabled={isCompleted}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${isCompleted ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/20 active:scale-95'}`}
                      >
                        {isCompleted ? 'CLAIMED' : 'CLAIM'}
                      </button>
                    </div>
                  );
                })}
              </div>
              
              <button onClick={() => setIsQuestsOpen(false)} className="w-full py-4 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold transition-all text-lg border border-slate-700">
                CLOSE LOG
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={`w-full md:w-80 bg-slate-900 border-t md:border-t-0 md:border-l border-slate-800 p-4 md:p-6 flex flex-col md:gap-8 shadow-2xl overflow-y-auto shrink-0 max-h-[40vh] md:max-h-none ${gameState.isPaused ? 'opacity-50 pointer-events-none' : ''}`}>
        <h3 className="hidden md:block font-cinzel text-xl font-bold border-b border-slate-700 pb-2">COMMAND CENTER</h3>
        <div className="flex flex-col gap-2 md:gap-4">
          <p className="text-[10px] md:text-sm text-slate-500 font-bold uppercase tracking-wider">Deployment</p>
          <div className="grid grid-cols-4 md:grid-cols-2 gap-2">
            {Object.entries(TOWER_STATS).map(([type, stats]) => (
              <button key={type} onClick={() => handlePlacingToggle(type as ElementType)} disabled={gameState.gold < (stats as any).cost}
                className={`p-2 md:p-3 rounded-lg border flex flex-col items-center gap-1 transition-all
                  ${placingType === type ? 'border-white bg-white/10 ring-2 ring-cyan-500 scale-105' : 'border-slate-700 bg-slate-800'}
                  ${gameState.gold < (stats as any).cost ? 'opacity-30 grayscale cursor-not-allowed' : 'active:scale-95'}`}>
                <div className="w-4 h-4 md:w-8 md:h-8 rounded" style={{ backgroundColor: (stats as any).color }} />
                <span className="text-[10px] md:text-xs font-bold truncate w-full text-center">{type}</span>
                <span className="text-[10px] md:text-xs text-yellow-400 font-mono">${(stats as any).cost}</span>
              </button>
            ))}
          </div>
        </div>
        {selectedTower && (
          <div className="mt-2 md:mt-0 md:flex-1 bg-slate-950/50 rounded-lg p-3 border border-slate-800/50">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: selectedTower.color }} />
                <h4 className="font-bold text-xs md:text-base">{selectedTower.type} T{selectedTower.tier}</h4>
              </div>
              <button onClick={() => setGameState(prev => ({ ...prev, selectedTowerId: null }))} className="text-slate-500 hover:text-white">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-1 text-[10px] md:text-sm">
              <span className="text-slate-500">Dmg: {Math.round(selectedTower.damage)}</span>
              <span className="text-right text-emerald-400">Rng: {selectedTower.range}</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 italic">{(TOWER_STATS[selectedTower.type] as any).description}</p>
            {selectedTower.tier < MAX_TIER && (
              <div className="mt-2 pt-2 border-t border-slate-800 text-[9px] md:text-xs text-slate-400">
                <p className="italic">Drag to identical tower to fuse.</p>
                <p className="text-yellow-400 mt-1 font-bold">Fusion: ${Math.floor(TOWER_STATS[selectedTower.type].cost * 0.8 * selectedTower.tier)}</p>
              </div>
            )}
          </div>
        )}
        <div className="hidden md:flex pt-4 flex-col gap-2">
           <p className="text-[10px] text-slate-500 uppercase tracking-tighter mb-2 font-bold px-1">Tactical Log:</p>
           <p className="text-xs text-cyan-400/80 italic px-1 line-clamp-3 h-12 overflow-hidden">{flavorText}</p>
        </div>
      </div>
    </div>
  );
};

export default App;
