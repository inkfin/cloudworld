// A deterministic directional wave spectrum, in metres and seconds.
// Deep-water gravity/capillary dispersion: omega² = g k + (sigma/rho) k³.
export const WATER_F0=((1.333-1)/(1.333+1))**2;
let seed=7291;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};
export const WAVES=Array.from({length:20},(_,i)=>{
 const wavelength=27*Math.pow(.79,i)*( .88+random()*.24);
 const k=2*Math.PI/wavelength,angle=.65+(random()-.5)*2.4+(i%4===0?1.7:0);
 const slope=.038+random()*.026;
 return {x:Math.cos(angle),z:Math.sin(angle),k,amplitude:slope/k,omega:Math.sqrt(9.81*k+.000074*k**3),phase:random()*Math.PI*2,geometry:wavelength>10};
});
export function sampleWaves(x:number,z:number,t:number){
 let height=0,dx=0,dz=0;
 for(const w of WAVES){const p=w.k*(x*w.x+z*w.z)-w.omega*t+w.phase;height+=w.amplitude*Math.sin(p);const s=w.amplitude*w.k*Math.cos(p);dx+=s*w.x;dz+=s*w.z;}
 return {height,dx,dz};
}
