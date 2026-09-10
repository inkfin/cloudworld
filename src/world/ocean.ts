import * as THREE from 'three/webgpu';
import {uniform} from 'three/tsl';
import type {Simulation} from '../simulation';
import {OceanSpectrum,tideAt,TIDE_PERIOD,runupAt} from './ocean-spectrum';
import {oceanMaterial} from './materials';
export const BED_SIZE=128;
function dataTexture(data:Uint16Array,size:number,repeat=false){const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat,THREE.HalfFloatType);t.minFilter=t.magFilter=THREE.LinearFilter;t.wrapS=t.wrapT=repeat?THREE.RepeatWrapping:THREE.ClampToEdgeWrapping;t.needsUpdate=true;return t;}
function encoded(source:Float32Array,target:Uint16Array){for(let i=0;i<source.length;i++)target[i]=THREE.DataUtils.toHalfFloat(source[i]);}
export class OceanCascade {
 readonly spectrum:OceanSpectrum;
 readonly displacement:THREE.DataTexture[];readonly normals:THREE.DataTexture[];
 constructor(readonly length:number,rms:number,seed:number,wind:number){
  this.spectrum=new OceanSpectrum(64,length,rms,seed,wind);
  this.displacement=[0,1].map(()=>dataTexture(new Uint16Array(64*64*4),64,true));this.normals=[0,1].map(()=>dataTexture(new Uint16Array(64*64*4),64,true));
  this.fill(0,0);this.fill(1,1/15);
 }
 fill(slot:number,time:number){this.spectrum.update(time);encoded(this.spectrum.displacement,this.displacement[slot].image.data as Uint16Array);encoded(this.spectrum.normals,this.normals[slot].image.data as Uint16Array);this.displacement[slot].needsUpdate=true;this.normals[slot].needsUpdate=true;}
 advance(time:number){for(const pair of [this.displacement,this.normals]){(pair[0].image.data as Uint16Array).set(pair[1].image.data as Uint16Array);pair[0].needsUpdate=true;}this.fill(1,time);}
}
export class OceanSystem {
 readonly cascades=[new OceanCascade(173,.43,981,.55),new OceanCascade(67,.105,827,1.8)];
 readonly blend=uniform(0);readonly seaLevel=uniform(tideAt(0));readonly clock=uniform(0);
 readonly bed:THREE.DataTexture;readonly mesh:THREE.Mesh;
 private next=1/15;private offset=0;private shoreTime=-1;
 private coast:{i:number;x:number;z:number;bed:number;mask:number;foam:number;wet:number;depth:number}[]=[];
 constructor(sim:Simulation){
  const data=new Uint16Array(256*256*4);
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){const wx=((x+.5)/256-.5)*BED_SIZE,wz=((y+.5)/256-.5)*BED_SIZE,k=(y*256+x)*4;data[k]=THREE.DataUtils.toHalfFloat(sim.height(wx,wz));data[k+3]=THREE.DataUtils.toHalfFloat(1);
   const r=sim.radius(wx,wz);if(r>.82&&r<1.38)this.coast.push({i:k,x:wx,z:wz,bed:sim.height(wx,wz),mask:THREE.MathUtils.smoothstep(r,.83,.94)*(1-THREE.MathUtils.smoothstep(r,1.12,1.4)),foam:0,wet:0,depth:-1});}
  this.bed=dataTexture(data,256);
  const geometry=new THREE.PlaneGeometry(2,2,256,256),p=geometry.getAttribute('position');
  const stretch=(v:number)=>Math.sign(v)*(Math.abs(v)<.6?Math.abs(v)/.6*48:48+(Math.abs(v)-.6)/.4*202);
  for(let i=0;i<p.count;i++)p.setXY(i,stretch(p.getX(i)),stretch(p.getY(i)));
  this.mesh=new THREE.Mesh(geometry,oceanMaterial(this));this.mesh.name='Tidal ocean';this.mesh.rotation.x=-Math.PI/2;this.mesh.frustumCulled=false;
 }
 update(elapsed:number,dt:number){
  const t=elapsed+this.offset;this.clock.value=t;this.seaLevel.value=tideAt(t);
  if(t<this.next-1/15||t>this.next+.3){this.next=Math.floor(t*15)/15+1/15;for(const c of this.cascades){c.fill(0,this.next-1/15);c.fill(1,this.next);}}
  else while(t>=this.next){this.next+=1/15;for(const c of this.cascades)c.advance(this.next);}
  if(t-this.shoreTime>=1/15||t<this.shoreTime){
   const step=Math.max(0,Math.min(.15,t-this.shoreTime));this.shoreTime=t;
   const data=this.bed.image.data as Uint16Array;
   for(const c of this.coast){
    const depth=this.seaLevel.value+runupAt(c.x,c.z,t)*c.mask-c.bed;
    const edge=depth>0&&depth<.20;
    c.foam=Math.max(c.foam*Math.exp(-step*.85),edge&&depth>c.depth?.72:0);
    c.wet=depth>0?1:c.wet*Math.exp(-step*.035);c.depth=depth;
    data[c.i+1]=THREE.DataUtils.toHalfFloat(c.foam);data[c.i+2]=THREE.DataUtils.toHalfFloat(c.wet);
   }
   this.bed.needsUpdate=true;
  }
  this.blend.value=THREE.MathUtils.clamp((t-this.next+1/15)*15,0,1);
 }
 setTime(seconds:number,elapsed:number){this.offset=seconds-elapsed;this.update(elapsed,0);}
 get state(){return {level:this.seaLevel.value,phase:Math.cos(this.clock.value*2*Math.PI/TIDE_PERIOD)>0?'rising':'falling',seconds:this.clock.value,period:TIDE_PERIOD};}
}
