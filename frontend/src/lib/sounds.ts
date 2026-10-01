type Tone = {
  freq: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
};

let context: AudioContext | null = null;
let muted = false;

function ensureContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!context) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    context = new Ctor();
  }
  if (context.state === "suspended") void context.resume();
  return context;
}

function play(tones: Tone[]) {
  if (muted) return;
  const ctx = ensureContext();
  if (!ctx) return;
  const start = ctx.currentTime;
  for (const tone of tones) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = tone.type ?? "sine";
    oscillator.frequency.value = tone.freq;
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    const at = start + (tone.delay ?? 0);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(tone.gain ?? 0.07, at + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + tone.duration);
    oscillator.start(at);
    oscillator.stop(at + tone.duration + 0.03);
  }
}

export const sounds = {
  setMuted(value: boolean) {
    muted = value;
    try {
      localStorage.setItem("humanchess.muted", value ? "1" : "0");
    } catch {
      /* stil */
    }
  },
  isMuted() {
    return muted;
  },
  load() {
    try {
      muted = localStorage.getItem("humanchess.muted") === "1";
    } catch {
      muted = false;
    }
    return muted;
  },
  move() {
    play([{ freq: 320, duration: 0.06, type: "triangle", gain: 0.06 }]);
  },
  capture() {
    play([
      { freq: 170, duration: 0.09, type: "square", gain: 0.06 },
      { freq: 95, duration: 0.12, type: "sawtooth", gain: 0.05, delay: 0.01 },
    ]);
  },
  check() {
    play([
      { freq: 880, duration: 0.08, gain: 0.06 },
      { freq: 1175, duration: 0.1, gain: 0.06, delay: 0.08 },
    ]);
  },
  end() {
    play([
      { freq: 660, duration: 0.15, gain: 0.07 },
      { freq: 523, duration: 0.18, gain: 0.07, delay: 0.14 },
      { freq: 392, duration: 0.28, gain: 0.07, delay: 0.3 },
    ]);
  },
};
