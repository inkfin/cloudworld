// 无采样素材：滤波噪声生成海浪，衰减谐波合成轻柔钢琴音色。
export class Soundscape {
  private context?: AudioContext;
  private master?: GainNode;
  private timer?: number;
  private note = 0;
  enabled = false;
  async toggle(): Promise<boolean> {
    if (!this.context) this.create();
    const ctx=this.context!;
    await ctx.resume();
    this.enabled=!this.enabled;
    this.master!.gain.setTargetAtTime(this.enabled ? .48 : 0,ctx.currentTime,.4);
    if(this.enabled) { this.schedule(); this.timer=window.setInterval(()=>this.schedule(),2200); }
    else window.clearInterval(this.timer);
    return this.enabled;
  }
  private create() {
    const ctx = this.context = new AudioContext();
    const master = this.master = ctx.createGain();master.gain.value=0;master.connect(ctx.destination);
    const buffer=ctx.createBuffer(2,ctx.sampleRate*12,ctx.sampleRate);
    for(let c=0;c<2;c++){const data=buffer.getChannelData(c);let last=0;for(let i=0;i<data.length;i++){last=(last+.025*(Math.random()*2-1))/1.025;data[i]=last*5;}}
    const source=ctx.createBufferSource();source.buffer=buffer;source.loop=true;
    const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1100;
    const wave=ctx.createGain();wave.gain.value=.31;
    const lfo=ctx.createOscillator();lfo.frequency.value=.095;const depth=ctx.createGain();depth.gain.value=.19;lfo.connect(depth).connect(wave.gain);lfo.start();
    source.connect(filter).connect(wave).connect(master);source.start();
  }
  private schedule() {
    if(!this.enabled)return;
    const melody=[64,67,71,74,71,67,62,66,69,73,69,66,60,64,67,71,67,64,62,66,69,67,66,62];
    const now=this.context!.currentTime;
    this.piano(melody[this.note%melody.length],now, .13);
    if(this.note%3===0)this.piano([48,50,45,47][Math.floor(this.note/6)%4],now,.1);
    if(this.note%2===0)this.piano(melody[(this.note+1)%melody.length],now+1.1,.065);
    this.note++;
  }
  private piano(midi:number,start:number,volume:number) {
    const ctx=this.context!,frequency=440*Math.pow(2,(midi-69)/12);
    for(const [harmonic,level] of [[1,1],[2,.32],[3,.1],[4,.035]]){
      const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.value=frequency*harmonic;
      gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(volume*level,start+.012);gain.gain.exponentialRampToValueAtTime(.0001,start+4.8/harmonic);
      osc.connect(gain).connect(this.master!);osc.start(start);osc.stop(start+5);osc.onended=()=>{osc.disconnect();gain.disconnect();};
    }
  }
}
