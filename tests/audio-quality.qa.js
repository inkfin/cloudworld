// Full rendered-audio regressions; no microphone or output-device capture.
async function checkAudioQuality() {
  const { Soundscape, defaultMix }=await import('/src/audio.ts');
  const Saved=window.AudioContext,originalRandom=Math.random;
  const zero={music:0,sea:0,wind:0,steps:0,voice:0};
  const results={}, clips={};
  async function render({bus,period='day',surface='stone',cave=0,switchTo,seconds=5}){
    let context,seed=501;
    Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};
    window.AudioContext=class extends OfflineAudioContext{constructor(){super(2,48000*seconds,48000);context=this;}resume(){return Promise.resolve();}};
    const sound=new Soundscape({...zero,[bus]:defaultMix[bus]});
    try{
      await sound.toggle();
      const frame={period,cave,wind:.55,distance:0,surface,running:false,paused:false};
      sound.update(0,frame);
      const suspended=bus==='steps'?context.suspend(.6):switchTo?context.suspend(2):null;
      const rendering=context.startRendering();
      if(suspended){await suspended;if(bus==='steps'){for(let i=0;i<3;i++)sound.update(0,{...frame,distance:.3});}else sound.update(0,{...frame,period:switchTo});await OfflineAudioContext.prototype.resume.call(context);}
      const buffer=await rendering;return Array.from(buffer.getChannelData(0));
    }finally{window.AudioContext=Saved;Math.random=originalRandom;}
  }
  const rms=(data,start=0,end=data.length/48000)=>{let sum=0;for(let i=start*48000|0;i<Math.min(data.length,end*48000);i++)sum+=data[i]**2;return Math.sqrt(sum/((end-start)*48000));};
  const difference=(a,b)=>Math.sqrt(a.reduce((s,x,i)=>s+(x-b[i])**2,0)/(a.reduce((s,x)=>s+x*x,0)||1));
  function check(pass,message){if(!pass)throw Error(message);}
  try{
    for(const bus of ['music','sea','wind']){
      const day=await render({bus}),sunset=await render({bus,period:'sunset'}),night=await render({bus,period:'night'});
      const metrics={dayRms:rms(day),sunsetRms:rms(sunset),nightRms:rms(night),dayNightDifference:difference(day,night),daySunsetDifference:difference(day,sunset)};
      check(metrics.dayNightDifference>.2&&metrics.daySunsetDifference>.1,`${bus} must actually sound different across periods`);
      results[bus]=metrics;clips[`${bus}-day`]=day;clips[`${bus}-sunset`]=sunset;clips[`${bus}-night`]=night;
    }
    check(results.wind.dayRms<results.music.dayRms*.06,`wind must stay well below music: ${JSON.stringify(results)}`);
    check(results.wind.nightRms<results.wind.dayRms*.5,'night wind must become quieter');
    check(results.sea.nightRms<results.sea.dayRms*.65,'night tide must become more distant');
    const day=clips['sea-day'],switched=await render({bus:'sea',switchTo:'night'});
    check(difference(day.slice(3*48000),switched.slice(3*48000))>.2,'live period switch must change already playing tide');
    for(const surface of ['sand','grass','wood','stone']){
      const clip=await render({bus:'steps',surface,cave:surface==='stone'?1:0,seconds:2});
      const metrics={attack:rms(clip,.6,.78),tail:rms(clip,1.05,1.8),peak:Math.max(...clip.map(Math.abs))};
      check(metrics.attack>.001,`${surface} audible attack`);check(metrics.peak<.75,`${surface} headroom`);
      if(surface==='stone')check(metrics.tail<metrics.attack*.03,'stone should be a dry short contact, not a long pitched/metallic tail');
      results[surface]=metrics;clips[`step-${surface}`]=clip;
    }
    check(difference(clips['step-stone'],clips['step-wood'])>.3,'wood and stone need different source textures');
    // Retain short audition renders for this QA session only, not production assets.
    window.__audioAuditions=clips;
    return results;
  }finally{window.AudioContext=Saved;Math.random=originalRandom;}
}
