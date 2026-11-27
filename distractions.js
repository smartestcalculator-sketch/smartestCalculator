"use strict";

const distractionAssets = new Map([
  ["67", { sound: "67.mp3", images: [], duration: 2300 }],
  ["87", {
    sound: "idiot.mp3",
    images: ["idiot_1.png", "idiot_2.png", "idiot_3.png"],
    duration: 2600,
    sequential: true,
  }],
  ["89", {
    sound: "89.mp3",
    images: ["89_1.png", "89_2.png"],
    quote: "兄弟不問對錯 只問挺不挺",
    duration: 4500,
  }],
  ["404", { sound: "404.mp3", images: ["404_1.jpg"], duration: 4000 }],
  ["3", {
    sound: "3.mp3",
    images: ["3_1.png", "3_2.png", "3_3.png"],
    duration: 5000,
  }],
  ["5", {
    sound: "5.mp3",
    images: ["5_1.png", "5_2.png", "5_3.png"],
    slogan: "市長讓你們喝ㄋㄟㄋㄟ～",
    duration: 5000,
  }],
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

function measureDistractionGain(buffer) {
  // 用最響的 200 毫秒估算音量，避免片頭或片尾的靜音把整段音效推得太大。
  const windowSize = Math.round(buffer.sampleRate * 0.2);
  const windowEnergy = new Float64Array(Math.ceil(buffer.length / windowSize));
  let peak = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const samples = buffer.getChannelData(channel);
    for (let start = 0; start < samples.length; start += windowSize) {
      const end = Math.min(start + windowSize, samples.length);
      let energy = 0;
      for (let i = start; i < end; i++) {
        const sample = samples[i];
        energy += sample * sample;
        peak = Math.max(peak, Math.abs(sample));
      }
      windowEnergy[start / windowSize] += energy / ((end - start) * buffer.numberOfChannels);
    }
  }
  const loudestRms = Math.sqrt(windowEnergy.reduce((max, energy) => Math.max(max, energy), 0));
  return Math.min(4, 0.2 / loudestRms, 0.85 / peak);
}

function prepareDistractionSounds(context) {
  for (const [number, { sound }] of distractionAssets) {
    if (distractionSounds.has(number)) continue;
    const recording = fetch(sound)
      .then((response) => response.ok ? response.arrayBuffer() : null)
      .then((data) => data && context.decodeAudioData(data))
      .then((buffer) => buffer && { buffer, volume: measureDistractionGain(buffer) })
      .catch(() => null);
    distractionSounds.set(number, recording);
  }
}

function playDistractionSound(number) {
  if (!soundOn) return;
  playingDistractionSounds.get(number)?.stop?.();
  const playback = {};
  playingDistractionSounds.set(number, playback);

  const clearPlayback = () => {
    if (playingDistractionSounds.get(number) === playback) {
      playingDistractionSounds.delete(number);
    }
  };

  async function startPlayback() {
    const recording = await distractionSounds.get(number);
    if (playingDistractionSounds.get(number) !== playback) return;
    if (!recording || !gameAudioOutput) {
      // 直接開啟 HTML 或解碼失敗時，仍可用瀏覽器的播放器讀同一個 MP3。
      const player = new Audio(distractionAssets.get(number).sound);
      player.volume = soundVolume;
      player.onended = clearPlayback;
      player.onerror = clearPlayback;
      playback.stop = () => player.pause();
      playback.setVolume = (volume) => { player.volume = volume; };
      await player.play();
      return;
    }

    const source = audio.createBufferSource();
    const gain = audio.createGain();
    gain.gain.value = recording.volume;
    source.buffer = recording.buffer;
    source.connect(gain).connect(gameAudioOutput);
    source.onended = clearPlayback;
    source.start();
    playback.stop = () => source.stop();
  }
  startPlayback().catch(clearPlayback);
}

function setDistractionVolume(volume) {
  for (const playback of playingDistractionSounds.values()) playback.setVolume?.(volume);
}

function muteDistractionSounds() {
  for (const playback of playingDistractionSounds.values()) playback.stop?.();
  playingDistractionSounds.clear();
}

function showDistraction(number) {
  const effect = distractionAssets.get(number);
  if (!effect) return;
  // 音效的重播不受圖片是否還在畫面上影響。
  playDistractionSound(number);
  if (activeDistractions.has(number)) return;

  const group = document.createElement("div");
  group.className = `distraction distraction-${number}`;
  // 67 用畫面晃動與符號取代圖片。
  if (number === "67") {
    for (const symbol of ["6", "7"]) {
      const label = document.createElement("span");
      label.textContent = symbol;
      group.append(label);
    }
  }
  const stages = effect.images.map((file) => {
    const image = document.createElement("img");
    image.alt = "";
    image.src = file;
    if (number === "3" || number === "5") {
      // 限制動畫的顯示範圍，讓三張圖各自留在自己的區域。
      const slot = document.createElement("div");
      slot.append(image);
      group.append(slot);
    } else {
      group.append(image);
    }
    return image;
  });
  if (effect.slogan) {
    const slogan = document.createElement("div");
    slogan.className = "distraction-slogan";
    slogan.textContent = effect.slogan;
    group.append(slogan);
  }
  const timers = [];
  if (effect.quote) {
    const quote = document.createElement("blockquote");
    quote.textContent = effect.quote;
    group.append(quote);
    stages.push(quote);
  }

  if (effect.sequential || effect.quote) {
    // 先隱藏上一個項目，再顯示下一個項目。
    const interval = effect.duration / stages.length;
    stages.forEach((stage, index) => {
      if (index === 0) return;
      stage.hidden = true;
      timers.push(setTimeout(() => {
        stages[index - 1].hidden = true;
        stage.hidden = false;
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
