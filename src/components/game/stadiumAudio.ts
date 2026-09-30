/** Original "Sunday Lights" sports-studio theme. Authored notes, synthesized locally. */
export function stadiumAudio() {
  const context = new AudioContext();
  const crowd = context.createGain(),
    music = context.createGain();
  crowd.gain.value = 0;
  music.gain.value = 0;
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -12;
  crowd.connect(limiter);
  music.connect(limiter);
  limiter.connect(context.destination);
  const noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) noiseData[i] = Math.random() * 2 - 1;
  const bed = context.createBufferSource();
  bed.buffer = noiseBuffer;
  bed.loop = true;
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 850;
  bed.connect(filter).connect(crowd);
  bed.start();
  let musicOn = false,
    crowdOn = false,
    volume = 0.3,
    beat = 0,
    next = 0;
  const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
  const note = (
    midi: number,
    when: number,
    duration: number,
    level: number,
    type: OscillatorType = "triangle",
  ) => {
    const o = context.createOscillator(),
      g = context.createGain(),
      f = context.createBiquadFilter();
    o.type = type;
    o.frequency.value = hz(midi);
    f.type = "lowpass";
    f.frequency.value = type === "sawtooth" ? 1400 : 4000;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(level, when + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, when + duration);
    o.connect(f).connect(g).connect(music);
    o.start(when);
    o.stop(when + duration + 0.02);
    o.onended = () => {
      o.disconnect();
      f.disconnect();
      g.disconnect();
    };
  };
  const drum = (when: number, snare: boolean) => {
    const g = context.createGain();
    g.gain.setValueAtTime(snare ? 0.12 : 0.2, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.13);
    g.connect(music);
    if (snare) {
      const s = context.createBufferSource(),
        f = context.createBiquadFilter();
      s.buffer = noiseBuffer;
      f.type = "highpass";
      f.frequency.value = 1400;
      s.connect(f).connect(g);
      s.start(when);
      s.stop(when + 0.14);
      s.onended = () => {
        s.disconnect();
        f.disconnect();
        g.disconnect();
      };
    } else {
      const o = context.createOscillator();
      o.frequency.setValueAtTime(130, when);
      o.frequency.exponentialRampToValueAtTime(44, when + 0.1);
      o.connect(g);
      o.start(when);
      o.stop(when + 0.14);
      o.onended = () => {
        o.disconnect();
        g.disconnect();
      };
    }
  };
  const chords = [
    [48, 55, 60, 63],
    [44, 51, 56, 60],
    [46, 53, 58, 62],
    [43, 50, 55, 62],
  ];
  const motif = [72, null, 67, 70, 75, 72, null, 67, 70, null, 74, 70, 67, 65, 63, null];
  const stepSeconds = 60 / 112 / 2;
  const timer = window.setInterval(() => {
    if (context.state !== "running") return;
    const duck = "speechSynthesis" in window && window.speechSynthesis.speaking ? 0.28 : 1;
    music.gain.setTargetAtTime(musicOn ? volume * 0.24 * duck : 0, context.currentTime, 0.12);
    if (!musicOn) {
      next = context.currentTime;
      return;
    }
    if (next < context.currentTime) next = context.currentTime + 0.03;
    while (next < context.currentTime + 0.15) {
      const chord = chords[Math.floor(beat / 8) % 4]!,
        local = beat % 8;
      if (local % 2 === 0) {
        drum(next, local === 2 || local === 6);
        note(chord[0]!, next, 0.18, 0.27);
      }
      if (local === 0 || local === 3 || local === 6)
        chord.slice(1).forEach((n) => note(n, next, 0.2, 0.07, "sawtooth"));
      const melody = motif[beat % motif.length];
      if (melody !== null && melody !== undefined) note(melody, next, 0.24, 0.095, "sawtooth");
      beat++;
      next += stepSeconds;
    }
  }, 70);
  return {
    context,
    setCrowd(on: boolean) {
      crowdOn = on;
      crowd.gain.cancelScheduledValues(context.currentTime);
      crowd.gain.setTargetAtTime(on ? 0.018 : 0, context.currentTime, 0.2);
    },
    setMusic(on: boolean, level: number) {
      musicOn = on;
      volume = level;
      if (!on) music.gain.setTargetAtTime(0, context.currentTime, .03);
    },
    cue(big = false) {
      if (context.state !== "running" || !crowdOn) return;
      const t = context.currentTime;
      crowd.gain.setTargetAtTime(big ? 0.1 : 0.06, t, 0.1);
      crowd.gain.setTargetAtTime(0.018, t + 1, 0.4);
      const o = context.createOscillator(),
        g = context.createGain();
      o.frequency.value = big ? 660 : 460;
      g.gain.setValueAtTime(0.025, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      o.connect(g).connect(limiter);
      o.start(t);
      o.stop(t + 0.15);
      o.onended = () => {
        o.disconnect();
        g.disconnect();
      };
    },
    close() {
      window.clearInterval(timer);
      bed.stop();
      return context.close();
    },
  };
}
