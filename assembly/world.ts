import { ISLAND_X, ISLAND_Z, SPAWN_Z } from '../shared/terrain';
// 角色运动和地形查询在 WASM 内执行，渲染与碰撞共用同一个高度函数。
let playerX: f64 = 0.0;
let playerZ: f64 = SPAWN_Z;
let velocityX: f64 = 0.0;
let velocityZ: f64 = 0.0;
export function radius(x: f64, z: f64): f64 {
  const angle = Math.atan2(z / ISLAND_Z, x / ISLAND_X);
  return Math.sqrt(x * x / (ISLAND_X * ISLAND_X) + z * z / (ISLAND_Z * ISLAND_Z)) / (1.0 + 0.045 * Math.sin(angle * 5.0) + 0.025 * Math.cos(angle * 3.0));
}
export function height(x: f64, z: f64): f64 {
  const r = radius(x, z);
  const base = 0.20 + Math.max(0.0, 1.0 - r) * 1.0 - Math.max(0.0, r - 1.0) * 10.0;
  const hill = 2.2 * Math.exp(-((x + 8.0) * (x + 8.0) + (z + 9.0) * (z + 9.0)) / 150.0);
  return base + hill * Math.max(0.0, Math.min(1.0, (1.0 - r) * 4.0));
}
export function step(dx: f64, dz: f64, dt: f64, running: i32): void {
  dt = Math.max(0.0, Math.min(dt, 0.05));
  const length = Math.sqrt(dx * dx + dz * dz);
  const speed: f64 = running ? 5.0 : 2.8;
  const blend = Math.min(1.0, dt * 12.0);
  velocityX += ((length > 0.001 ? dx / length * speed : 0.0) - velocityX) * blend;
  velocityZ += ((length > 0.001 ? dz / length * speed : 0.0) - velocityZ) * blend;
  const nx = playerX + velocityX * dt;
  const nz = playerZ + velocityZ * dt;
  if (radius(nx, nz) < 0.94) { playerX = nx; playerZ = nz; }
  else { velocityX = 0.0; velocityZ = 0.0; }
}
export function resolve(x: f64, z: f64): void { if (radius(x, z) < 0.94) { playerX = x; playerZ = z; } }
export function reset(): void { playerX = 0.0; playerZ = SPAWN_Z; velocityX = 0.0; velocityZ = 0.0; }
export function x(): f64 { return playerX; }
export function z(): f64 { return playerZ; }
export function speed(): f64 { return Math.sqrt(velocityX * velocityX + velocityZ * velocityZ); }
