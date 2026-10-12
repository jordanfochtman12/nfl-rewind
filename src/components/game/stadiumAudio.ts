import { NETWORK_BPM, scoreStep } from "./studioScore";
import { DRAFT_BPM, draftScoreStep } from "./draftScore";
/** Original "Sunday Lights / Network Mix": layered brass, strings, bass and breakbeat percussion. */
export function stadiumAudio(theme: "network" | "draft" = "network") {
  const context = new AudioContext();
  const crowd = context.createGain(),
    music = context.createGain();
  crowd.gain.value = 0;
  music.gain.value = 0;
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -12;
  crowd.connect(limiter);
  music.connect(limiter);
  const room = context.createConvolver();
  const impulse = context.createBuffer(
    2,
    Math.floor(context.sampleRate * 1.25),
    context.sampleRate,
  );
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < data.length; i++)
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3) * 0.3;
  }
  room.buffer = impulse;
  const send = context.createGain();
  send.gain.value = 0.16;
  music.connect(room).connect(send).connect(limiter);
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
    f.frequency.setValueAtTime(type === "sawtooth" ? 650 : 4000, when);
    if (type === "sawtooth") {
      f.frequency.exponentialRampToValueAtTime(3100, when + 0.055);
      f.frequency.exponentialRampToValueAtTime(850, when + Math.max(0.1, duration));
    }
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(level, when + (type === "sawtooth" ? 0.025 : 0.012));
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
  const cymbal = (when: number, crash = false) => {
    const source = context.createBufferSource(),
      filter = context.createBiquadFilter(),
      gain = context.createGain();
    source.buffer = noiseBuffer;
    filter.type = "highpass";
    filter.frequency.value = crash ? 5000 : 8500;
    const duration = crash ? 1.1 : 0.055;
    gain.gain.setValueAtTime(crash ? 0.065 : 0.025, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    source.connect(filter).connect(gain).connect(music);
    source.start(when);
    source.stop(when + duration + 0.01);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  };
  const stepSeconds = 60 / (theme === "draft" ? DRAFT_BPM : NETWORK_BPM) / 2;
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
      const s = theme === "draft" ? draftScoreStep(beat) : scoreStep(beat);
      cymbal(next, s.crash);
      if (s.beat === 0 || s.beat === 4 || s.beat === 7) drum(next, false);
      if (s.beat === 2 || s.beat === 6 || s.fill) drum(next, true);
      if (s.fill) drum(next + stepSeconds / 2, true);
      note(s.root - 12 + (s.beat === 5 ? 12 : 0), next, 0.17, 0.24, "triangle");
      if (s.brass)
        s.chord.forEach((n) => {
          note(n, next, s.beat === 0 ? 0.4 : 0.19, 0.047, "sawtooth");
          note(n + 0.07, next + 0.007, 0.23, 0.022, "sawtooth");
        });
      // Sixteenth-note string pulse, softer during the bridge.
      const arp = s.chord[(s.beat + Math.floor(beat / 8)) % 4]!;
      note(arp + 12, next, 0.12, s.section === 2 ? 0.025 : 0.04, "triangle");
      note(s.chord[(s.beat + 1) % 4]! + 12, next + stepSeconds / 2, 0.1, 0.023, "triangle");
      if (s.melody !== null && s.melody !== undefined) {
        note(s.melody, next, s.section === 2 ? 0.38 : 0.23, 0.075, "sawtooth");
        note(s.melody - 12, next, 0.3, 0.035, "triangle");
      }
      beat++;
      next += stepSeconds;
    }
  }, 70);
  // The crowd's resting level: a murmur early, a roar in a one-score fourth quarter.
  let base = 0.018;
  return {
    context,
    setCrowd(on: boolean) {
      crowdOn = on;
      crowd.gain.cancelScheduledValues(context.currentTime);
      crowd.gain.setTargetAtTime(on ? base : 0, context.currentTime, 0.2);
    },
    /** 0 (a quiet first quarter) to 1 (overtime, the building shaking). Builds and settles slowly. */
    setIntensity(level: number) {
      base = 0.012 + 0.05 * Math.max(0, Math.min(1, level));
      if (crowdOn) crowd.gain.setTargetAtTime(base, context.currentTime, 1.6);
    },
    setMusic(on: boolean, level: number) {
      musicOn = on;
      volume = level;
      if (!on) music.gain.setTargetAtTime(0, context.currentTime, 0.03);
    },
    cue(big = false) {
      if (context.state !== "running" || !crowdOn) return;
      const t = context.currentTime;
      crowd.gain.setTargetAtTime(big ? 0.1 : 0.06, t, 0.1);
      crowd.gain.setTargetAtTime(base, t + 1, 0.4);
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
