const musicToggle = document.querySelector('#music-toggle');
const effectsToggle = document.querySelector('#effects-toggle');
const musicKey = 'visa:music';
const effectsKey = 'visa:effects';

const cues = {
  answer: [[0, 659, .10, .045]],
  question: [[0, 523, .12, .034], [.095, 659, .17, .037]],
  correct: [[0, 659, .19, .054], [.106, 784, .18, .049], [.212, 988, .25, .046]],
  wrong: [[0, 440, .12, .043], [.105, 349, .19, .036]],
  finished: [[0, 523, .27, .045], [.115, 659, .25, .047],
    [.23, 784, .27, .044], [.345, 1047, .32, .038]],
};

let music;
let context;
let effectsVolume;
let interacted = false;

function enabled(key) {
  try { return localStorage.getItem(key) !== 'off'; }
  catch { return true; }
}

function remember(key, on) {
  try { localStorage.setItem(key, on ? 'on' : 'off'); }
  catch { /* The switches still work for the open page. */ }
}

function updateMusic() {
  if (!musicToggle.checked || document.hidden) {
    music.pause();
    return;
  }
  if (interacted && music.paused) music.play().catch(() => {});
}

function prepareEffects() {
  if (!effectsToggle.checked) return;
  if (!context) {
    const AudioEngine = window.AudioContext || window.webkitAudioContext;
    if (!AudioEngine) return;
    context = new AudioEngine();
    effectsVolume = context.createGain();
    effectsVolume.connect(context.destination);
  }
  if (context.state !== 'running') context.resume().catch(() => {});
}

export function playGameSound(cue) {
  if (!effectsToggle?.checked || document.hidden || context?.state !== 'running') return;
  const notes = cues[cue];
  if (!notes) return;
  for (const [delay, frequency, length, peak] of notes) {
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    envelope.gain.setValueAtTime(.0001, start);
    envelope.gain.exponentialRampToValueAtTime(peak, start + .018);
    envelope.gain.exponentialRampToValueAtTime(.0001, start + length);
    oscillator.connect(envelope);
    envelope.connect(effectsVolume);
    oscillator.addEventListener('ended', () => {
      oscillator.disconnect();
      envelope.disconnect();
    }, {once:true});
    oscillator.start(start);
    oscillator.stop(start + length + .015);
  }
}

if (musicToggle && effectsToggle) {
  musicToggle.checked = enabled(musicKey);
  effectsToggle.checked = enabled(effectsKey);
  music = new Audio();
  music.preload = 'none';
  music.src = '/audio/lounge.mp3';
  music.loop = true;
  music.volume = .62;

  document.addEventListener('click', event => {
    interacted = true;
    if (!event.target.closest?.('.sound-controls')) updateMusic();
    prepareEffects();
  }, {capture:true});
  document.addEventListener('visibilitychange', updateMusic);

  musicToggle.addEventListener('change', () => {
    remember(musicKey, musicToggle.checked);
    updateMusic();
  });
  effectsToggle.addEventListener('change', () => {
    remember(effectsKey, effectsToggle.checked);
    if (effectsVolume) effectsVolume.gain.value = effectsToggle.checked ? 1 : 0;
    prepareEffects();
  });
}
