import { useState, useEffect, useRef } from 'react';
import { GameStatus } from './types';
import { LEVELS } from './levels';
import { sound } from './audio';
import { DungeonCanvas } from './components/DungeonCanvas';
import { 
  Flame, 
  Volume2, 
  VolumeX, 
  Clock, 
  RotateCcw, 
  Trophy, 
  BookOpen, 
  Target, 
  Skull, 
  Play, 
  CheckCircle, 
  HelpCircle,
  Gem,
  Award,
  Power,
  Key
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  // Game States
  const [levelIndex, setLevelIndex] = useState<number>(0);
  const [gameStatus, setGameStatus] = useState<GameStatus>('menu');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  
  const level = LEVELS[levelIndex];
  
  // Game Metrics
  const [totalCoins, setTotalCoins] = useState<number>(0);
  const [keysCount, setKeysCount] = useState<number>(0);
  const [deathsCount, setDeathsCount] = useState<number>(0);
  const [cumulativeDeaths, setCumulativeDeaths] = useState<number>(0);
  
  // Scoring
  const [score, setScore] = useState<number>(0);

  // High score tracking (localStorage)
  const [highScore, setHighScore] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('dungeon_highscore');
      return stored ? parseInt(stored, 10) : 0;
    } catch {
      return 0;
    }
  });

  // Level Timers
  const [levelTimer, setLevelTimer] = useState<number>(0);
  const [cumulativeTimer, setCumulativeTimer] = useState<number>(0);

  // Top Alert notifications state
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const alertTimerRef = useRef<number | null>(null);

  // Start continuous cumulative timer of active game
  useEffect(() => {
    let interval: any = null;
    if (gameStatus === 'playing') {
      interval = setInterval(() => {
        setLevelTimer(prev => prev + 1);
        setCumulativeTimer(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [gameStatus]);

  // Handle Level loading/changing
  const handleLevelSelect = (idx: number) => {
    if (idx < 0 || idx >= LEVELS.length) return;
    setLevelIndex(idx);
    setLevelTimer(0);
    setKeysCount(0);
    setTotalCoins(0);
    setGameStatus('playing');
    triggerAlert(`Entering: ${LEVELS[idx].name}`);
  };

  const handleStartGame = () => {
    setLevelIndex(0);
    setLevelTimer(0);
    setCumulativeTimer(0);
    setCumulativeDeaths(0);
    setDeathsCount(0);
    setKeysCount(0);
    setTotalCoins(0);
    setScore(0);
    setGameStatus('playing');
    sound.playJump(); // startup noise
    triggerAlert("Entering Chamber 1: Crypt of Ruins");
  };

  const handleRestartLevel = () => {
    // Reset key count and coin count
    setKeysCount(0);
    setDeathsCount(0);
    setLevelTimer(0);
    setGameStatus('playing');
    triggerAlert("Chamber Restarted. Good luck!");
  };

  const toggleMute = () => {
    const nextVal = !isMuted;
    setIsMuted(nextVal);
    sound.setMute(nextVal);
  };

  const triggerAlert = (msg: string) => {
    setAlertMsg(msg);
    if (alertTimerRef.current) {
      window.clearTimeout(alertTimerRef.current);
    }
    alertTimerRef.current = window.setTimeout(() => {
      setAlertMsg(null);
    }, 3200);
  };

  // Event handlers from inside canvas coordinates
  const handleCoinCollected = (count: number) => {
    setTotalCoins(count);
    // Add 100 points per coin
    const extraScore = 150;
    setScore(prev => {
      const nextScore = prev + extraScore;
      if (nextScore > highScore) {
        setHighScore(nextScore);
        try {
          localStorage.setItem('dungeon_highscore', nextScore.toString());
        } catch {}
      }
      return nextScore;
    });
  };

  const handleKeyCollected = (count: number) => {
    setKeysCount(count);
    if (count > 0) {
      triggerAlert("Golden key obtained! Slide open the lock gates.");
    }
  };

  const handleDoorUnlocked = () => {
    triggerAlert("Locked door opened! Path cleared.");
    setScore(prev => prev + 250); 
  };

  const handleCheckpoint = (msg: string) => {
    triggerAlert(msg);
  };

  const handleDeath = () => {
    setDeathsCount(prev => prev + 1);
    setCumulativeDeaths(prev => prev + 1);
    // Deduct 50 points penalty, limit to 0
    setScore(prev => Math.max(0, prev - 50));
  };

  const handlePauseToggle = () => {
    if (gameStatus === 'playing') {
      setGameStatus('paused');
    } else if (gameStatus === 'paused') {
      setGameStatus('playing');
    }
  };

  const handleLevelComplete = () => {
    // Score completion bonus based on speed
    const speedBonus = Math.max(50, 1000 - levelTimer * 5);
    setScore(prev => prev + 500 + speedBonus);

    const nextIdx = levelIndex + 1;
    if (nextIdx < LEVELS.length) {
      // Transition back to level complete selection screen briefly or auto-advance
      setGameStatus('level_complete');
    } else {
      // Finished all levels! Victory!
      setGameStatus('victory');
    }
  };

  const handleNextLevelTransition = () => {
    const nextIdx = levelIndex + 1;
    setLevelIndex(nextIdx);
    setLevelTimer(0);
    setKeysCount(0);
    setDeathsCount(0);
    setGameStatus('playing');
  };

  // Human Time formater
  const formatTime = (totalSeconds: number): string => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans p-6 flex flex-col space-y-4 select-none" style={{ backgroundColor: '#020617' }}>
      
      {/* Sleek Interface Premium Header Bar */}
      <header id="app-header" className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-900/50 border border-slate-850 rounded-2xl px-6 py-4 backdrop-blur-md">
        <div className="flex items-center flex-wrap gap-8 w-full md:w-auto">
          
          {/* Vitality Status bar */}
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Vitality Status</span>
            <div className="flex items-center space-x-2 mt-1">
              <div className="w-32 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full transition-all duration-500" 
                  style={{ width: `${Math.max(20, 100 - deathsCount * 20)}%` }}
                ></div>
              </div>
              <span className="text-[10px] font-mono text-emerald-400">
                {Math.max(20, 100 - deathsCount * 20)}%
              </span>
            </div>
          </div>
          
          <div className="hidden sm:block h-8 w-px bg-slate-800"></div>

          {/* Score currency */}
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Currency</span>
            <span className="text-lg font-bold text-amber-400">
              {score.toLocaleString()} <span className="text-[10px] font-normal opacity-50">CR</span>
            </span>
          </div>

          <div className="hidden sm:block h-8 w-px bg-slate-800"></div>

          {/* Record High score */}
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Best Instance</span>
            <span className="text-xs font-mono text-indigo-400 font-bold mt-1">
              {highScore} pts
            </span>
          </div>

        </div>

        {/* Level Name Column */}
        <div className="text-center">
          <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Zone Active</span>
          <h1 className="text-xl font-black tracking-tighter italic text-white uppercase">
            {gameStatus !== 'menu' && gameStatus !== 'victory' ? level.name : "System Menu"}
          </h1>
        </div>

        {/* Timer & controls settings wrapper */}
        <div className="flex items-center space-x-6">
          <div className="text-right">
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Instance Timer</span>
            <div className="text-lg font-mono text-slate-200">
              {formatTime(levelTimer)}
            </div>
          </div>
          
          {/* Audio toggle button with Sleek slot format */}
          <button
            onClick={toggleMute}
            id="header-sound-toggle"
            className="w-10 h-10 rounded-xl bg-slate-800/80 hover:bg-slate-750 flex items-center justify-center border border-slate-700 shadow-lg active:scale-95 transition cursor-pointer"
            title={isMuted ? 'Unmute SFX' : 'Mute SFX'}
          >
            {isMuted ? (
              <VolumeX className="w-5 h-5 text-red-400" />
            ) : (
              <Volume2 className="w-5 h-5 text-slate-400 hover:text-white" />
            )}
          </button>
        </div>
      </header>

      {/* Core layout split section */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4">
        
        {/* Global Event Alerts Display overlay */}
        <AnimatePresence>
          {alertMsg && (
            <motion.div 
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-slate-700 px-5 py-3 rounded-2xl shadow-2xl shadow-indigo-950/50 text-center max-w-sm w-[90%]"
            >
              <div className="text-xs font-semibold text-slate-300 tracking-tight flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{alertMsg}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Left Section (Interactive Stage Container) */}
        <section id="game-stage-section" className="flex-1 bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col relative">
          
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #475569 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>

          {gameStatus === 'menu' && (
            <div className="flex-grow flex flex-col items-center justify-center text-center p-6 md:p-12 z-10 space-y-6 relative h-full">
              
              {/* Flame Banner logo */}
              <div className="w-20 h-20 bg-gradient-to-tr from-indigo-600 to-rose-600 rounded-3xl flex items-center justify-center shadow-xl shadow-indigo-600/20 animate-pulse border border-indigo-400">
                <Flame className="w-12 h-12 text-amber-200" />
              </div>

              <div className="max-w-md">
                <h2 className="text-4xl font-black tracking-tight text-white font-sans">
                  DUNGEON PLATFORMER
                </h2>
                <p className="mt-3 text-slate-400 text-sm">
                  A high-octane modern platformer, using retro grid components. Harness the fluid jump mechanics, open security barriers, and escape active magma channels.
                </p>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleStartGame}
                  id="menu-start-btn"
                  className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-2xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transform active:scale-95 transition cursor-pointer text-sm"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Initiate Adventure</span>
                </button>
              </div>

              {/* Instructions Panel inside clean visual container */}
              <div className="bg-slate-950/80 p-4 border border-slate-800 rounded-2xl max-w-md w-full text-left space-y-2">
                <h4 className="text-xs font-mono font-bold text-indigo-400 tracking-wider uppercase flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-indigo-400" /> Operational Protocol
                </h4>
                <ul className="text-xs text-slate-400 space-y-1 pl-4 list-disc font-sans leading-relaxed">
                  <li>Use <span className="text-white font-mono bg-slate-850 px-1 rounded border border-slate-700">W</span>, <span className="text-white font-mono bg-slate-850 px-1 rounded border border-slate-700">Up</span>, or <span className="text-white font-mono bg-slate-850 px-1.5 rounded border border-slate-700">Space</span> to perform precise jumps.</li>
                  <li>Use <span className="text-white font-mono bg-slate-850 px-1 rounded border border-slate-700">A</span> / <span className="text-white font-mono bg-slate-850 px-1 rounded border border-slate-700">D</span> to move horizontally.</li>
                  <li>Retrieve keys of identical resonance to deactivate security gates.</li>
                  <li>Walk through <span className="text-green-400 font-medium">green waypoints</span> to backup spawn-coordinates.</li>
                </ul>
              </div>

            </div>
          )}

          {/* Playing / paused states canvas rendering frame */}
          {['playing', 'paused', 'level_complete'].includes(gameStatus) && (
            <div className="flex-grow flex flex-col relative h-full">
              <DungeonCanvas
                levelIndex={levelIndex}
                status={gameStatus === 'paused' ? 'paused' : gameStatus}
                isMuted={isMuted}
                onCoinCollected={handleCoinCollected}
                onKeyCollected={handleKeyCollected}
                onDoorUnlocked={handleDoorUnlocked}
                onCheckpointTriggered={handleCheckpoint}
                onDeath={handleDeath}
                onLevelComplete={handleLevelComplete}
                onPauseToggle={handlePauseToggle}
                timeElapsed={levelTimer}
              />

              {/* Pause modal panel overlay inside canvas */}
              {gameStatus === 'paused' && (
                <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col justify-center items-center z-20 p-6 text-center">
                  <h3 className="text-3xl font-extrabold tracking-tighter text-white uppercase italic">System Suspended</h3>
                  <p className="text-slate-400 text-xs max-w-xs mb-6">Re-aligning temporal frame coordinates. Standing by.</p>
                  
                  <div className="flex flex-col gap-2.5 w-full max-w-xs">
                    <button
                      onClick={handlePauseToggle}
                      id="pause-resume-btn"
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow cursor-pointer transition"
                    >
                      Resume Quest Sync
                    </button>
                    <button
                      onClick={handleRestartLevel}
                      id="pause-restart-btn"
                      className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-amber-500 text-xs font-semibold rounded-xl shadow-sm border border-slate-800 transition cursor-pointer"
                    >
                      Re-calibrate Chamber
                    </button>
                    <button
                      onClick={() => setGameStatus('menu')}
                      id="pause-quit-btn"
                      className="w-full py-2.5 bg-slate-950 hover:bg-slate-900 text-slate-500 hover:text-slate-300 text-xs font-medium rounded-xl border border-slate-850 transition cursor-pointer animate-pulse"
                    >
                      De-sync (Exit to Menu)
                    </button>
                  </div>
                </div>
              )}

              {/* Transition level modal panel overlay inside canvas */}
              {gameStatus === 'level_complete' && (
                <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl flex flex-col justify-center items-center z-25 p-6 text-center">
                  <div className="p-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500 rounded-full mb-3 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-black text-white tracking-tight uppercase">Segment Decoded</h3>
                  <p className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest mb-4">Instance Clear Reward applied</p>
                  
                  <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl max-w-xs w-full mb-6">
                    <div className="grid grid-cols-2 gap-4 text-left">
                      <div>
                        <div className="text-[9px] font-mono text-slate-500 uppercase">TIME CYCLE</div>
                        <div className="font-mono text-sm font-bold text-white">{formatTime(levelTimer)}</div>
                      </div>
                      <div>
                        <div className="text-[9px] font-mono text-slate-500 uppercase">SCORE CR</div>
                        <div className="font-mono text-sm font-bold text-amber-400">{score} CR</div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleNextLevelTransition}
                    id="level-complete-advance-btn"
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white rounded-xl cursor-pointer transform active:scale-95 transition flex items-center gap-2"
                  >
                    <span>Proceed to Next Chamber</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Victory Viewport Overlay Frame */}
          {gameStatus === 'victory' && (
            <div className="flex-grow flex flex-col items-center justify-center text-center p-6 md:p-12 z-10 space-y-6 relative h-full">
              
              <div className="w-16 h-16 bg-gradient-to-tr from-amber-500 to-yellow-400 rounded-full flex items-center justify-center shadow-2xl shadow-yellow-500/25 animate-bounce">
                <Trophy className="w-8 h-8 text-slate-950" />
              </div>

              <div>
                <h3 className="text-3xl font-black tracking-tight text-white uppercase italic">
                  Crypt Decoupled Successfully
                </h3>
                <p className="mt-2 text-slate-400 text-xs max-w-md mx-auto">
                  All security barriers bypassed. Your visual tracking systems indicate full daylight ahead. System index status: SECURED.
                </p>
              </div>

              {/* End Stats summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-2xl">
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-850">
                  <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 flex items-center justify-center gap-1">
                    <Award className="w-3.5 h-3.5 text-amber-500" /> Final Score
                  </div>
                  <div className="font-mono text-lg font-bold text-white mt-1">{score}</div>
                </div>

                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-850">
                  <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 flex items-center justify-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-sky-400" /> Total Time
                  </div>
                  <div className="font-mono text-lg font-bold text-white mt-1">{formatTime(cumulativeTimer)}</div>
                </div>

                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-850">
                  <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 flex items-center justify-center gap-1">
                    <Skull className="w-3.5 h-3.5 text-red-500" /> Total Deaths
                  </div>
                  <div className="font-mono text-lg font-bold text-white mt-1">{cumulativeDeaths}</div>
                </div>

                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-850">
                  <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 flex items-center justify-center gap-1">
                    <Trophy className="w-3.5 h-3.5 text-indigo-400" /> Title Rank
                  </div>
                  <div className="font-mono text-[9px] font-bold text-indigo-300 mt-1 uppercase">
                    {cumulativeDeaths === 0 ? 'Flawless' : cumulativeTimer < 95 ? 'Swift Agent' : 'Scout Delver'}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 max-w-xs w-full">
                <button
                  onClick={handleStartGame}
                  id="victory-replay-btn"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs shadow-md transition"
                >
                  Restart Adventure Index
                </button>
              </div>

            </div>
          )}

          <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_150px_rgba(0,0,0,0.95)]"></div>
        </section>

        {/* Right Section (Sleek Interface Sidebar) */}
        <aside id="dungeon-aside" className="w-full lg:w-72 flex flex-col space-y-4">
          
          {/* Custom Styled Sleek Loot Bag panel */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 flex-1 flex flex-col justify-between">
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-4">Loot Bag</h3>
              <div className="grid grid-cols-3 gap-2">
                
                {/* Slot 1: Keys */}
                <div className={`aspect-square rounded-xl border flex flex-col items-center justify-center transition-all ${keysCount > 0 ? 'bg-indigo-500/20 border-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.2)]' : 'bg-slate-800/60 border-slate-700'}`}>
                  {keysCount > 0 ? (
                    <>
                      <Key className="w-5 h-5 text-indigo-400 animate-pulse" />
                      <span className="text-[8px] font-mono text-indigo-300 font-bold mt-1">KEY x{keysCount}</span>
                    </>
                  ) : (
                    <div className="w-3 h-3 bg-slate-800/20 rounded-full border border-slate-750 border-dashed" />
                  )}
                </div>

                {/* Slot 2: Coins */}
                <div className={`aspect-square rounded-xl border flex flex-col items-center justify-center transition-all ${totalCoins > 0 ? 'bg-amber-500/20 border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.2)]' : 'bg-slate-800/60 border-slate-700'}`}>
                  {totalCoins > 0 ? (
                    <>
                      <Gem className="w-5 h-5 text-amber-500" />
                      <span className="text-[8px] font-mono text-amber-300 font-bold mt-1">{totalCoins} G</span>
                    </>
                  ) : (
                    <div className="w-3 h-3 bg-slate-800/20 rounded-full border border-slate-750 border-dashed" />
                  )}
                </div>

                {/* Slot 3: Current level state */}
                <div className="aspect-square bg-slate-850/30 rounded-xl border border-slate-800 flex flex-col items-center justify-center">
                  <span className="text-slate-600 font-bold text-xs">#{levelIndex + 1}</span>
                  <span className="text-[7px] text-slate-500 font-mono">SECT</span>
                </div>

                {/* Slot 4, 5, 6: Empty dashed placeholder blocks */}
                <div className="aspect-square bg-slate-800/20 rounded-xl border border-slate-700/50 border-dashed flex items-center justify-center"></div>
                <div className="aspect-square bg-slate-800/20 rounded-xl border border-slate-700/50 border-dashed flex items-center justify-center"></div>
                <div className="aspect-square bg-slate-800/20 rounded-xl border border-slate-700/50 border-dashed flex items-center justify-center"></div>

              </div>
            </div>

            {/* Static passive Buff block exactly as specified in design HTML */}
            <div className="mt-6 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
              <p className="text-[10px] text-indigo-300 uppercase font-bold tracking-wider">Passive Buff</p>
              <p className="text-xs text-slate-400 mt-1">Swift Step: +15% Jump Height in dark corridors.</p>
            </div>
          </div>

          {/* Quick Active Chamber Gate selector */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-3.5">Active Gates</h3>
            
            <div className="flex flex-col gap-2">
              {LEVELS.map((lvl, idx) => {
                const isActive = idx === levelIndex && gameStatus !== 'menu' && gameStatus !== 'victory';
                return (
                  <button
                    key={idx}
                    id={`gate-select-${idx}`}
                    onClick={() => handleLevelSelect(idx)}
                    className={`text-left p-2.5 rounded-lg border text-xs transition cursor-pointer select-none flex items-center justify-between ${
                      isActive 
                        ? 'bg-slate-800/80 border-indigo-500 text-white font-bold shadow-inner' 
                        : 'bg-slate-950/60 hover:bg-slate-850/80 border-slate-850 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-indigo-400 animate-pulse' : 'bg-slate-700'}`} />
                      <span>{idx + 1}. {lvl.name}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Keymappings configuration module */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-4 font-sans">Controls</h3>
            
            <div className="space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[11px] text-slate-400">Horizontal</span>
                <div className="flex space-x-1">
                  <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] font-mono">A</kbd>
                  <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] font-mono">D</kbd>
                </div>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[11px] text-slate-400">Jump</span>
                <div className="flex space-x-1">
                  <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] font-mono">W</kbd>
                  <kbd className="px-3 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] font-mono uppercase">Space</kbd>
                </div>
              </div>
            </div>
          </div>

        </aside>

      </div>

      {/* Sleek Interface Bottom System Bar */}
      <footer className="h-16 bg-slate-900/50 border border-slate-800 rounded-2xl px-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse"></div>
          <p className="text-xs text-slate-500 font-mono italic">
            System: Level progress synced. {cumulativeDeaths > 0 ? `Detected ${cumulativeDeaths} bio-restorations in current cycle.` : 'No hostile threats detected nearby.'}
          </p>
        </div>
        <div className="flex items-center space-x-8 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          <button 
            onClick={() => setGameStatus('menu')} 
            className="hover:text-white cursor-pointer transition"
          >
            Map Grid
          </button>
          <button 
            onClick={handleRestartLevel} 
            className="hover:text-white cursor-pointer transition"
          >
            Calibration
          </button>
          <button 
            onClick={() => setGameStatus('menu')} 
            className="hover:text-white cursor-pointer transition text-red-400"
          >
            Quit
          </button>
        </div>
      </footer>

    </div>
  );
}

// Side helper icon support
function Compass({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
    </svg>
  );
}
