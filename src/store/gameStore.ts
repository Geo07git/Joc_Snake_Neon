/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { GameState, Player, Orb, WORLD_SIZE, INITIAL_LENGTH, SEGMENT_SPACING } from '../shared/types';
import { v4 as uuidv4 } from 'uuid';

interface GameStore {
  socket: Socket | null;
  gameState: GameState | null;
  playerId: string | null;
  isLocalMode: boolean;
  selectedMode: 'single' | 'multi' | null;
  connect: () => void;
  startSinglePlayer: () => void;
  startMultiplayer: () => void;
  joinGame: () => void;
  sendPlayerState: (data: any) => void;
  sendCollectOrb: (orbId: string) => void;
  leaveGame: () => void;
}

const COLORS = [
  '#ff7eb3', // vibrant pink
  '#ffb86c', // vibrant orange
  '#f1fa8c', // vibrant yellow
  '#50fa7b', // vibrant green
  '#8be9fd', // vibrant blue
  '#bd93f9', // vibrant purple
];

export const globalGameState: { current: GameState | null } = { current: null };
export const activeInputs = {
  left: false,
  right: false,
  boost: false,
};
let lastUiUpdate = 0;

export const useGameStore = create<GameStore>((set, get) => ({
  socket: null,
  gameState: null,
  playerId: null,
  isLocalMode: false,
  selectedMode: null,
  connect: () => {
    // Keep connect as no-op or auto-connection check if needed,
    // but startMultiplayer/startSinglePlayer are preferred now.
  },
  startSinglePlayer: () => {
    // Clean up active socket if any
    const { socket } = get();
    if (socket) {
      socket.disconnect();
    }

    const initialOrbs: Record<string, Orb> = {};
    for (let i = 0; i < 150; i++) {
      const id = uuidv4();
      initialOrbs[id] = {
        id,
        x: (Math.random() - 0.5) * WORLD_SIZE,
        y: (Math.random() - 0.5) * WORLD_SIZE,
        value: 1,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      };
    }

    const localState: GameState = {
      players: {},
      orbs: initialOrbs,
      leaderboard: [],
    };

    globalGameState.current = localState;
    set({
      socket: null,
      gameState: localState,
      playerId: 'local-player',
      isLocalMode: true,
      selectedMode: 'single',
    });
  },
  startMultiplayer: () => {
    const currentSocket = get().socket;
    if (currentSocket && !get().isLocalMode) {
      set({ selectedMode: 'multi' });
      return;
    }

    const socket = io({
      timeout: 3000,
      reconnectionAttempts: 2,
    });

    let isConnected = false;

    socket.on('connect', () => {
      isConnected = true;
      console.log('Connected to server');
      set({ socket, isLocalMode: false, selectedMode: 'multi' });
    });

    socket.on('init', (id: string) => {
      set({ playerId: id });
    });

    socket.on('state', (state: GameState) => {
      globalGameState.current = state;
      const now = Date.now();
      if (now - lastUiUpdate > 100) { // Throttle React updates to 10Hz
        set({ gameState: state });
        lastUiUpdate = now;
      }
    });

    socket.on('connect_error', () => {
      if (!isConnected) {
        console.log('Connection failed, starting local mode as fallback...');
        socket.disconnect();
        get().startSinglePlayer();
      }
    });

    setTimeout(() => {
      if (!isConnected) {
        console.log('Connection timeout, starting local mode as fallback...');
        socket.disconnect();
        get().startSinglePlayer();
      }
    }, 3000);
  },
  leaveGame: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
    }
    globalGameState.current = null;
    set({
      socket: null,
      gameState: null,
      playerId: null,
      isLocalMode: false,
      selectedMode: null,
    });
  },
  joinGame: () => {
    const { socket, isLocalMode, playerId } = get();
    if (isLocalMode) {
      const state = globalGameState.current;
      if (!state) return;

      const pId = playerId || 'local-player';
      const startX = (Math.random() - 0.5) * (WORLD_SIZE - 20);
      const startY = (Math.random() - 0.5) * (WORLD_SIZE - 20);
      const angle = Math.random() * Math.PI * 2;

      const segments = [];
      for (let i = 0; i < INITIAL_LENGTH; i++) {
        segments.push({
          x: startX - Math.cos(angle) * i * SEGMENT_SPACING,
          y: startY - Math.sin(angle) * i * SEGMENT_SPACING,
        });
      }

      const localPlayer: Player = {
        id: pId,
        name: 'You',
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        segments,
        score: INITIAL_LENGTH,
        isBoosting: false,
        state: 'alive',
        currentAngle: angle,
        inputs: { left: false, right: false, boost: false },
      };

      state.players[pId] = localPlayer;

      // Spawn some bots to play with
      const botNames = ["TurboViper", "CyberPython", "GlowWorm", "PlasmaCobra", "AeroAdder", "FluxBoa", "GridWhip", "Zenith", "Quantum", "Shadow"];
      botNames.forEach((name, idx) => {
        const botId = `bot-${idx}`;
        const bX = (Math.random() - 0.5) * (WORLD_SIZE - 20);
        const bY = (Math.random() - 0.5) * (WORLD_SIZE - 20);
        const bAngle = Math.random() * Math.PI * 2;
        const bSegments = [];
        const bLength = 8 + Math.floor(Math.random() * 8);
        for (let i = 0; i < bLength; i++) {
          bSegments.push({
            x: bX - Math.cos(bAngle) * i * SEGMENT_SPACING,
            y: bY - Math.sin(bAngle) * i * SEGMENT_SPACING,
          });
        }
        state.players[botId] = {
          id: botId,
          name,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          segments: bSegments,
          score: bLength,
          isBoosting: false,
          state: 'alive',
          currentAngle: bAngle,
          inputs: { left: false, right: false, boost: false },
        };
      });

      // Recalculate leaderboard
      state.leaderboard = Object.values(state.players)
        .filter(p => p.state === 'alive')
        .sort((a, b) => b.score - a.score)
        .map(p => ({ id: p.id, name: p.name, score: Math.floor(p.score), color: p.color }));

      set({ gameState: { ...state }, playerId: pId });
    } else if (socket) {
      socket.emit('join');
    }
  },
  sendPlayerState: (data) => {
    const { socket, isLocalMode, playerId } = get();
    if (isLocalMode) {
      const state = globalGameState.current;
      if (state && playerId) {
        const player = state.players[playerId];
        if (player) {
          player.segments = data.segments;
          player.score = data.score;
          player.currentAngle = data.currentAngle;
          player.isBoosting = data.isBoosting;
          if (data.state === 'dead') {
            player.state = 'dead';
            // Drop orbs
            player.segments.forEach((seg, i) => {
              if (i % 2 === 0) {
                const orbId = uuidv4();
                state.orbs[orbId] = {
                  id: orbId,
                  x: seg.x,
                  y: seg.y,
                  value: 1,
                  color: player.color,
                };
              }
            });
          }
        }
      }
    } else if (socket) {
      socket.emit('update_state', data);
    }
  },
  sendCollectOrb: (orbId) => {
    const { socket, isLocalMode } = get();
    if (isLocalMode) {
      const state = globalGameState.current;
      if (state && state.orbs[orbId]) {
        delete state.orbs[orbId];
      }
    } else if (socket) {
      socket.emit('collect_orb', orbId);
    }
  },
}));
