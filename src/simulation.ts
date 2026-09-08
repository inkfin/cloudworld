export interface Simulation {
  radius(x: number, z: number): number;
  height(x: number, z: number): number;
  step(dx: number, dz: number, dt: number, running: number): void;
  resolve(x: number, z: number): void;
  reset(): void;
  x(): number;
  z(): number;
  speed(): number;
}
export async function loadSimulation(): Promise<Simulation> {
  const response = await fetch(`${import.meta.env.BASE_URL}world.wasm`);
  if (!response.ok) throw new Error(`无法加载小岛引擎 (${response.status})`);
  const { instance } = await WebAssembly.instantiate(await response.arrayBuffer(), {
    env: { abort: () => { throw new Error('小岛引擎运行出错'); } },
  });
  return instance.exports as unknown as Simulation;
}
