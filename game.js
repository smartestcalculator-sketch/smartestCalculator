"use strict";
// 可調整設定：每題秒數、結局門檻、題庫。
const CONFIG = {
  seconds: 20,
  passRate: 0.7,
  readingPreviewMs: 1500,
  readingCharacterMs: 140,
  readingEmphasisMs: 600,
  readingHoldMs: 1200,
  reactionMs: 2000,
  gradingMs: 3200,
};
const QUESTIONS = [
  { text: "18 + 24 ÷ 4 = ?", answer: 24, explain: "18 + 6 = 24。" },
  { text: "404 − 4 × 6 = ?", answer: 380, explain: "404 − 24 = 380。" },
  { text: "4x − 8 = 56，x = ?", answer: 16, explain: "64 ÷ 4 = 16。" },
  { text: "87 ÷ 29 + 12 = ?", answer: 15, explain: "3 + 12 = 15。" },
  { text: "直角三角形兩股是 9 和 12，斜邊長是多少？", answer: 15, explain: "√(9² + 12²) = 15。" },
  { text: "3 + 1/8 = ?（可輸入分數）", answer: 25 / 8, explain: "24/8 + 1/8 = 25/8。" },
  { text: "三角形兩內角是 48° 和 72°，第三角幾度？", answer: 60, explain: "180 − 48 − 72 = 60。" },
  { text: "67 + 28 − 6 = ?", answer: 89, explain: "95 − 6 = 89。" },
  { text: "長方形長 12、寬 8，周長是多少？", answer: 40, explain: "2 × (12 + 8) = 40。" },
  { text: "5x + 12 = 82，x = ?", answer: 14, explain: "70 ÷ 5 = 14。" },
];
const $ = (id) => document.getElementById(id);
let state = "welcome",
  index = 0,
  results = [],
  deadline = 0,
  frame = 0,
  transition = 0,
  impatient = false,
  soundOn = true,
  audio;
function show(id) {
  for (const name of ["welcome", "game", "grading", "ending"])
    $(name).hidden = name !== id;
  document.body.classList.remove("danger");
}
function enableGameAudio() {
  if (!soundOn) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume().catch(() => {});
    prepareDistractionSounds(audio);
  } catch {}
}
function tone(freq = 220, duration = 0.12) {
  if (!soundOn || !audio) return;
  try {
    const osc = audio.createOscillator(),
      gain = audio.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.035, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + duration);
  } catch {}
}
function reaction(kind, animationKind = kind) {
  document.body.dataset.reaction = kind;
  window.robotReaction = kind;

  window.dispatchEvent(
    new CustomEvent("robot:reaction", {
      detail: { kind: animationKind },
    })
  );
}
function start() {
  clearTimeout(transition);
  resetDistractions();
  cancelAnimationFrame(frame);
  index = 0;
  results = [];
  $("system").textContent = "CALCULATION IN PROGRESS";
  show("game");
  enableGameAudio();
  tone(120, 0.3);
  next();
}
function setPhase(phase) {
  if (phase !== "answering") {
    cancelPendingAnswerDistraction();
    countdownEffect.reset();
  }
  state = phase;
  document.body.dataset.phase = phase;
}

function setAnswerEnabled(enabled) {
  $("answer").disabled = !enabled;
  $("submit").disabled = !enabled;
  $("calculator-toggle").hidden = !enabled;
  if (!enabled) setCalculatorOpen(false);
}

function next() {
  document.body.classList.remove("danger");
  setPhase("reading");
  impatient = false;
  reaction("idle");
  setAnswerEnabled(false);
  $("answer").value = "";
  $("answer-warning").textContent = "";
  $("progress").textContent =
    `${String(index + 1).padStart(2, "0")} / ${QUESTIONS.length}`;
  $("time").textContent = "—";
  $("timer-bar").style.width = "100%";
  $("dialogue").textContent = index ? "下一題。先讀題。" : "快點，幫我把作業寫完。先讀題。";
  $("mood").textContent = "小羅：正在出題";

  const question = $("question");
  const text = QUESTIONS[index].text;
  const distractionCues = beginDistractionRound(text);
  question.setAttribute("aria-label", text);
  const characters = Array.from(text, (character) => {
    const span = document.createElement("span");
    span.textContent = character;
    span.setAttribute("aria-hidden", "true");
    return span;
  });
  const content = [];
  const cueGroups = new Map();
  let cursor = 0;
  for (const [end, number] of distractionCues) {
    const start = end - number.length;
    const group = document.createElement("span");
    group.classList.add("question-number");
    group.replaceChildren(...characters.slice(start, end));
    content.push(...characters.slice(cursor, start), group);
    cueGroups.set(end, group);
    cursor = end;
  }
  question.replaceChildren(...content, ...characters.slice(cursor));

  let read = 0;
  function highlightNext() {
    characters[read++].classList.add("read-character");
    const cue = cueGroups.get(read);
    if (cue) {
      cue.classList.add("question-number-emphasis");
      transition = setTimeout(() => {
        showDistraction(distractionCues.get(read));
        continueReading();
      }, CONFIG.readingEmphasisMs);
      return;
    }
    continueReading();
  }

  function continueReading() {
    transition = setTimeout(
      read < characters.length ? highlightNext : beginAnswer,
      read < characters.length ? CONFIG.readingCharacterMs : CONFIG.readingHoldMs,
    );
  }

  transition = setTimeout(
    highlightNext,
    distractionCues.size ? CONFIG.readingPreviewMs : CONFIG.readingCharacterMs,
  );
}

function beginAnswer() {
  setPhase("answering");
  setAnswerEnabled(true);
  $("mood").textContent = "小羅：等待運算";
  $("dialogue").textContent = "開始計算！";
  deadline = performance.now() + CONFIG.seconds * 1000;
  $("answer").focus();
  tick();
}
function tick() {
  if (state !== "answering") return;
  const remaining = Math.max(0, (deadline - performance.now()) / 1000);
  replayQuestionDistractions(CONFIG.seconds - remaining, remaining);
  $("time").textContent = `${remaining.toFixed(1)} 秒`;
  $("timer-bar").style.width = `${(remaining / CONFIG.seconds) * 100}%`;
  if (remaining <= 7 && !impatient) {
    impatient = true;
    reaction("angry");
    $("mood").textContent = "小羅：開始不耐煩";
    $("dialogue").textContent = "……你到底算好了沒有？";
    document.body.classList.add("danger");
    tone(90, 0.3);
  }
  if (remaining <= 0) {
    finishAnswer(true);
    return;
  }
  countdownEffect.update(remaining, soundOn ? audio : null);
  frame = requestAnimationFrame(tick);
}
function parseAnswer(raw) {
  const s = raw.trim().replaceAll("−", "-").replaceAll("／", "/");
  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)) return Number(s);
  const match = s.match(
    /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*\/\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))$/,
  );
  return match && Number(match[2]) !== 0
    ? Number(match[1]) / Number(match[2])
    : NaN;
}
function finishAnswer(timeout = false) {
  if (state !== "answering") return;
  if (!timeout && performance.now() >= deadline) {
    finishAnswer(true);
    return;
  }
  const raw = $("answer").value;
  const value = parseAnswer(raw);
  if (!timeout && !Number.isFinite(value)) {
    $("answer-warning").textContent = "請輸入數字，或像 1/2 這樣的分數。";
    return;
  }
  if (!timeout) showAnswerDistractions(raw);
  setPhase("reaction");
  cancelAnimationFrame(frame);
  const correct =
    !timeout && Math.abs(value - QUESTIONS[index].answer) < 0.0001;
  results.push({ raw: timeout ? "逾時未作答" : raw, correct, timeout });
  setAnswerEnabled(false);
  document.body.classList.remove("danger");
  if (timeout) {
    reaction("timeout");
    $("dialogue").textContent = "太慢了！連這個也要想這麼久？我自己填！";
    $("mood").textContent = "小羅：生氣";
    tone(65, 0.5);
  } else if (correct) {
    reaction("idle", "correct");
    $("dialogue").textContent = "……";
    $("mood").textContent = "小羅：繼續抄寫";
    tone(300);
  } else {
    reaction("wrong");
    $("dialogue").textContent = "嗯？……是這樣算的嗎？算了，下一題。";
    $("mood").textContent = "小羅：摸頭，感到疑惑";
    tone(155, 0.25);
  }
  transition = setTimeout(() => {
    index++;
    if (index >= QUESTIONS.length) grade();
    else next();
  }, Math.max(CONFIG.reactionMs, Math.ceil(remainingDistractionMs())));
}
function grade() {
  muteDistractionSounds();
  setPhase("grading");
  reaction("away");
  show("grading");
  $("system").textContent = "HOMEWORK SUBMITTED";
  transition = setTimeout(end, CONFIG.gradingMs);
}
function end() {
  setPhase("ending");
  show("ending");
  const correct = results.filter((r) => r.correct).length;
  const passed = correct / QUESTIONS.length >= CONFIG.passRate;
  reaction(passed ? "sold" : "discarded");
  $("ending-tag").textContent = passed
    ? "ENDING 02 / RESEARCH PROPERTY"
    : "ENDING 01 / DISPOSED";
  $("ending-title").textContent = passed ? "你算得太好了。" : "你被丟掉了。";
  $("ending-story").textContent = passed
    ? "老師發現這台老式人類計算機的異常準確率。小羅把你高價賣給了科學家。你被送進研究所，成為下一項實驗的編號。恭喜，你還有使用價值。"
    : "老師在作業上留下滿滿紅字。小羅回到家，看了你一眼：「果然，過時的東西就是沒用。」垃圾桶蓋闔上，世界只剩下一片黑。";
  $("score").textContent =
    `批改結果：${correct} / ${QUESTIONS.length} 題正確 · 正確率 ${Math.round((correct / QUESTIONS.length) * 100)}% · ${Math.ceil(CONFIG.passRate * QUESTIONS.length)} 題以上進入研究所`;
  $("review").replaceChildren(
    ...results.map((r, i) => {
      const li = document.createElement("li");
      li.textContent = `${r.correct ? "✓" : "✕"} ${QUESTIONS[i].text} 你的答案：${r.raw}。${QUESTIONS[i].explain}`;
      return li;
    }),
  );
  $("system").textContent = passed
    ? "OWNERSHIP TRANSFERRED"
    : "CONNECTION LOST";
  tone(passed ? 440 : 55, 0.8);
}
$("start").onclick = start;
$("restart").onclick = start;
$("answer-form").onsubmit = (e) => {
  e.preventDefault();
  finishAnswer();
};
$("answer").oninput = (event) => {
  if (event.isComposing || state !== "answering") return;
  const value = $("answer").value;
  queueAnswerDistractions(value);
  const unexpectedCharacters = /[^0-9+−.\s/／-]/.test(value);
  const repeatedSymbols = /[.]{2,}|[+−-]{2,}|[/／]{2,}/.test(value.replace(/\s/g, ""));
  $("answer-warning").textContent =
    unexpectedCharacters || repeatedSymbols ? "請確認輸入內容，答案應為數字。" : "";
};
$("fx").onclick = () => {
  const soft = document.body.classList.toggle("soft");
  $("fx").textContent = `視覺效果：${soft ? "弱" : "強"}`;
};
$("sound").onclick = () => {
  soundOn = !soundOn;
  if (soundOn) enableGameAudio();
  else {
    muteDistractionSounds();
    countdownEffect.stopSound();
  }
  $("sound").textContent = `音效：${soundOn ? "開" : "關"}`;
};
