import type { Simulation } from '../simulation';
export interface Point { x: number; z: number }
export interface Obstacle extends Point { radius: number; halfX?: number; halfZ?: number }
export const CAVE = { x: 6, z: -3, halfX: 1.8, halfZ: 2.2, mouthZ: -.65, bed: { x: 5.35, z: -3.5 }, perch: { x: 6.7, z: -3.3 }, roofHeight: 3.65 };
export type Surface = 'sand' | 'grass' | 'stone' | 'wood';
export function caveAmount(x: number, z: number): number {
  const side = Math.min(1, Math.max(0, (CAVE.halfX - Math.abs(x - CAVE.x)) / .45));
  const front = Math.min(1, Math.max(0, (CAVE.mouthZ + .7 - z) / 1.4));
  return z < -5.15 ? 0 : side * front;
}
export function surfaceAt(x: number, z: number, sim: Simulation): Surface {
  if (x > 4.25 && x < 7.75 && z > -.65 && z < 1.35) return 'wood';
  if (caveAmount(x, z) > .1) return 'stone';
  const angle = Math.atan2(z / 10.5, x / 13);
  return sim.radius(x, z) > .76 + .035 * Math.sin(angle * 7) || (Math.abs(x + 1.8 * Math.sin(z * .43)) < .42 && z > -5) ? 'sand' : 'grass';
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
  if (sim.radius(p.x, p.z) > .94 - radius / 13) return false;
  for (const ob of obstacles) {
    if (ob.halfX !== undefined && ob.halfZ !== undefined) {
      if (Math.abs(p.x-ob.x) < ob.halfX+radius && Math.abs(p.z-ob.z) < ob.halfZ+radius) return false;
    } else if (Math.hypot(p.x-ob.x,p.z-ob.z) < radius+ob.radius) return false;
  }
  return true;
}
