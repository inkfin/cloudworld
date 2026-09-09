import type { TimeOfDay } from './environment';
import type { Surface } from './world/spatial';
export type AudioBus = 'music'|'sea'|'wind'|'steps'|'voice';
export const defaultMix:Record<AudioBus,number>={music:.8,sea:.45,wind:.15,steps:.7,voice:.8};
export const scores:Record<TimeOfDay,{notes:number[];bass:number[];interval:number;volume:number;decay:number;brightness:number;harmony:number[]}>= {
  day:{notes:[72,76,79,83,79,76,74,77,81,84,81,77],bass:[48,53,45,55],interval:1.65,volume:.14,decay:3.6,brightness:.7,harmony:[0,4,7]},
  sunset:{notes:[65,69,72,76,72,69,64,67,71,74,71,67],bass:[41,48,45,40],interval:2.65,volume:.13,decay:4.8,brightness:.45,harmony:[0,7,12]},
  night:{notes:[69,76,71,64,72,67,76,69],bass:[33,40,36,43],interval:4.3,volume:.10,decay:6.2,brightness:.2,harmony:[0,12]},
};
export const ambienceProfiles:Record<TimeOfDay,{seaLevel:number;seaInterval:number;seaCutoff:number;seaRate:number;windLevel:number;windCutoff:number;gustRate:number}>= {
  day:{seaLevel:.20,seaInterval:6.8,seaCutoff:3300,seaRate:1,windLevel:.04,windCutoff:650,gustRate:.09},
  sunset:{seaLevel:.14,seaInterval:9.5,seaCutoff:2100,seaRate:.94,windLevel:.022,windCutoff:450,gustRate:.065},
  night:{seaLevel:.09,seaInterval:13,seaCutoff:1350,seaRate:.86,windLevel:.012,windCutoff:320,gustRate:.043},
};
export const stepLevels:Record<Surface,number>={sand:.22,grass:.19,wood:.24,stone:.29};
interface AudioFrame {period:TimeOfDay;cave:number;wind:number;distance:number;surface:Surface;running:boolean;paused:boolean;}
// 环境声、音乐和动作声分开混音。采样在首次开启声音时从本站加载。
export class Soundscape {
  private context?:AudioContext;
  private master?:GainNode;
  private buses={} as Record<AudioBus,GainNode>;
  private mix:Record<AudioBus,number>;
  private music?:GainNode;
  private seaLayer?:GainNode;
  private windGain?:GainNode;
  private windFilter?:BiquadFilterNode;
  private gust?:OscillatorNode;
  private room?:ConvolverNode;
  private caveResponse?:ConvolverNode;
  private stepRoom?:ConvolverNode;
  private assets=new Map<string,AudioBuffer>();
  private loading?:Promise<void>;
  private activeWaves=new Set<{filter:BiquadFilterNode;level:GainNode;reflection:GainNode;cutoff:number;volume:number}>();
  private nextNote=0;
  private nextSea=0;
  private note=0;
  private waveIndex=0;
  private stepIndex:Record<Surface,number>={sand:0,grass:0,wood:0,stone:0};
  private stride=0;
  private period:TimeOfDay='day';
  private cave=0;
  private lastShout=-Infinity;
  private suspended=false;
  enabled=false;
  readonly events={steps:{sand:0,grass:0,wood:0,stone:0},shouts:0,echoes:0,phrases:0,waves:0};
  constructor(mix:Partial<Record<AudioBus,number>>={}){this.mix={...defaultMix,...mix};}
  get state(){return {enabled:this.enabled,context:this.context?.state??'uninitialized',period:this.period,cave:this.cave,mix:{...this.mix},profile:{...ambienceProfiles[this.period]},events:this.events};}
  setMix(bus:AudioBus,value:number){
    this.mix[bus]=Math.max(0,Math.min(1,value));
    if(this.context)this.buses[bus].gain.setTargetAtTime(this.mix[bus],this.context.currentTime,.12);
  }
  async toggle(){
    if(!this.context)this.create();
    const ctx=this.context!;
    await ctx.resume();
    if(!this.loading)this.loading=this.loadAssets().catch(error=>{this.loading=undefined;throw error;});
    await this.loading;
    if(!this.enabled&&this.events.phrases>0){this.fadeLayer('music',ctx.currentTime);this.fadeLayer('seaLayer',ctx.currentTime);}
    this.enabled=!this.enabled;
    ctx.resume().catch(()=>{});
    this.master!.gain.setTargetAtTime(this.enabled?.6:0,ctx.currentTime,.18);
    this.nextNote=ctx.currentTime;this.nextSea=ctx.currentTime;this.stride=0;
    return this.enabled;
  }
  private async loadAssets(){
    const names=['sea-0','sea-1',...(['stone','grass','wood','sand'] as Surface[]).flatMap(s=>Array.from({length:4},(_,i)=>`${s}-${i}`))];
    await Promise.all(names.map(async name=>{
      if(this.assets.has(name))return;
      const response=await fetch(`${import.meta.env.BASE_URL}audio/${name}.wav`);
      if(!response.ok)throw Error(`无法加载音效 ${name}`);
      this.assets.set(name,await this.context!.decodeAudioData(await response.arrayBuffer()));
    }));
  }
  private create(){
    const ctx=this.context=new AudioContext();
    const master=this.master=ctx.createGain();master.gain.value=0;
    const headroom=ctx.createDynamicsCompressor();headroom.threshold.value=-8;headroom.knee.value=8;headroom.ratio.value=3;headroom.attack.value=.008;headroom.release.value=.2;master.connect(headroom).connect(ctx.destination);
    for(const bus of Object.keys(defaultMix) as AudioBus[]){const gain=this.buses[bus]=ctx.createGain();gain.gain.value=this.mix[bus];gain.connect(master);}
    this.music=ctx.createGain();this.music.connect(this.buses.music);
    this.seaLayer=ctx.createGain();this.seaLayer.connect(this.buses.sea);
    this.room=this.reverb(1.1,.012,2.7);const roomGain=ctx.createGain();roomGain.gain.value=.12;this.room.connect(roomGain).connect(this.buses.music);this.music.connect(this.room);
    this.caveResponse=this.reverb(2.5,.065,3.4);const caveGain=ctx.createGain();caveGain.gain.value=.23;this.caveResponse.connect(caveGain).connect(this.buses.voice);
    // 脚步只经过短、低电平反射，不送入喊声的长混响。
    this.stepRoom=this.reverb(.38,.022,4.2);const stepGain=ctx.createGain();stepGain.gain.value=.13;this.stepRoom.connect(stepGain).connect(this.buses.steps);
    const wind=ctx.createBufferSource();wind.buffer=this.windBuffer();wind.loop=true;
    const highpass=ctx.createBiquadFilter();highpass.type='highpass';highpass.frequency.value=90;
    this.windFilter=ctx.createBiquadFilter();this.windFilter.type='lowpass';this.windFilter.Q.value=.45;this.windFilter.frequency.value=650;
    this.windGain=ctx.createGain();this.windGain.gain.value=0;
    wind.connect(highpass).connect(this.windFilter).connect(this.windGain).connect(this.buses.wind);wind.start();
    // 低深度缓慢起伏，不扫描高 Q 共振峰，避免哨音和收音机噪声感。
    this.gust=ctx.createOscillator();this.gust.frequency.value=.09;
    const modulator=ctx.createGain();modulator.gain.value=.08;
    const envelope=ctx.createGain();envelope.gain.value=.92;
    this.gust.connect(modulator).connect(envelope.gain);this.windGain.disconnect();this.windGain.connect(envelope).connect(this.buses.wind);this.gust.start();
  }
  private windBuffer(){
    const ctx=this.context!,length=ctx.sampleRate*18,buffer=ctx.createBuffer(2,length,ctx.sampleRate);
    for(let channel=0;channel<2;channel++){
      const data=buffer.getChannelData(channel);let low=0,mid=0;
      for(let i=0;i<length;i++){const white=Math.random()*2-1;low=low*.997+white*.003;mid=mid*.96+white*.04;data[i]=(low*2+mid*.7);}
      // 将首尾半秒交叉混合后缩短循环，接缝处样值连续。
      const fade=ctx.sampleRate/2|0;
      for(let i=0;i<fade;i++){const t=i/fade;data[i]=data[length-fade+i]*(1-t)+data[i]*t;}
    }
    const trimmed=ctx.createBuffer(2,length-ctx.sampleRate/2,ctx.sampleRate);
    for(let c=0;c<2;c++)trimmed.getChannelData(c).set(buffer.getChannelData(c).subarray(0,trimmed.length));
    return trimmed;
  }
  private reverb(seconds:number,predelay:number,power:number){
    const ctx=this.context!,buffer=ctx.createBuffer(2,Math.floor(ctx.sampleRate*seconds),ctx.sampleRate);
    for(let ch=0;ch<2;ch++){
      const data=buffer.getChannelData(ch);let filtered=0;
      for(let i=Math.floor(predelay*ctx.sampleRate);i<data.length;i++){filtered=.65*filtered+.35*(Math.random()*2-1);data[i]=filtered*Math.pow(1-i/data.length,power);}
    }
    const convolver=ctx.createConvolver();convolver.buffer=buffer;return convolver;
  }
  update(_dt:number,frame:AudioFrame){
    const changed=frame.period!==this.period;this.period=frame.period;this.cave=frame.cave;
    if(!this.context)return;
    const ctx=this.context,now=ctx.currentTime;
    if(frame.paused){if(!this.suspended){this.suspended=true;void ctx.suspend();}return;}
    if(this.suspended){this.suspended=false;if(this.enabled)void ctx.resume();this.nextNote=now;this.nextSea=now;}
    if(changed){
      this.fadeLayer('music',now);this.fadeLayer('seaLayer',now);
      this.note=0;this.nextNote=now;this.nextSea=now;
    }
    const profile=ambienceProfiles[this.period];
    for(const wave of this.activeWaves){
      wave.filter.frequency.setTargetAtTime(wave.cutoff*(1-frame.cave*.72),now,.2);
      wave.level.gain.setTargetAtTime(wave.volume*(1-frame.cave*.5),now,.2);
      wave.reflection.gain.setTargetAtTime(frame.cave*.12,now,.2);
    }
    this.windGain!.gain.setTargetAtTime(profile.windLevel*(.8+frame.wind*.2)*(1+frame.cave*.25),now,.65);
    this.windFilter!.frequency.setTargetAtTime(profile.windCutoff*(1-frame.cave*.2),now,.65);
    this.gust!.frequency.setTargetAtTime(profile.gustRate,now,.65);
    if(!this.enabled||!this.assets.size){this.stride=0;return;}
    if(now>=this.nextNote){this.phrase(now);this.nextNote=now+scores[this.period].interval;}
    if(now>=this.nextSea){this.surge(now);this.nextSea=now+profile.seaInterval;}
    if(frame.distance<.0003){this.stride=0;return;}
    this.stride+=Math.min(frame.distance,.3);
    if(this.stride>(frame.running?.78:.66)){this.stride=0;this.footstep(frame.surface,frame.running);}
  }
  private fadeLayer(key:'music'|'seaLayer',now:number){
    const old=this[key]!;old.gain.cancelScheduledValues(now);old.gain.setTargetAtTime(0,now,.22);
    setTimeout(()=>old.disconnect(),8000);
    const next=this[key]=this.context!.createGain();next.gain.setValueAtTime(0,now);next.gain.linearRampToValueAtTime(1,now+.65);next.connect(key==='music'?this.buses.music:this.buses.sea);if(key==='music')next.connect(this.room!);
  }
  private surge(now:number){
    const ctx=this.context!,profile=ambienceProfiles[this.period];
    const buffer=this.assets.get(`sea-${this.waveIndex++%2}`)!;
    const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain(),levelGain=ctx.createGain(),pan=ctx.createStereoPanner();
    source.buffer=buffer;source.playbackRate.value=profile.seaRate;filter.type='lowpass';filter.frequency.value=profile.seaCutoff*(1-this.cave*.72);filter.Q.value=.5;
    const length=buffer.duration/profile.seaRate,level=profile.seaLevel*(1-this.cave*.5);
    levelGain.gain.value=level;gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(1,now+.3);gain.gain.setValueAtTime(1,now+Math.max(.4,length-.65));gain.gain.linearRampToValueAtTime(0,now+length);
    pan.pan.value=this.waveIndex%2?.14:-.14;
    source.connect(filter).connect(levelGain).connect(gain).connect(pan).connect(this.seaLayer!);
    const reflection=ctx.createGain();reflection.gain.value=this.cave*.12;
    const delay=ctx.createDelay(1);delay.delayTime.value=.21;
    gain.connect(delay).connect(reflection).connect(this.seaLayer!);
    const active={filter,level:levelGain,reflection,cutoff:profile.seaCutoff,volume:profile.seaLevel};this.activeWaves.add(active);
    source.start(now);source.stop(now+length+.05);source.onended=()=>{this.activeWaves.delete(active);setTimeout(()=>{source.disconnect();filter.disconnect();levelGain.disconnect();gain.disconnect();pan.disconnect();reflection.disconnect();delay.disconnect();},350);};
    this.events.waves++;
  }
  private phrase(now:number){
    const score=scores[this.period],melody=score.notes[this.note%score.notes.length];
    this.piano(melody,now,score.volume);
    if(this.period==='day'){
      this.piano(melody-12,now+.48,.055);this.piano(melody-5,now+.98,.04);
    }else if(this.period==='sunset'){
      this.piano(melody-7,now+.09,.075);this.piano(melody-12,now+.2,.065);
    }
    if(this.note%2===0){const bass=score.bass[Math.floor(this.note/2)%score.bass.length];for(let i=0;i<score.harmony.length;i++)this.piano(bass+score.harmony[i],now+i*.055,.055/(1+i*.3));}
    this.note++;this.events.phrases++;
  }
  private piano(midi:number,start:number,volume:number){
    const ctx=this.context!,score=scores[this.period],frequency=440*Math.pow(2,(midi-69)/12),layer=this.music!;
    const voice=ctx.createGain(),pan=ctx.createStereoPanner();pan.pan.value=Math.max(-.45,Math.min(.45,(midi-64)/45));voice.gain.value=volume;
    voice.connect(pan).connect(layer);
    // 三根轻微失谐的弦与较快衰减的高次谐波，保留琴槌起音，避免纯正弦提示音。
    let remaining=0;
    for(const detune of [-2.2,0,2.2])for(let harmonic=1;harmonic<=5;harmonic++){
      const oscillator=ctx.createOscillator(),gain=ctx.createGain();oscillator.frequency.value=frequency*harmonic;oscillator.detune.value=detune;
      const level=(harmonic===1?1:score.brightness/Math.pow(harmonic,1.55))/3,decay=score.decay/Math.sqrt(harmonic);
      gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(level,start+.004+harmonic*.001);gain.gain.exponentialRampToValueAtTime(.0001,start+decay);
      oscillator.connect(gain).connect(voice);oscillator.start(start);oscillator.stop(start+decay+.02);remaining++;
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();if(--remaining===0){voice.disconnect();pan.disconnect();}};
    }
  }
  private footstep(surface:Surface,running:boolean){
    const ctx=this.context!,now=ctx.currentTime,index=this.stepIndex[surface]++%4;
    const source=ctx.createBufferSource(),gain=ctx.createGain(),pan=ctx.createStereoPanner();source.buffer=this.assets.get(`${surface}-${index}`)!;
    source.playbackRate.value=1+((index%3)-1)*.018;gain.gain.value=stepLevels[surface]*(running?1.16:1);pan.pan.value=index%2?.08:-.08;
    source.connect(gain).connect(pan).connect(this.buses.steps);
    const reflection=ctx.createGain();reflection.gain.value=this.cave;gain.connect(reflection).connect(this.stepRoom!);
    // 石面脚步直接使用短促接触采样；不加音高滑动，也不制造长金属尾音。
    source.start(now);source.onended=()=>{source.disconnect();gain.disconnect();pan.disconnect();reflection.disconnect();};
    this.events.steps[surface]++;
  }
  shout(cave=this.cave):boolean{
    if(!this.enabled||!this.context||this.context.currentTime-this.lastShout<2.4)return false;
    this.cave=Math.max(0,Math.min(1,cave));
    const ctx=this.context,now=ctx.currentTime;this.lastShout=now;this.events.shouts++;if(this.cave>.2)this.events.echoes++;
    const voice=ctx.createGain();voice.gain.setValueAtTime(0,now);voice.gain.linearRampToValueAtTime(.26,now+.07);voice.gain.setValueAtTime(.22,now+.26);voice.gain.exponentialRampToValueAtTime(.0001,now+.72);voice.connect(this.buses.voice);
    const send=ctx.createGain();send.gain.value=this.cave;voice.connect(send).connect(this.caveResponse!);
    const taps:AudioNode[]=[];
    for(const [time,level] of [[.24,.3],[.51,.16],[.86,.07]]){
      const delay=ctx.createDelay(1),gain=ctx.createGain(),filter=ctx.createBiquadFilter();delay.delayTime.value=time;gain.gain.value=level*this.cave;filter.type='lowpass';filter.frequency.value=1500;voice.connect(delay).connect(filter).connect(gain).connect(this.buses.voice);taps.push(delay,gain,filter);
    }
    for(const [formant,q,level] of [[780,5,.75],[1180,7,.4],[2650,9,.12]]){
      const oscillator=ctx.createOscillator(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();oscillator.type='sawtooth';oscillator.frequency.setValueAtTime(340,now);oscillator.frequency.linearRampToValueAtTime(420,now+.18);oscillator.frequency.exponentialRampToValueAtTime(275,now+.68);filter.type='bandpass';filter.frequency.value=formant;filter.Q.value=q;gain.gain.value=level;
      oscillator.connect(filter).connect(gain).connect(voice);oscillator.start(now);oscillator.stop(now+.75);oscillator.onended=()=>{oscillator.disconnect();filter.disconnect();gain.disconnect();};
    }
    setTimeout(()=>{voice.disconnect();send.disconnect();taps.forEach(node=>node.disconnect());},3500);return true;
  }
}
