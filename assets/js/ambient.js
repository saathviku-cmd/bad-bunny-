/* ==========================================================
   TEAM AANYA — generative ambient music
   A light, slowly evolving soundtrack made with the Web Audio API:
   soft chord pads, sparse bell notes with echo, and a low root.
   Nothing plays until the visitor presses a sound button.
   The hangar can call window.aanyaAudio.setProgress(0..1) to
   brighten the sound as the camera walks down the hall.
   ========================================================== */
(() => {
  "use strict";
  const buttons = [...document.querySelectorAll("[data-sound-toggle]")];
  if (!buttons.length) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) { buttons.forEach((b) => (b.hidden = true)); return; }

  // Dmaj7 → Bm9 → Gmaj7 → A(add9): bright, calm, no strong resolution.
  const CHORDS = [
    [50, 54, 57, 61, 64],
    [47, 50, 54, 57, 61],
    [43, 47, 50, 54, 57],
    [45, 49, 52, 57, 59],
  ];
  const CHORD_SEC = 8;
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  let ctx, master, padBus, bellBus, filter, timer = null, on = false;
  let chordIdx = 0, nextChordAt = 0, nextBellAt = 0;

  function build() {
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 3;
    master.connect(comp).connect(ctx.destination);

    // reverb from a generated noise impulse
    const verb = ctx.createConvolver();
    const len = ctx.sampleRate * 4.5, imp = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = imp.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    verb.buffer = imp;
    const wet = ctx.createGain(); wet.gain.value = 0.55;
    verb.connect(wet).connect(master);

    filter = ctx.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 900; filter.Q.value = 0.4;
    padBus = ctx.createGain(); padBus.gain.value = 0.16;
    padBus.connect(filter); filter.connect(master); filter.connect(verb);

    // bells go through a soft feedback echo
    bellBus = ctx.createGain(); bellBus.gain.value = 0.07;
    const delay = ctx.createDelay(2); delay.delayTime.value = 0.48;
    const fb = ctx.createGain(); fb.gain.value = 0.38;
    const tone = ctx.createBiquadFilter(); tone.type = "lowpass"; tone.frequency.value = 2400;
    bellBus.connect(master); bellBus.connect(verb);
    bellBus.connect(delay); delay.connect(tone).connect(fb).connect(delay); tone.connect(verb);
  }

  function pad(notes, t) {
    const att = 3, hold = CHORD_SEC - 1, rel = 4;
    notes.forEach((m, i) => {
      [-5, 5].forEach((det) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = i === 0 ? "sine" : "triangle";
        o.frequency.value = hz(m); o.detune.value = det;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(i === 0 ? 0.5 : 0.22, t + att);
        g.gain.setValueAtTime(i === 0 ? 0.5 : 0.22, t + hold);
        g.gain.linearRampToValueAtTime(0, t + hold + rel);
        o.connect(g).connect(padBus);
        o.start(t); o.stop(t + hold + rel + 0.1);
      });
    });
    // low root an octave down
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.value = hz(notes[0] - 12);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.35, t + 4); g.gain.linearRampToValueAtTime(0, t + CHORD_SEC + 3);
    o.connect(g).connect(padBus); o.start(t); o.stop(t + CHORD_SEC + 3.2);
  }

  function bell(m, t) {
    [[1, 1], [2.01, 0.25], [3.02, 0.08]].forEach(([mult, amp]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = hz(m) * mult;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6 / mult);
      o.connect(g).connect(bellBus); o.start(t); o.stop(t + 2.8);
    });
  }

  function schedule() {
    const ahead = ctx.currentTime + 0.6;
    while (nextChordAt < ahead) {
      pad(CHORDS[chordIdx], nextChordAt);
      chordIdx = (chordIdx + 1) % CHORDS.length;
      nextChordAt += CHORD_SEC;
    }
    while (nextBellAt < ahead) {
      const chord = CHORDS[(chordIdx + CHORDS.length - 1) % CHORDS.length];
      const note = chord[1 + Math.floor(Math.random() * (chord.length - 1))] + 12 + (Math.random() < 0.3 ? 12 : 0);
      bell(note, nextBellAt);
      nextBellAt += [0.6, 0.9, 1.2, 1.8, 2.4][Math.floor(Math.random() * 5)];
    }
  }

  function setUi() {
    buttons.forEach((b) => {
      b.setAttribute("aria-pressed", String(on));
      b.classList.toggle("is-on", on);
      const l = b.querySelector("[data-sound-label]");
      if (l) l.textContent = on ? "Sound on" : "Sound off";
    });
  }

  async function start() {
    if (!ctx) build();
    await ctx.resume();
    const t = ctx.currentTime + 0.05;
    if (!timer) {
      nextChordAt = t; nextBellAt = t + 2;
      schedule(); timer = setInterval(schedule, 200);
    }
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(0.6, t + 2.5);
    on = true; setUi();
  }
  function stop() {
    if (!ctx) return;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(0, t + 1.2);
    on = false; setUi();
    setTimeout(() => { if (!on) { clearInterval(timer); timer = null; ctx.suspend(); } }, 1400);
  }

  buttons.forEach((b) => b.addEventListener("click", () => (on ? stop() : start())));
  document.addEventListener("visibilitychange", () => {
    if (!ctx || !on) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });
  // Music ducks while a video plays full size in the viewer.
  window.aanyaAudio = {
    setProgress(p) { if (filter) filter.frequency.setTargetAtTime(700 + p * 1800, ctx.currentTime, 0.8); },
    duck(down) { if (on && master) master.gain.setTargetAtTime(down ? 0.1 : 0.6, ctx.currentTime, 0.3); },
  };
  setUi();
})();
