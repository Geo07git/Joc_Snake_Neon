/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { useGameStore, activeInputs } from '../store/gameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, Trophy, ArrowLeft, ArrowRight, Zap, User, Users } from 'lucide-react';

export function UI() {
  const {
    gameState,
    playerId,
    joinGame,
    isLocalMode,
    selectedMode,
    startSinglePlayer,
    startMultiplayer,
    leaveGame
  } = useGameStore();

  const player = playerId && gameState ? gameState.players[playerId] : null;
  const isAlive = player?.state === 'alive';
  const isDead = player?.state === 'dead';

  const handleLeftStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    activeInputs.left = true;
  };
  const handleLeftEnd = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    activeInputs.left = false;
  };
  const handleRightStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    activeInputs.right = true;
  };
  const handleRightEnd = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    activeInputs.right = false;
  };
  const handleBoostStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    activeInputs.boost = true;
  };
  const handleBoostEnd = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    activeInputs.boost = false;
  };

  const handleOpenNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4">
      {/* Top Bar */}
      <div className="flex justify-between items-start pointer-events-auto relative">
        <div className="flex flex-col gap-2 z-10">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-white tracking-tighter" style={{ textShadow: '0 0 10px rgba(255,255,255,0.5)' }}>
              NEON.SNAKE
            </h1>
            {selectedMode && (
              <span className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${isLocalMode ? 'bg-zinc-800 text-zinc-400 border border-zinc-700' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'}`}>
                {isLocalMode ? 'Local Bot Mode' : 'Live Multiplayer'}
              </span>
            )}
          </div>
          {isAlive && (
            <div className="text-xl font-mono text-white/80 font-bold">
              Length: {Math.floor(player.score)}
            </div>
          )}
        </div>
        
        {/* Controls Hint */}
        <div className="absolute left-1/2 -translate-x-1/2 top-0 flex gap-2 opacity-80 pointer-events-none hidden sm:flex">
          <div className="flex items-center gap-2 text-xs font-mono text-white bg-white/5 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10">
            <span className="font-bold bg-white/20 px-1.5 py-0.5 rounded text-white">A</span>
            <span className="font-bold bg-white/20 px-1.5 py-0.5 rounded text-white">D</span>
            <span className="text-white/70 uppercase tracking-wider text-[10px]">Turn</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-white bg-white/5 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10">
            <span className="font-bold bg-white/20 px-1.5 py-0.5 rounded text-white">SPACE</span>
            <span className="text-white/70 uppercase tracking-wider text-[10px]">Boost</span>
          </div>
        </div>

        <div className="flex items-center gap-2 z-10">
          {selectedMode && (
            <button
              onClick={leaveGame}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 rounded-full text-red-400 text-sm font-bold transition-all"
            >
              <span>Back to Menu</span>
            </button>
          )}
          <button
            onClick={handleOpenNewTab}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white text-sm font-bold transition-colors"
          >
            <ExternalLink size={16} />
            <span>New Tab</span>
          </button>
        </div>
      </div>

      {/* Leaderboard */}
      {gameState && gameState.leaderboard.length > 0 && (
        <div className="absolute top-20 right-4 w-48 sm:w-64 bg-black/40 backdrop-blur-md rounded-2xl p-3 sm:p-4 border border-white/10 pointer-events-auto max-h-[40vh] overflow-y-auto">
          <div className="flex items-center gap-2 mb-2 sm:mb-4 text-white/80 font-semibold text-xs sm:text-sm">
            <Trophy size={16} className="text-yellow-400" />
            <h2>LEADERBOARD</h2>
          </div>
          <div className="flex flex-col gap-1.5 sm:gap-2">
            {gameState.leaderboard.slice(0, 5).map((entry, i) => (
              <div key={entry.id} className="flex justify-between items-center text-xs sm:text-sm">
                <div className="flex items-center gap-1.5 sm:gap-2 truncate">
                  <span className="text-white/40 w-4">{i + 1}.</span>
                  <span style={{ color: entry.color }} className="font-medium truncate max-w-[80px] sm:max-w-[120px]">
                    {entry.name}
                  </span>
                </div>
                <span className="font-mono text-white/80">{entry.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mobile Touch Controls */}
      {isAlive && (
        <div className="absolute bottom-6 left-0 right-0 px-6 flex justify-between items-end pointer-events-none md:hidden z-10">
          {/* Left / Right Steering Buttons */}
          <div className="flex gap-4 pointer-events-auto">
            <button
              onTouchStart={handleLeftStart}
              onTouchEnd={handleLeftEnd}
              onMouseDown={handleLeftStart}
              onMouseUp={handleLeftEnd}
              onMouseLeave={handleLeftEnd}
              className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/40 text-blue-400 flex items-center justify-center backdrop-blur-md active:bg-blue-500/30 active:scale-95 transition-all select-none outline-none shadow-[0_0_15px_rgba(59,130,246,0.2)]"
            >
              <ArrowLeft size={28} />
            </button>
            <button
              onTouchStart={handleRightStart}
              onTouchEnd={handleRightEnd}
              onMouseDown={handleRightStart}
              onMouseUp={handleRightEnd}
              onMouseLeave={handleRightEnd}
              className="w-16 h-16 rounded-full bg-pink-500/10 border border-pink-500/40 text-pink-400 flex items-center justify-center backdrop-blur-md active:bg-pink-500/30 active:scale-95 transition-all select-none outline-none shadow-[0_0_15px_rgba(236,72,153,0.2)]"
            >
              <ArrowRight size={28} />
            </button>
          </div>

          {/* Boost Button */}
          <div className="pointer-events-auto">
            <button
              onTouchStart={handleBoostStart}
              onTouchEnd={handleBoostEnd}
              onMouseDown={handleBoostStart}
              onMouseUp={handleBoostEnd}
              onMouseLeave={handleBoostEnd}
              className="w-20 h-20 rounded-full bg-amber-500/10 border-2 border-amber-500/50 text-amber-400 flex flex-col items-center justify-center backdrop-blur-md active:bg-amber-500/30 active:scale-95 transition-all select-none outline-none shadow-[0_0_20px_rgba(245,158,11,0.3)]"
            >
              <Zap size={28} className="animate-pulse" />
              <span className="text-[9px] font-mono font-black tracking-widest mt-0.5">BOOST</span>
            </button>
          </div>
        </div>
      )}

      {/* Menus */}
      <AnimatePresence>
        {selectedMode === null ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-black/80 backdrop-blur-md z-50"
          >
            <div className="bg-zinc-900/95 p-6 sm:p-8 rounded-3xl border border-white/10 shadow-2xl max-w-xl w-full flex flex-col items-center gap-6 sm:gap-8 mx-4">
              <div className="text-center">
                <h2 className="text-4xl font-black text-white tracking-tight mb-2" style={{ textShadow: '0 0 15px rgba(255,255,255,0.3)' }}>
                  NEON.SNAKE
                </h2>
                <p className="text-white/50 text-sm">Select your play style to enter the grid arena</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                {/* Single Player Card */}
                <div className="flex flex-col justify-between p-5 rounded-2xl bg-gradient-to-b from-blue-500/10 to-transparent border border-blue-500/20 hover:border-blue-500/40 transition-all group">
                  <div>
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                      <User className="text-blue-400 w-6 h-6 group-hover:scale-110 transition-transform" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1.5">Single Player</h3>
                    <p className="text-xs text-white/50 leading-relaxed mb-6">
                      Instantly play offline against 10 responsive AI bots. Perfect for high performance and zero network lag.
                    </p>
                  </div>
                  <button
                    onClick={startSinglePlayer}
                    className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition-all active:scale-95 shadow-[0_0_20px_rgba(59,130,246,0.3)] text-sm"
                  >
                    PLAY VS BOTS
                  </button>
                </div>

                {/* Multiplayer Card */}
                <div className="flex flex-col justify-between p-5 rounded-2xl bg-gradient-to-b from-pink-500/10 to-transparent border border-pink-500/20 hover:border-pink-500/40 transition-all group">
                  <div>
                    <div className="w-12 h-12 rounded-xl bg-pink-500/10 flex items-center justify-center mb-4 border border-pink-500/30 shadow-[0_0_15px_rgba(236,72,153,0.15)]">
                      <Users className="text-pink-400 w-6 h-6 group-hover:scale-110 transition-transform" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1.5">Multiplayer</h3>
                    <p className="text-xs text-white/50 leading-relaxed mb-6">
                      Join the live online arena. Slither and compete against real players around the globe in real-time.
                    </p>
                  </div>
                  <button
                    onClick={startMultiplayer}
                    className="w-full py-3 bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-xl transition-all active:scale-95 shadow-[0_0_20px_rgba(236,72,153,0.3)] text-sm"
                  >
                    JOIN LIVE LOBBY
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          (!player || isDead) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-black/60 backdrop-blur-sm z-40"
            >
              <div className="bg-zinc-900/90 p-8 rounded-3xl border border-white/10 shadow-2xl max-w-md w-full flex flex-col items-center gap-6 mx-4">
                {isDead && (
                  <div className="text-center">
                    <h2 className="text-4xl font-black text-red-500 mb-2">YOU DIED</h2>
                    <p className="text-white/60">Final Length: {Math.floor(player.score)}</p>
                  </div>
                )}
                
                {!isDead && (
                  <div className="text-center">
                    <h2 className="text-3xl font-black text-white mb-2">READY TO SLITHER</h2>
                    <p className="text-white/60 text-sm">
                      Mode: <span className="text-white font-bold underline decoration-dotted">{isLocalMode ? 'Single Player (Bots)' : 'Live Multiplayer'}</span>
                    </p>
                    <p className="text-white/40 text-xs mt-3 leading-relaxed">
                      Steer with A/D, Left/Right or touch buttons. Boost with Space or the Boost button.
                    </p>
                  </div>
                )}
                
                <div className="w-full flex flex-col gap-3">
                  <button
                    onClick={joinGame}
                    className="w-full py-4 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors active:scale-95 text-base"
                  >
                    {isDead ? 'RESPAWN' : 'PLAY'}
                  </button>

                  <button
                    onClick={leaveGame}
                    className="w-full py-3 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 font-bold rounded-xl transition-all active:scale-95 text-sm border border-white/5"
                  >
                    CHANGE MODE
                  </button>
                </div>
              </div>
            </motion.div>
          )
        )}
      </AnimatePresence>
    </div>
  );
}
