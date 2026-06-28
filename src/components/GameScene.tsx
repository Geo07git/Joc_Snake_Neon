/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { useEffect, useRef, useState, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGameStore, globalGameState, activeInputs } from '../store/gameStore';
import { WORLD_SIZE, TURN_SPEED, BOOST_SPEED, BASE_SPEED, SEGMENT_SPACING } from '../shared/types';
import * as THREE from 'three';
import { Sphere, Grid } from '@react-three/drei';

const localCollectedOrbs = new Set<string>();

const NEON_COLORS = [
  '#ff7eb3', // vibrant pink
  '#ffb86c', // vibrant orange
  '#f1fa8c', // vibrant yellow
  '#50fa7b', // vibrant green
  '#8be9fd', // vibrant blue
  '#bd93f9', // vibrant purple
];

function Snake({ playerId, color, isLocal }: { playerId: string, color: string, isLocal: boolean }) {
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.Mesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const currentPositions = useRef<{x: number, y: number}[]>([]);

  useFrame((state, delta) => {
    if (!bodyRef.current || !headRef.current) return;
    const gs = globalGameState.current;
    if (!gs) return;
    
    const player = gs.players[playerId];
    if (!player || player.segments.length === 0) {
      bodyRef.current.count = 0;
      headRef.current.visible = false;
      return;
    }
    
    headRef.current.visible = true;
    const count = player.segments.length;
    bodyRef.current.count = Math.max(0, count - 1);
    
    while (currentPositions.current.length < count) {
      const idx = currentPositions.current.length;
      currentPositions.current.push({ 
        x: player.segments[idx]?.x || 0, 
        y: player.segments[idx]?.y || 0 
      });
    }

    for (let i = 0; i < count; i++) {
      let targetX = player.segments[i].x;
      let targetY = player.segments[i].y;
      
      const curr = currentPositions.current[i];
      if (isLocal) {
        curr.x = targetX;
        curr.y = targetY;
      } else {
        const dist = Math.abs(targetX - curr.x) + Math.abs(targetY - curr.y);
        if (dist > 10) {
          curr.x = targetX;
          curr.y = targetY;
        } else {
          const lerpFactor = 15;
          curr.x += (targetX - curr.x) * lerpFactor * delta;
          curr.y += (targetY - curr.y) * lerpFactor * delta;
        }
      }
      
      if (i === 0) {
        headRef.current.position.set(curr.x, curr.y, 0.5);
      } else {
        dummy.position.set(curr.x, curr.y, 0.5);
        dummy.updateMatrix();
        bodyRef.current.setMatrixAt(i - 1, dummy.matrix);
      }
    }
    bodyRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <Sphere ref={headRef} castShadow receiveShadow args={[0.8, 16, 16]}>
        <meshStandardMaterial
          color={color}
          roughness={0.2}
          metalness={0.8}
          toneMapped={false}
          onBeforeCompile={(shader) => {
            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <emissivemap_fragment>',
              `
              #include <emissivemap_fragment>
              float fresnel = pow(1.0 - max(dot(normal, normalize(vViewPosition)), 0.0), 2.0);
              totalEmissiveRadiance += diffuseColor.rgb * (0.4 + fresnel * 3.0);
              `
            );
          }}
        />
      </Sphere>
      <instancedMesh ref={bodyRef} args={[null as any, null as any, 2000]} castShadow receiveShadow frustumCulled={false}>
        <sphereGeometry args={[0.6, 16, 16]} />
        <meshStandardMaterial
          color={color}
          roughness={0.2}
          metalness={0.8}
          toneMapped={false}
          onBeforeCompile={(shader) => {
            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <emissivemap_fragment>',
              `
              #include <emissivemap_fragment>
              float fresnel = pow(1.0 - max(dot(normal, normalize(vViewPosition)), 0.0), 2.0);
              totalEmissiveRadiance += diffuseColor.rgb * (0.4 + fresnel * 1.5);
              `
            );
          }}
        />
      </instancedMesh>
    </group>
  );
}

function Orbs() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorObj = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    if (!meshRef.current) return;
    const gs = globalGameState.current;
    if (!gs) return;

    let i = 0;
    for (const orbId in gs.orbs) {
      if (localCollectedOrbs.has(orbId)) continue;
      const orb = gs.orbs[orbId];
      dummy.position.set(orb.x, orb.y, 0.5);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      colorObj.set(orb.color);
      meshRef.current.setColorAt(i, colorObj);
      i++;
    }
    meshRef.current.count = i;
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[null as any, null as any, 1000]} castShadow receiveShadow frustumCulled={false}>
      <sphereGeometry args={[0.5, 16, 16]} />
      <meshStandardMaterial
        roughness={0.4}
        metalness={0.1}
        toneMapped={false}
        onBeforeCompile={(shader) => {
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <emissivemap_fragment>',
            `
            #include <emissivemap_fragment>
            totalEmissiveRadiance += diffuseColor.rgb * 2.5;
            `
          );
        }}
      />
    </instancedMesh>
  );
}

export function GameScene() {
  const { gameState, playerId, sendPlayerState, sendCollectOrb, isLocalMode } = useGameStore();
  const { camera } = useThree();
  const inputs = useRef({ left: false, right: false, boost: false });
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const [lightTarget] = useState(() => new THREE.Object3D());
  const lastLeaderboardUpdate = useRef(0);

  const localPlayerRef = useRef<{
    active: boolean;
    segments: {x: number, y: number}[];
    score: number;
    currentAngle: number;
    isBoosting: boolean;
    lastSendTime: number;
  }>({
    active: false,
    segments: [],
    score: 10,
    currentAngle: 0,
    isBoosting: false,
    lastSendTime: 0,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') && !inputs.current.left) { inputs.current.left = true; }
      if ((e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') && !inputs.current.right) { inputs.current.right = true; }
      if ((e.key === ' ' || e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') && !inputs.current.boost) { inputs.current.boost = true; }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if ((e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') && inputs.current.left) { inputs.current.left = false; }
      if ((e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') && inputs.current.right) { inputs.current.right = false; }
      if ((e.key === ' ' || e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') && inputs.current.boost) { inputs.current.boost = false; }
    };

    const handleBlur = () => {
      inputs.current = { left: false, right: false, boost: false };
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  useFrame((state, delta) => {
    const gs = globalGameState.current;
    if (!gs || !playerId) return;

    if (isLocalMode) {
      // 1. Spawning random orbs in local mode
      if (Math.random() < 0.02 && Object.keys(gs.orbs).length < 250) {
        const id = 'orb-rand-' + Math.random();
        gs.orbs[id] = {
          id,
          x: (Math.random() - 0.5) * WORLD_SIZE,
          y: (Math.random() - 0.5) * WORLD_SIZE,
          value: 1,
          color: NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)],
        };
      }

      // 2. Simulating bots in local mode
      Object.values(gs.players).forEach((p) => {
        if (p.id === playerId) return; // Skip human player

        if (p.state === 'dead') {
          // Slowly respawn dead bots
          if (Math.random() < 0.005) {
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
            p.state = 'alive';
            p.segments = bSegments;
            p.score = bLength;
            p.currentAngle = bAngle;
            p.isBoosting = false;
          }
          return;
        }

        // Steer bot
        // Avoid boundary
        const boundLimit = WORLD_SIZE / 2 - 12;
        const botHead = p.segments[0];
        if (!botHead) return;

        let steered = false;
        if (Math.abs(botHead.x) > boundLimit || Math.abs(botHead.y) > boundLimit) {
          const centerAngle = Math.atan2(-botHead.y, -botHead.x);
          let diff = centerAngle - p.currentAngle;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          p.currentAngle += Math.min(Math.max(diff, -TURN_SPEED * delta), TURN_SPEED * delta);
          steered = true;
        }

        // If not steered by boundary, steer towards nearby orbs or other snakes
        if (!steered) {
          // Wiggle a little
          p.currentAngle += (Math.random() - 0.5) * 1.5 * delta;

          // Find closest orb
          let closestOrb = null;
          let minDistSq = 625; // 25 units max search
          for (const orbId in gs.orbs) {
            const orb = gs.orbs[orbId];
            const dx = orb.x - botHead.x;
            const dy = orb.y - botHead.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < minDistSq) {
              minDistSq = distSq;
              closestOrb = orb;
            }
          }

          if (closestOrb) {
            const targetAngle = Math.atan2(closestOrb.y - botHead.y, closestOrb.x - botHead.x);
            let diff = targetAngle - p.currentAngle;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            p.currentAngle += Math.min(Math.max(diff, -TURN_SPEED * 0.4 * delta), TURN_SPEED * 0.4 * delta);
          }
        }

        // Move bot forward
        const bSpeed = p.isBoosting ? BOOST_SPEED : BASE_SPEED;
        const newHead = {
          x: botHead.x + Math.cos(p.currentAngle) * bSpeed * delta,
          y: botHead.y + Math.sin(p.currentAngle) * bSpeed * delta,
        };

        const boundary = WORLD_SIZE / 2;
        if (newHead.x < -boundary) newHead.x = -boundary;
        if (newHead.x > boundary) newHead.x = boundary;
        if (newHead.y < -boundary) newHead.y = -boundary;
        if (newHead.y > boundary) newHead.y = boundary;

        p.segments.unshift(newHead);

        // Consume boosting score
        if (p.isBoosting) {
          p.score -= 2 * delta;
          if (p.score <= 10) {
            p.isBoosting = false;
            p.score = 10;
          }
        } else if (Math.random() < 0.005 && p.score > 15) {
          p.isBoosting = true;
        }

        const bTargetLength = Math.floor(p.score);
        while (p.segments.length > bTargetLength) {
          p.segments.pop();
        }

        // Check orb collection for bot
        for (const orbId in gs.orbs) {
          const orb = gs.orbs[orbId];
          const dx = newHead.x - orb.x;
          const dy = newHead.y - orb.y;
          if (dx * dx + dy * dy < 4) {
            p.score += orb.value;
            delete gs.orbs[orbId];
          }
        }

        // Check collision for bot
        let botCollided = false;
        for (const otherId in gs.players) {
          if (otherId === p.id) continue;
          const other = gs.players[otherId];
          if (other.state !== 'alive') continue;
          for (const seg of other.segments) {
            const dx = newHead.x - seg.x;
            const dy = newHead.y - seg.y;
            if (dx * dx + dy * dy < 2.25) {
              botCollided = true;
              break;
            }
          }
          if (botCollided) break;
        }

        if (botCollided) {
          p.state = 'dead';
          p.segments.forEach((seg, idx) => {
            if (idx % 2 === 0) {
              const oId = 'orb-' + Math.random();
              gs.orbs[oId] = {
                id: oId,
                x: seg.x,
                y: seg.y,
                value: 1,
                color: p.color,
              };
            }
          });
        }
      });

      // 3. Update leaderboard
      const now = Date.now();
      if (now - lastLeaderboardUpdate.current > 200) {
        const sortedLeaderboard = Object.values(gs.players)
          .filter(p => p.state === 'alive')
          .sort((a, b) => b.score - a.score)
          .slice(0, 10)
          .map(p => ({ id: p.id, name: p.name, score: Math.floor(p.score), color: p.color }));
        
        gs.leaderboard = sortedLeaderboard;
        useGameStore.setState({ gameState: { ...gs } });
        lastLeaderboardUpdate.current = now;
      }
    }

    const serverPlayer = gs.players[playerId];
    if (serverPlayer && serverPlayer.state === 'alive') {
      
      // Initialize from server if not active
      if (!localPlayerRef.current.active && serverPlayer.segments.length > 0) {
        localPlayerRef.current.active = true;
        localPlayerRef.current.segments = [...serverPlayer.segments];
        localPlayerRef.current.score = serverPlayer.score;
        localPlayerRef.current.currentAngle = serverPlayer.currentAngle;
      }

      if (!localPlayerRef.current.active) return;

      // Local movement logic (support keyboard & touch inputs)
      if (inputs.current.left || activeInputs.left) localPlayerRef.current.currentAngle += TURN_SPEED * delta;
      if (inputs.current.right || activeInputs.right) localPlayerRef.current.currentAngle -= TURN_SPEED * delta;
      
      localPlayerRef.current.isBoosting = (inputs.current.boost || activeInputs.boost) && localPlayerRef.current.score > 10;
      const speed = localPlayerRef.current.isBoosting ? BOOST_SPEED : BASE_SPEED;
      
      const head = { ...localPlayerRef.current.segments[0] };
      head.x += Math.cos(localPlayerRef.current.currentAngle) * speed * delta;
      head.y += Math.sin(localPlayerRef.current.currentAngle) * speed * delta;

      // Boundary check
      const boundary = WORLD_SIZE / 2;
      if (head.x < -boundary) head.x = -boundary;
      if (head.x > boundary) head.x = boundary;
      if (head.y < -boundary) head.y = -boundary;
      if (head.y > boundary) head.y = boundary;

      localPlayerRef.current.segments.unshift(head);

      if (localPlayerRef.current.isBoosting) {
        localPlayerRef.current.score -= 2 * delta;
        if (localPlayerRef.current.score <= 10) {
          localPlayerRef.current.isBoosting = false;
          localPlayerRef.current.score = 10;
        }
      }

      const targetLength = Math.floor(localPlayerRef.current.score);
      while (localPlayerRef.current.segments.length > targetLength) {
        localPlayerRef.current.segments.pop();
      }

      // Check orb collisions
      for (const orbId in gs.orbs) {
        if (localCollectedOrbs.has(orbId)) continue;
        const orb = gs.orbs[orbId];
        const dx = head.x - orb.x;
        const dy = head.y - orb.y;
        if (dx * dx + dy * dy < 4) {
          localPlayerRef.current.score += orb.value;
          localCollectedOrbs.add(orbId);
          delete gs.orbs[orbId]; // predict locally
          sendCollectOrb(orbId);
        }
      }

      // Cleanup localCollectedOrbs occasionally
      if (Math.random() < 0.05) {
        for (const id of localCollectedOrbs) {
          if (!gs.orbs[id]) localCollectedOrbs.delete(id);
        }
      }

      // Check player collisions
      let collided = false;
      for (const otherId in gs.players) {
        if (otherId === playerId) continue;
        const other = gs.players[otherId];
        if (other.state !== 'alive') continue;
        for (const seg of other.segments) {
          const dx = head.x - seg.x;
          const dy = head.y - seg.y;
          if (dx * dx + dy * dy < 2.25) {
            collided = true;
            break;
          }
        }
        if (collided) break;
      }

      if (collided) {
        localPlayerRef.current.active = false;
        sendPlayerState({
          segments: localPlayerRef.current.segments,
          score: localPlayerRef.current.score,
          currentAngle: localPlayerRef.current.currentAngle,
          isBoosting: localPlayerRef.current.isBoosting,
          state: 'dead'
        });
        return;
      }

      // Overwrite global state for local rendering
      gs.players[playerId].segments = localPlayerRef.current.segments;
      gs.players[playerId].score = localPlayerRef.current.score;
      gs.players[playerId].currentAngle = localPlayerRef.current.currentAngle;
      gs.players[playerId].isBoosting = localPlayerRef.current.isBoosting;

      // Send state to server at 20Hz
      const now = Date.now();
      if (now - localPlayerRef.current.lastSendTime > 50) {
        sendPlayerState({
          segments: localPlayerRef.current.segments,
          score: localPlayerRef.current.score,
          currentAngle: localPlayerRef.current.currentAngle,
          isBoosting: localPlayerRef.current.isBoosting,
          state: 'alive'
        });
        localPlayerRef.current.lastSendTime = now;
      }

      // Dynamically adjust camera height for mobile portrait/landscape aspect ratio
      const isPortrait = window.innerHeight > window.innerWidth;
      const baseZ = isPortrait ? 35 : 20;
      const maxZ = isPortrait ? 70 : 45;
      const targetZ = Math.min(maxZ, Math.max(baseZ, baseZ + localPlayerRef.current.score * (isPortrait ? 0.35 : 0.2)));
      
      // Smooth camera follow predicted head
      camera.position.x += (head.x - camera.position.x) * 10 * delta;
      camera.position.y += (head.y - camera.position.y) * 10 * delta;
      camera.position.z += (targetZ - camera.position.z) * 4 * delta;
      camera.lookAt(camera.position.x, camera.position.y, 0);

      // Make the directional light follow the camera to keep shadows crisp
      if (lightRef.current) {
        lightRef.current.position.set(camera.position.x + 10, camera.position.y - 10, 30);
        lightTarget.position.set(camera.position.x, camera.position.y, 0);
      }
    } else {
      localPlayerRef.current.active = false;
    }
  });

  if (!gameState) return null;

  return (
    <>
      <ambientLight intensity={0.4} />
      
      <directionalLight
        ref={lightRef}
        target={lightTarget}
        castShadow
        intensity={2}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-near={0.1}
        shadow-camera-far={100}
        shadow-bias={-0.001}
      />
      <primitive object={lightTarget} />

      {/* Ground plane to receive shadows */}
      <mesh receiveShadow position={[0, 0, -0.2]}>
        <planeGeometry args={[WORLD_SIZE, WORLD_SIZE]} />
        <meshStandardMaterial color="#0a0a0a" />
      </mesh>

      <Grid
        position={[0, 0, -0.1]}
        rotation={[Math.PI / 2, 0, 0]}
        args={[WORLD_SIZE, WORLD_SIZE]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#1e3a8a"
        sectionSize={10}
        sectionThickness={1}
        sectionColor="#3b82f6"
        fadeDistance={100}
        fadeStrength={1}
      />

      <Orbs />

      {Object.values(gameState.players).map((player) => {
        if (player.state !== 'alive' || player.segments.length === 0) return null;
        return (
          <Snake
            key={player.id}
            playerId={player.id}
            color={player.color}
            isLocal={player.id === playerId}
          />
        );
      })}
    </>
  );
}
