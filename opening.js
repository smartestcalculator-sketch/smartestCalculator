"use strict";

{
  const opening = document.getElementById("opening");
  const comic = document.getElementById("intro-comic");
  const comicPage = document.getElementById("intro-comic-page");
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
  const comicPageCount = 7;
  const comicPageHoldMs = 3000;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

  // 首頁文字顯示完畢後，開放開始遊戲。
  function finishOpening() {
    for (const { element, text } of lines) {
      element.textContent = text;
      element.classList.remove("typing-cursor");
    }
    startButton.hidden = false;
    startButton.focus({ preventScroll: true });
  }

  // 結束開機與漫畫，接著顯示首頁文字。
  function showWelcome(animateTyping) {
    clearTimeout(introTimer);
    cancelAnimationFrame(progressFrame);
    opening.hidden = true;
    comic.hidden = true;
    skip.hidden = true;
    welcome.classList.remove("welcome-opening");
    if (animateTyping) typeNextCharacter();
    else finishOpening();
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

  // 提前載入下一張，減少自動翻頁時的等待。
  function preloadNextComicPage() {
    const nextPage = new Image();
    nextPage.src = `intro_${comicPageNumber + 1}.png`;
  }

  // 先淡出目前的圖片，再換圖。
  async function fadeComicPage(from, to) {
    if (reducedMotion.matches) return;
    const animation = comicPage.animate([{ opacity: from }, { opacity: to }], {
      duration: 450,
      easing: "ease-in-out",
      fill: "forwards",
    });
    await animation.finished;
    comicPage.style.opacity = to;
    animation.cancel();
  }

  async function advanceComicPage() {
    await fadeComicPage(1, 0);
    if (comic.hidden) return;
    if (comicPageNumber === comicPageCount) {
      showWelcome(!reducedMotion.matches);
      return;
    }
    comicPage.style.opacity = "0";
    comicPageNumber++;
    comicPage.src = `intro_${comicPageNumber}.png`;
    comicPage.alt = `開場漫畫，第 ${comicPageNumber} 張，共 ${comicPageCount} 張`;
    if (comicPageNumber < comicPageCount) preloadNextComicPage();
    await revealComicPage();
  }

  async function revealComicPage() {
    // 圖片解碼完成後再淡入，讀取較慢時也維持黑底。
    await comicPage.decode().catch(() => {});
    if (comic.hidden) return;
    await fadeComicPage(0, 1);
    if (comic.hidden) return;
    comicPage.style.opacity = "";
    // 從淡入完成後開始計時，每張完整顯示三秒。
    introTimer = setTimeout(advanceComicPage, comicPageHoldMs);
  }
  skip.onclick = () => {
    showWelcome(true);
  };

  // 開機時預載第一張，顯示漫畫時再預載下一張。
  function showComic() {
    comicPage.style.opacity = "0";
    comic.hidden = false;
    skip.focus({ preventScroll: true });
    preloadNextComicPage();
    revealComicPage();
  }

  startButton.hidden = true;
  welcome.classList.add("welcome-opening");
  for (const { element } of lines) element.textContent = "";
  skip.hidden = false;
  startOpening();
}
