import {ISLAND_X,ISLAND_Z} from '../../shared/terrain';
// Tessendorf evolution with a Phillips spectrum. CPU IFFT feeds WebGPU textures.
export class FFT {
 readonly reverse:Int32Array;
 constructor(readonly n:number){if(n<2||(n&(n-1)))throw Error('FFT size must be a power of two');this.reverse=new Int32Array(n);const bits=Math.log2(n);for(let i=0;i<n;i++){let v=i,r=0;for(let b=0;b<bits;b++){r=(r<<1)|(v&1);v>>=1;}this.reverse[i]=r;}}
 transform(re:Float64Array,im:Float64Array,inverse=true){
  const n=this.n;
  const line=(offset:number,stride:number)=>{
   for(let i=0;i<n;i++){const j=this.reverse[i];if(j>i){const a=offset+i*stride,b=offset+j*stride;[re[a],re[b]]=[re[b],re[a]];[im[a],im[b]]=[im[b],im[a]];}}
   for(let len=2;len<=n;len*=2){const angle=(inverse?2:-2)*Math.PI/len,cr=Math.cos(angle),ci=Math.sin(angle);
    for(let start=0;start<n;start+=len){let wr=1,wi=0;for(let j=0;j<len/2;j++){const a=offset+(start+j)*stride,b=a+len/2*stride,tr=wr*re[b]-wi*im[b],ti=wr*im[b]+wi*re[b];re[b]=re[a]-tr;im[b]=im[a]-ti;re[a]+=tr;im[a]+=ti;const next=wr*cr-wi*ci;wi=wr*ci+wi*cr;wr=next;}}
   }
  };
  for(let y=0;y<n;y++)line(y*n,1);for(let x=0;x<n;x++)line(x,n);
  if(inverse)for(let i=0;i<re.length;i++){re[i]/=n*n;im[i]/=n*n;}
 }
}
export class OceanSpectrum {
 readonly fft:FFT;readonly h0r:Float64Array;readonly h0i:Float64Array;readonly omega:Float64Array;
 readonly kx:Float64Array;readonly kz:Float64Array;
 readonly fields:Float64Array[];readonly foam:Float32Array;readonly previousFoam:Float32Array;
 readonly displacement:Float32Array;readonly normals:Float32Array;
 private lastTime=0;
 constructor(readonly size=64,readonly length=173,readonly rms=.42,seed=8191,readonly windAngle=.65){
  this.fft=new FFT(size);const count=size*size;this.h0r=new Float64Array(count);this.h0i=new Float64Array(count);this.omega=new Float64Array(count);this.kx=new Float64Array(count);this.kz=new Float64Array(count);this.fields=Array.from({length:6},()=>new Float64Array(count));this.foam=new Float32Array(count);this.previousFoam=new Float32Array(count);this.displacement=new Float32Array(count*4);this.normals=new Float32Array(count*4);
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return((seed>>>0)+1)/4294967297;};
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const i=y*size+x,kx=2*Math.PI*(x<=size/2?x:x-size)/length,kz=2*Math.PI*(y<=size/2?y:y-size)/length,k=Math.hypot(kx,kz);this.kx[i]=kx;this.kz[i]=kz;
   if(!k||x===size/2||y===size/2)continue;
   const alignment=(kx*Math.cos(windAngle)+kz*Math.sin(windAngle))/k;
   const windLength=length>100?4.8:1.1;
   const spectrum=Math.exp(-1/(k*windLength)**2)/(k**4)*(.12+.88*alignment**4)*Math.exp(-((k*(length>100?.9:.45))**2));
   const amplitude=Math.sqrt(spectrum*.5),g=Math.sqrt(-2*Math.log(random())),angle=random()*Math.PI*2;
   this.h0r[i]=g*Math.cos(angle)*amplitude;this.h0i[i]=g*Math.sin(angle)*amplitude;this.omega[i]=Math.sqrt(9.81*k);
  }
  this.evolve(0);const current=Math.sqrt(this.fields[0].reduce((s,v)=>s+v*v,0)/count),scale=rms/current;
  for(let i=0;i<count;i++){this.h0r[i]*=scale;this.h0i[i]*=scale;}
  this.update(0);
 }
 private evolve(t:number){
  const n=this.size,[hr,hi,xr,xi,zr,zi]=this.fields;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
   const i=y*n+x,j=((n-y)%n)*n+(n-x)%n,c=Math.cos(this.omega[i]*t),s=Math.sin(this.omega[i]*t);
   const re=(this.h0r[i]+this.h0r[j])*c-(this.h0i[i]+this.h0i[j])*s;
   const im=(this.h0r[i]-this.h0r[j])*s+(this.h0i[i]-this.h0i[j])*c;
   hr[i]=re;hi[i]=im;const k=Math.hypot(this.kx[i],this.kz[i])||1;
   xr[i]=-im*this.kx[i]/k;xi[i]=re*this.kx[i]/k;zr[i]=-im*this.kz[i]/k;zi[i]=re*this.kz[i]/k;
  }
  this.fft.transform(hr,hi);this.fft.transform(xr,xi);this.fft.transform(zr,zi);
 }
 update(t:number){
  this.evolve(t);const dt=Math.max(0,Math.min(.25,t-this.lastTime));this.lastTime=t;
  const n=this.size,step=this.length/n,[h,,dx,,dz]=this.fields,chop=1.05;
  this.previousFoam.set(this.foam);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
   const i=y*n+x,l=y*n+(x+n-1)%n,r=y*n+(x+1)%n,d=((y+n-1)%n)*n+x,u=((y+1)%n)*n+x;
   const hx=(h[r]-h[l])/(2*step),hz=(h[u]-h[d])/(2*step),xx=1+chop*(dx[r]-dx[l])/(2*step),zz=1+chop*(dz[u]-dz[d])/(2*step),xz=chop*(dx[u]-dx[d])/(2*step),zx=chop*(dz[r]-dz[l])/(2*step);
   const jac=xx*zz-xz*zx,nx=hz*zx-zz*hx,ny=jac,nz=xz*hx-hz*xx,len=Math.hypot(nx,ny,nz)||1;
   const birth=Math.max(0,(.78-jac)*3.2)*Math.max(0,Math.min(1,h[i]/this.rms));
   const advected=this.previousFoam[i]*(1-dt*.2)+this.previousFoam[l]*dt*.2;
   this.foam[i]=Math.min(1,Math.max(birth,advected*Math.exp(-dt*.55)));
   const k=i*4;this.displacement[k]=dx[i]*chop;this.displacement[k+1]=h[i];this.displacement[k+2]=dz[i]*chop;this.displacement[k+3]=this.foam[i];
   this.normals[k]=nx/len;this.normals[k+1]=ny/len;this.normals[k+2]=nz/len;this.normals[k+3]=Math.max(0,h[i]/(this.rms*3));
  }
 }
}
export const TIDE_PERIOD=210;
export function tideAt(seconds:number){return .20+.115*Math.sin(seconds*2*Math.PI/TIDE_PERIOD);}
export function runupAt(x:number,z:number,seconds:number){
 const a=Math.atan2(z/ISLAND_Z,x/ISLAND_X),r=Math.hypot(x/ISLAND_X,z/ISLAND_Z)/(1+.045*Math.sin(a*5)+.025*Math.cos(a*3));
 // A shallow-water bore travels landward. Unequal phases break the ring into sets.
 return .19*Math.max(0,Math.sin(seconds*.73+r*24+x*.11+z*.08)+.4*Math.sin(seconds*1.13+r*37-x*.09+z*.13));
}
