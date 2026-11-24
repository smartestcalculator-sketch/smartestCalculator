"use strict";

{
  const opening = document.getElementById("opening");
  const comic = document.getElementById("intro-comic");
  const comicPage = document.getElementById("intro-comic-page");
  const nextComicPage = document.getElementById("intro-comic-next");
  const percent = document.getElementById("opening-percent");
  const welcome = document.getElementById("welcome");
  const skip = document.getElementById("skip-opening");
  const startButton = document.getElementById("start");
  const lines = Array.from(welcome.querySelectorAll("[data-type-line]"), (element) => ({
    element,
    characters: Array.from(element.textContent),
    text: element.textContent,
  }));
  let introTimer;
  let progressFrame;
  let lineIndex = 0;
  let characterIndex = 0;
  let comicPageNumber = 1;
  let turningComicPage = false;
  const comicPageCount = 7;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

  // 跳過開場或播放完畢後，直接顯示首頁。
  function finishOpening() {
    clearTimeout(introTimer);
    cancelAnimationFrame(progressFrame);
    opening.hidden = true;
    comic.hidden = true;
    welcome.classList.remove("welcome-opening");
    for (const { element, text } of lines) {
      element.textContent = text;
      element.classList.remove("typing-cursor");
    }
    startButton.hidden = false;
    skip.hidden = true;
  }

  function typeNextCharacter() {
    const { element, characters } = lines[lineIndex];
    element.classList.add("typing-cursor");
    element.textContent = characters.slice(0, ++characterIndex).join("");
    if (characterIndex < characters.length) {
      introTimer = setTimeout(typeNextCharacter, 48);
      return;
    }
    introTimer = setTimeout(() => {
      element.classList.remove("typing-cursor");
      characterIndex = 0;
      lineIndex++;
      if (lineIndex === lines.length) finishOpening();
      else typeNextCharacter();
    }, 340);
  }

  // 開機畫面結束後才顯示漫畫。
  function startOpening() {
    if (reducedMotion.matches) {
      showComic();
      return;
    }
    const progressMs = 5000;
    const openingMs = progressMs + 450;
    const startedAt = performance.now();

    function updateProgress(now) {
      const progress = Math.min(100, Math.floor((now - startedAt) / progressMs * 100));
      const label = `${progress}%`;
      if (percent.textContent !== label) percent.textContent = label;
      if (progress < 100) progressFrame = requestAnimationFrame(updateProgress);
    }

    progressFrame = requestAnimationFrame(updateProgress);
    opening.style.setProperty("--opening-duration", `${openingMs}ms`);
    opening.hidden = false;
    skip.focus({ preventScroll: true });
    introTimer = setTimeout(() => {
      cancelAnimationFrame(progressFrame);
      opening.hidden = true;
      showComic();
    }, openingMs);
  }

  // 先載入下一張，讓讀者自行決定翻頁時間。
  function preloadNextComicPage() {
    const nextPage = new Image();
    nextPage.src = `intro_${comicPageNumber + 1}.jpg`;
  }

  // 等目前的圖片淡出後再換圖，避免連點時跳過漫畫頁。
  async function fadeComicPage(from, to) {
    if (reducedMotion.matches) return;
    const animation = comicPage.animate([{ opacity: from }, { opacity: to }], {
      duration: 300,
      easing: "ease-in-out",
      fill: "forwards",
    });
    await animation.finished;
    comicPage.style.opacity = to;
    animation.cancel();
  }

  nextComicPage.onclick = async () => {
    if (turningComicPage || comic.hidden) return;
    turningComicPage = true;
    await fadeComicPage(1, 0);
    if (comic.hidden) return;
    if (comicPageNumber === comicPageCount) {
      comic.hidden = true;
      if (reducedMotion.matches) {
        finishOpening();
        startButton.focus({ preventScroll: true });
      } else {
        welcome.classList.remove("welcome-opening");
        skip.focus({ preventScroll: true });
        typeNextCharacter();
      }
      return;
    }
    comicPage.style.opacity = "0";
    comicPageNumber++;
    comicPage.src = `intro_${comicPageNumber}.jpg`;
    comicPage.alt = `開場漫畫，第 ${comicPageNumber} 張，共 ${comicPageCount} 張`;
    const action = comicPageNumber === comicPageCount ? "點擊繼續" : "點擊翻頁";
    nextComicPage.setAttribute("aria-label", `${comicPage.alt}，${action}`);
    if (comicPageNumber < comicPageCount) preloadNextComicPage();
    await revealComicPage();
  };

  async function revealComicPage() {
    // 圖片解碼完成後再淡入，讀取較慢時也維持黑底。
    await comicPage.decode().catch(() => {});
    if (comic.hidden) return;
    await fadeComicPage(0, 1);
    comicPage.style.opacity = "";
    turningComicPage = false;
  }
  skip.onclick = () => {
    finishOpening();
    startButton.focus({ preventScroll: true });
  };

  // 開機時預載第一張，顯示漫畫時再預載下一張。
  function showComic() {
    comicPage.style.opacity = "0";
    turningComicPage = true;
    comic.hidden = false;
    nextComicPage.focus({ preventScroll: true });
    preloadNextComicPage();
    revealComicPage();
  }

  startButton.hidden = true;
  welcome.classList.add("welcome-opening");
  for (const { element } of lines) element.textContent = "";
  skip.hidden = false;
  startOpening();
}
