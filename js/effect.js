(() => {
  const crt = document.querySelector(".crt");
  const grain = document.createElement("canvas");
  grain.width = grain.height = 64;
  const context = grain.getContext("2d");
  if (!context) return;

  // 一次產生靜態顆粒，疊在 CRT 圓點下方，避免每幀重繪或閃爍。
  const tile = context.createImageData(grain.width, grain.height);
  for (let i = 3; i < tile.data.length; i += 4) {
    tile.data[i] = Math.floor(Math.random() * 96);
  }
  context.putImageData(tile, 0, 0);
  crt.style.setProperty("--crt-grain", `url("${grain.toDataURL()}")`);
})();

const countdownEffect = (() => {
  const body = document.body;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const duration = 3;
  let lastBeat = -1;
  let heartbeat;

  function stopSound() {
    if (!heartbeat) return;
    heartbeat.stop();
    heartbeat = null;
  }

  function playHeartbeat(audio, pressure, remaining) {
    if (audio?.state !== "running") return;
    const now = audio.currentTime;
    const beatDuration = Math.min(remaining, 0.24);
    const end = now + beatDuration;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const volume = 0.11 + 0.13 * pressure;

    // 同一個低頻音源做出心跳的兩下重音，第二下較輕。
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(74, now);
    oscillator.frequency.exponentialRampToValueAtTime(42, end);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + beatDuration * 0.08);
    gain.gain.linearRampToValueAtTime(0, now + beatDuration * 0.38);
    gain.gain.linearRampToValueAtTime(volume * 0.65, now + beatDuration * 0.54);
    gain.gain.linearRampToValueAtTime(0, end);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
      if (heartbeat === oscillator) heartbeat = null;
    };
    heartbeat = oscillator;
    oscillator.start(now);
    oscillator.stop(end);
  }

  function reset() {
    stopSound();
    lastBeat = -1;
    body.classList.remove("countdown-pressure");
    body.style.removeProperty("--countdown-shade");
    body.style.removeProperty("--countdown-scale");
    body.style.removeProperty("--countdown-tilt");
  }

  function update(remaining, audio) {
    if (remaining <= 0) {
      reset();
      return;
    }
    if (remaining > duration) return;

    const elapsed = duration - remaining;
    const progress = elapsed / duration;
    const pressure = progress * progress * (3 - 2 * progress);
    // 由剩餘時間直接計算心跳相位，畫面與聲音共用節拍。
    const cycle = elapsed * (1.15 + 0.65 * progress);
    const beat = Math.floor(cycle);
    const phase = cycle - beat;
    const angle = 2 * Math.PI * phase;
    const pulse = ((1 + Math.cos(angle)) / 2) ** 10 +
      0.45 * ((1 + Math.cos(angle - Math.PI / 2)) / 2) ** 18;

    if (beat !== lastBeat) {
      lastBeat = beat;
      playHeartbeat(audio, pressure, remaining);
    }

    const strength = body.classList.contains("soft") ? 0.45 : 1;
    const visualPressure = pressure * strength;
    const zoom = visualPressure * (0.056 + 0.022 * pulse);
    body.classList.add("countdown-pressure");
    body.style.setProperty("--countdown-shade", visualPressure * 0.86);
    body.style.setProperty("--countdown-scale", reducedMotion.matches ? 1 : 1 + zoom);
    body.style.setProperty("--countdown-tilt", `${reducedMotion.matches ? 0 : -3 * visualPressure}deg`);
  }

  return { update, reset, stopSound };
})();
