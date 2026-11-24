"use strict";

const distractionAssets = new Map([
  ["67", { sound: "67.mp3", images: ["67_1.jpg", "67_2.jpg", "67_3.jpg"], duration: 2300, sequential: true }],
  ["87", { sound: "idiot.mp3", images: ["idiot1.jpg", "idiot2.jpg"], duration: 2600 }],
  ["89", { sound: "89.mp3", images: ["89_1.jpeg", "89_2.jpeg", "89_3.jpeg"], duration: 2300, sequential: true }],
  ["404", { sound: "404.mp3", images: ["404_1.jpg"], duration: 4000 }],
  ["3", { sound: "3.mp3", images: ["3_1.webp"], duration: 1700 }],
  ["5", { sound: "5.mp3", images: ["5_1.png"], duration: 1700 }],
]);
const distractionLayer = document.getElementById("distractions");
const activeDistractions = new Map();
const distractionSounds = new Map();
const playingDistractionSounds = new Map();
const shownAnswerDistractions = new Set();
let pendingAnswerDistraction;
let questionReplays = [];

for (const { images } of distractionAssets.values()) {
  for (const file of images) {
    const image = new Image();
    image.src = file;
  }
}

function prepareDistractionSounds(context) {
  for (const [number, { sound }] of distractionAssets) {
    if (distractionSounds.has(number)) continue;
    const buffer = fetch(sound)
      .then((response) => response.ok ? response.arrayBuffer() : null)
      .then((data) => data && context.decodeAudioData(data))
      .catch(() => null);
    distractionSounds.set(number, buffer);
  }
}

function playDistractionSound(number) {
  const sound = distractionSounds.get(number);
  if (!soundOn || !audio || !sound || playingDistractionSounds.has(number)) return;
  const context = audio;
  const playback = { startedAt: performance.now() };
  playingDistractionSounds.set(number, playback);

  sound.then((buffer) => {
    if (playingDistractionSounds.get(number) !== playback) return;
    const offset = (performance.now() - playback.startedAt) / 1000;
    if (!buffer || offset >= buffer.duration) {
      playingDistractionSounds.delete(number);
      return;
    }

    const source = context.createBufferSource();
    const gain = context.createGain();
    gain.gain.value = 0.32;
    source.buffer = buffer;
    source.connect(gain).connect(context.destination);
    source.onended = () => {
      if (playingDistractionSounds.get(number) === playback) playingDistractionSounds.delete(number);
    };
    source.start(0, offset);
    playback.source = source;
  }).catch(() => {
    if (playingDistractionSounds.get(number) === playback) playingDistractionSounds.delete(number);
  });
}

function muteDistractionSounds() {
  for (const { source } of playingDistractionSounds.values()) source?.stop();
  playingDistractionSounds.clear();
}

function showDistraction(number) {
  const effect = distractionAssets.get(number);
  if (!effect || activeDistractions.has(number)) return;

  const group = document.createElement("div");
  group.className = `distraction distraction-${number}`;
  const images = effect.images.map((file) => {
    const image = document.createElement("img");
    image.alt = "";
    image.src = file;
    group.append(image);
    return image;
  });
  const timers = [];
  if (effect.sequential) {
    const interval = effect.duration / images.length;
    images.forEach((image, index) => {
      if (index === 0) return;
      image.hidden = true;
      timers.push(setTimeout(() => {
        images[index - 1].hidden = true;
        image.hidden = false;
      }, interval * index));
    });
  }
  distractionLayer.append(group);
  const active = { timers, endsAt: performance.now() + effect.duration };
  timers.push(setTimeout(() => {
    group.remove();
    activeDistractions.delete(number);
  }, effect.duration));
  activeDistractions.set(number, active);
  playDistractionSound(number);
}

function beginDistractionRound(text) {
  muteDistractionSounds();
  shownAnswerDistractions.clear();
  const cues = new Map();
  const seen = new Set();
  for (const match of text.matchAll(/\d+/g)) {
    const [number] = match;
    if (!distractionAssets.has(number) || seen.has(number)) continue;
    seen.add(number);
    const charactersRead = Array.from(text.slice(0, match.index + number.length)).length;
    cues.set(charactersRead, number);
  }
  questionReplays = [...seen].flatMap((number) =>
    (number === "404" ? [9] : [7, 14]).map((elapsed) => ({ number, elapsed })),
  ).sort((a, b) => a.elapsed - b.elapsed);
  return cues;
}

function replayQuestionDistractions(elapsed, remaining) {
  while (questionReplays.length && questionReplays[0].elapsed <= elapsed) {
    const { number } = questionReplays.shift();
    if (remaining * 1000 >= distractionAssets.get(number).duration) showDistraction(number);
  }
}

function cancelPendingAnswerDistraction() {
  clearTimeout(pendingAnswerDistraction);
}

function showAnswerDistractions(raw) {
  for (const number of new Set(raw.match(/\d+/g))) {
    if (!distractionAssets.has(number) || shownAnswerDistractions.has(number)) continue;
    shownAnswerDistractions.add(number);
    showDistraction(number);
  }
}

function queueAnswerDistractions(raw) {
  cancelPendingAnswerDistraction();
  pendingAnswerDistraction = setTimeout(() => showAnswerDistractions(raw), 350);
}

function remainingDistractionMs() {
  const now = performance.now();
  return Math.max(0, ...Array.from(activeDistractions.values(), ({ endsAt }) => endsAt - now));
}

function resetDistractions() {
  cancelPendingAnswerDistraction();
  muteDistractionSounds();
  questionReplays = [];
  for (const { timers } of activeDistractions.values()) {
    for (const timer of timers) clearTimeout(timer);
  }
  activeDistractions.clear();
  distractionLayer.replaceChildren();
}
