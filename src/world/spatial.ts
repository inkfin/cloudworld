import { ISLAND_X, ISLAND_Z } from '../../shared/terrain';
import { pathDistance } from './trails';
import type { Simulation } from '../simulation';
export interface Point { x: number; z: number }
export interface Obstacle extends Point { radius: number; halfX?: number; halfZ?: number }
export const CAVE = { x: 13.2, z: -6.6, halfX: 3.65, halfZ: 4.6, mouthZ: -1.5, backZ:-11.5, bed: { x: 11.8, z: -8 }, perch: { x: 14.3, z: -7.2 }, roofHeight: 4.5 };
export type Surface = 'sand' | 'grass' | 'stone' | 'wood';
export function caveAmount(x: number, z: number): number {
  const side = Math.min(1, Math.max(0, (CAVE.halfX - Math.abs(x - CAVE.x)) / .6));
  const front = Math.min(1, Math.max(0, (CAVE.mouthZ + .8 - z) / 2));
  return z < CAVE.backZ ? 0 : side * front;
}
export function surfaceAt(x: number, z: number, sim: Simulation): Surface {
  if (x > CAVE.x-3.5 && x < CAVE.x+3.5 && z > CAVE.mouthZ && z < 2.3) return 'wood';
  if (caveAmount(x, z) > .1) return 'stone';
  const angle = Math.atan2(z / ISLAND_Z, x / ISLAND_X);
  return sim.radius(x, z) > .76 + .035 * Math.sin(angle * 7) || pathDistance(x,z)<.65 ? 'sand' : 'grass';
}
export function floorHeight(x: number, z: number, sim: Simulation): number {
  return sim.height(x, z) + (surfaceAt(x, z, sim) === 'wood' ? .11 : caveAmount(x,z) > .1 ? .035 : 0);
}
export function pushOutside(p: Point, radius: number, obstacle: Obstacle): void {
  if (obstacle.halfX !== undefined && obstacle.halfZ !== undefined) {
    const hx = obstacle.halfX + radius, hz = obstacle.halfZ + radius;
    const dx = p.x - obstacle.x, dz = p.z - obstacle.z;
    if (Math.abs(dx) >= hx || Math.abs(dz) >= hz) return;
    if (hx - Math.abs(dx) < hz - Math.abs(dz)) p.x = obstacle.x + (dx < 0 ? -hx : hx);
    else p.z = obstacle.z + (dz < 0 ? -hz : hz);
  } else {
    let dx = p.x - obstacle.x, dz = p.z - obstacle.z, distance = Math.hypot(dx,dz);
    const minimum = radius + obstacle.radius;
    if (distance >= minimum) return;
    if (distance < 1e-6) { dx = 1; dz = 0; distance = 1; }
    p.x = obstacle.x + dx / distance * minimum;
    p.z = obstacle.z + dz / distance * minimum;
  }
}
export function validPosition(p: Point, radius: number, obstacles: Obstacle[], sim: Simulation): boolean {
  if (sim.radius(p.x, p.z) > .94 - radius / ISLAND_X) return false;
  for (const ob of obstacles) {
    if (ob.halfX !== undefined && ob.halfZ !== undefined) {
      if (Math.abs(p.x-ob.x) < ob.halfX+radius && Math.abs(p.z-ob.z) < ob.halfZ+radius) return false;
    } else if (Math.hypot(p.x-ob.x,p.z-ob.z) < radius+ob.radius) return false;
  }
  return true;
}
