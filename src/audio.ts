import type { TimeOfDay } from './environment';
import type { Surface } from './world/spatial';
export const scores:Record<TimeOfDay,{notes:number[];bass:number[];interval:number;volume:number}>={
  day:{notes:[64,67,71,74,71,67,62,66,69,73,69,66],bass:[48,50,45,47],interval:2.2,volume:.115},
  sunset:{notes:[60,65,69,72,69,65,57,60,64,67,64,60],bass:[41,45,48,43],interval:2.9,volume:.10},
  night:{notes:[57,64,69,71,64,60,55,62,67,69,62,59],bass:[33,40,36,43],interval:3.8,volume:.075},
};
interface AudioFrame {period:TimeOfDay;cave:number;wind:number;distance:number;surface:Surface;running:boolean;paused:boolean;}
// 所有声音在本地合成；喊叫使用元音共振峰，不调用麦克风或语音服务。
export class Soundscape {
  private context?:AudioContext;
  private master?:GainNode;
  private music?:GainNode;
  private dry?:GainNode;
  private wet?:GainNode;
  private windGain?:GainNode;
  private oceanFilter?:BiquadFilterNode;
  private caveReverb?:ConvolverNode;
  private echoInput?:GainNode;
  private noiseBuffer?:AudioBuffer;
  private nextNote=0;
  private note=0;
  private stride=0;
  private period:TimeOfDay='day';
  private cave=0;
  private lastShout=-Infinity;
  private suspended=false;
  enabled=false;
  readonly events={steps:{sand:0,grass:0,wood:0,stone:0},shouts:0,echoes:0};
  get state(){return {enabled:this.enabled,context:this.context?.state??'uninitialized',period:this.period,cave:this.cave,events:this.events};}
  async toggle(){
    if(!this.context)this.create();
    await this.context!.resume();this.enabled=!this.enabled;
    this.master!.gain.setTargetAtTime(this.enabled?.48:0,this.context!.currentTime,.2);
    this.nextNote=this.context!.currentTime+.08;this.stride=0;
    return this.enabled;
  }
  private create(){
    const ctx=this.context=new AudioContext(),master=this.master=ctx.createGain();master.gain.value=0;master.connect(ctx.destination);
    this.music=ctx.createGain();this.music.connect(master);
    this.noiseBuffer=ctx.createBuffer(1,ctx.sampleRate*4,ctx.sampleRate);const data=this.noiseBuffer.getChannelData(0);let last=0;
    for(let i=0;i<data.length;i++){last=(last+.035*(Math.random()*2-1))/1.035;data[i]=last*5;}
    const impulse=ctx.createBuffer(2,ctx.sampleRate*3.7,ctx.sampleRate);
    for(let ch=0;ch<2;ch++){const out=impulse.getChannelData(ch);for(let i=0;i<out.length;i++)out[i]=(Math.random()*2-1)*Math.pow(1-i/out.length,3.5)*.55;}
    this.caveReverb=ctx.createConvolver();this.caveReverb.buffer=impulse;
    this.wet=ctx.createGain();this.wet.gain.value=0;this.caveReverb.connect(this.wet).connect(master);
    const sea=ctx.createBufferSource();sea.buffer=this.noiseBuffer;sea.loop=true;
    this.oceanFilter=ctx.createBiquadFilter();this.oceanFilter.type='lowpass';this.oceanFilter.frequency.value=1100;
    const swell=ctx.createGain();swell.gain.value=.32;
    this.dry=ctx.createGain();this.dry.gain.value=1;
    sea.connect(this.oceanFilter).connect(swell);swell.connect(this.dry).connect(master);swell.connect(this.caveReverb);sea.start();
    const lfo=ctx.createOscillator(),depth=ctx.createGain();lfo.frequency.value=.095;depth.gain.value=.16;lfo.connect(depth).connect(swell.gain);lfo.start();
    const wind=ctx.createBufferSource();wind.buffer=this.noiseBuffer;wind.loop=true;
    const windFilter=ctx.createBiquadFilter();windFilter.type='bandpass';windFilter.frequency.value=430;windFilter.Q.value=2.4;
    this.windGain=ctx.createGain();this.windGain.gain.value=.02;wind.connect(windFilter).connect(this.windGain).connect(master);this.windGain.connect(this.caveReverb);wind.start();
    const gust=ctx.createOscillator(),gustDepth=ctx.createGain();gust.frequency.value=.17;gustDepth.gain.value=95;gust.connect(gustDepth).connect(windFilter.frequency);gust.start();
    // 多次反射只用于动作声，海浪走混响总线，避免反馈无限累积。
    this.echoInput=ctx.createGain();
    for(const [delay,level] of [[.24,.42],[.49,.28],[.81,.15],[1.16,.07]]){
      const tap=ctx.createDelay(2),gain=ctx.createGain(),filter=ctx.createBiquadFilter();tap.delayTime.value=delay;gain.gain.value=level;filter.type='lowpass';filter.frequency.value=1800-delay*800;this.echoInput.connect(tap).connect(filter).connect(gain).connect(this.caveReverb);gain.connect(master);
    }
  }
  update(dt:number,frame:AudioFrame){
    const changed=frame.period!==this.period;this.period=frame.period;this.cave=frame.cave;
    if(!this.context)return;
    const ctx=this.context,now=ctx.currentTime;
    if(frame.paused){if(!this.suspended){this.suspended=true;void ctx.suspend();}return;}
    if(this.suspended){this.suspended=false;if(this.enabled)void ctx.resume();this.nextNote=now+.1;}
    if(changed){
      const old=this.music!;old.gain.setTargetAtTime(0,now,.22);setTimeout(()=>old.disconnect(),6500);
      this.music=ctx.createGain();this.music.connect(this.master!);this.music.gain.setValueAtTime(0,now);this.music.gain.linearRampToValueAtTime(1,now+.9);this.note=0;this.nextNote=now+.3;
    }
    this.wet!.gain.setTargetAtTime(frame.cave*.85,now,.25);
    this.dry!.gain.setTargetAtTime(1-frame.cave*.66,now,.25);
    this.oceanFilter!.frequency.setTargetAtTime(1200-frame.cave*880,now,.25);
    this.windGain!.gain.setTargetAtTime(.035*frame.wind+frame.cave*.15*(.8+Math.sin(now*.4)*.2),now,.2);
    if(!this.enabled){this.stride=0;return;}
    if(now>=this.nextNote){this.phrase(now);this.nextNote=now+scores[this.period].interval;}
    if(frame.distance<.0003){this.stride=0;return;}
    this.stride+=Math.min(frame.distance,.3);
    if(this.stride> (frame.running?.78:.66)){this.stride=0;this.footstep(frame.surface,frame.running);}
  }
  private phrase(now:number){
    const score=scores[this.period];this.piano(score.notes[this.note%score.notes.length],now,score.volume);
    if(this.note%3===0)this.piano(score.bass[Math.floor(this.note/3)%score.bass.length],now,.07);
    if(this.period==='day'&&this.note%2===0)this.piano(score.notes[(this.note+1)%score.notes.length],now+1.05,.045);
    this.note++;
  }
  private piano(midi:number,start:number,volume:number){
    const ctx=this.context!,freq=440*Math.pow(2,(midi-69)/12);
    for(const [partial,level] of [[1,1],[2,.27],[3,.075],[4,.025]]){
      const osc=ctx.createOscillator(),gain=ctx.createGain();osc.frequency.value=freq*partial;
      gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(volume*level,start+.015);gain.gain.exponentialRampToValueAtTime(.0001,start+4.5/partial);
      osc.connect(gain).connect(this.music!);osc.start(start);osc.stop(start+4.6);osc.onended=()=>{osc.disconnect();gain.disconnect();};
    }
  }
  private footstep(surface:Surface,running:boolean){
    const ctx=this.context!,now=ctx.currentTime;this.events.steps[surface]++;
    const params={sand:{f:750,q:.5,d:.18,g:.65,tone:0},grass:{f:1900,q:.8,d:.12,g:.48,tone:0},wood:{f:520,q:2,d:.09,g:.32,tone:155},stone:{f:3100,q:3,d:.065,g:.24,tone:710}}[surface];
    const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();source.buffer=this.noiseBuffer!;
    filter.type='bandpass';filter.frequency.value=params.f;filter.Q.value=params.q;
    gain.gain.setValueAtTime(params.g*(running?1.3:1),now);gain.gain.exponentialRampToValueAtTime(.0001,now+params.d);
    source.connect(filter).connect(gain);gain.connect(this.master!);if(this.cave>.15)gain.connect(this.caveReverb!);
    source.start(now,Math.random()*2);source.stop(now+params.d+.02);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
    if(params.tone){const osc=ctx.createOscillator(),g=ctx.createGain();osc.frequency.setValueAtTime(params.tone,now);osc.frequency.exponentialRampToValueAtTime(params.tone*.6,now+.1);g.gain.setValueAtTime(.13,now);g.gain.exponentialRampToValueAtTime(.0001,now+.16);osc.connect(g).connect(this.master!);if(this.cave>.15)g.connect(this.caveReverb!);osc.start();osc.stop(now+.17);osc.onended=()=>{osc.disconnect();g.disconnect();};}
  }
  shout():boolean {
    if(!this.enabled||!this.context||this.context.currentTime-this.lastShout<2.4)return false;
    const ctx=this.context,now=ctx.currentTime;this.lastShout=now;this.events.shouts++;if(this.cave>.2)this.events.echoes++;
    const voice=ctx.createGain();voice.gain.setValueAtTime(0,now);voice.gain.linearRampToValueAtTime(.22,now+.07);voice.gain.setValueAtTime(.19,now+.26);voice.gain.exponentialRampToValueAtTime(.0001,now+.72);
    voice.connect(this.master!);
    const echo=ctx.createGain();echo.gain.value=this.cave;voice.connect(echo).connect(this.echoInput!);voice.connect(this.caveReverb!);
    for(const [formant,q,level] of [[780,5,.75],[1180,7,.4],[2650,9,.12]]){
      const oscillator=ctx.createOscillator(),filter=ctx.createBiquadFilter(),levelGain=ctx.createGain();oscillator.type='sawtooth';oscillator.frequency.setValueAtTime(340,now);oscillator.frequency.linearRampToValueAtTime(420,now+.18);oscillator.frequency.exponentialRampToValueAtTime(275,now+.68);filter.type='bandpass';filter.frequency.value=formant;filter.Q.value=q;levelGain.gain.value=level;
      oscillator.connect(filter).connect(levelGain).connect(voice);oscillator.start(now);oscillator.stop(now+.75);oscillator.onended=()=>{oscillator.disconnect();filter.disconnect();levelGain.disconnect();};
    }
    setTimeout(()=>{voice.disconnect();echo.disconnect();},1700);return true;
  }
}
