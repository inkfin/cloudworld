// Run through page.evaluate in a live browser on the Vite development site.
// Offline rendering isolates the synthesized voice from seeded ambient noise.
async function checkAudio() {
  const { Soundscape } = await import('/src/audio.ts');
  const Saved = window.AudioContext, random = Math.random;
  async function render(cave, shout) {
    let ctx, seed = 923;
    Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
    window.AudioContext = class extends OfflineAudioContext {
      constructor() { super(2, 240000, 48000); ctx = this; }
      resume() { return Promise.resolve(); }
    };
    const sound = new Soundscape();
    await sound.toggle();
    sound.update(0, { period: 'day', cave, wind: .5, distance: 0, surface: 'stone', running: false, paused: false });
    if (shout) sound.shout();
    Math.random = random; window.AudioContext = Saved;
    const result = await ctx.startRendering();
    return result.getChannelData(0);
  }
  try {
    const indoor = await render(1, true), indoorBase = await render(1, false);
    const outdoor = await render(0, true), outdoorBase = await render(0, false);
    const energy = (signal, base, start, end) => {
      let sum = 0;
      for (let i = start * 48000; i < end * 48000; i++) sum += (signal[i] - base[i]) ** 2;
      return Math.sqrt(sum / ((end - start) * 48000));
    };
    const result = { indoorTail: energy(indoor, indoorBase, 1, 2.5), outdoorTail: energy(outdoor, outdoorBase, 1, 2.5), voiceRms: energy(indoor, indoorBase, 0, .75) };
    if (!(result.indoorTail > result.outdoorTail * 10 && result.voiceRms > .0001)) throw new Error(`Echo test failed: ${JSON.stringify(result)}`);
    return result;
  } finally { Math.random = random; window.AudioContext = Saved; }
}
