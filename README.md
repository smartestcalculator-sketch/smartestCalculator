# 算數化石

## 你要開哪個檔案？

遊戲首頁是 **index.html**。請用下列任一方式啟動本機伺服器，讓瀏覽器載入 `scene.js` 和 `glt/` 內的模型。Three.js 由 CDN 載入。

### 方法一：VS Code（建議）

1. 在 VS Code 點「File → Open Folder」，選擇整個 smartestCalculator 資料夾。
2. 左邊 Extensions 搜尋並安裝 **Live Server**（Ritwick Dey）。
3. 在左邊檔案清單對 **index.html** 按右鍵 → **Open with Live Server**。
4. 瀏覽器就會開啟遊戲。編輯檔案並儲存後，頁面會重新整理。

### 方法二：Mac 終端機

在此資料夾開啟終端機，執行：

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

然後在 Chrome 或 Safari 開啟 **http://localhost:8000**。遊戲期間保留終端機，結束按 Control + C。若找不到 python3，請使用方法一。若 8000 已被其他程式使用，可以把指令和網址中的 8000 都改成 8001。

也可以雙擊 **開始遊戲.command** 來啟動相同伺服器，再手動開啟顯示的網址。若 macOS 不允許執行，直接使用上述終端機指令或 Live Server，不必變更安全設定。

## 檔案用途

| 檔案               | 用途                                 |
| ------------------ | ------------------------------------ |
| index.html         | 首頁、題目介面、批改畫面、結局       |
| style.css          | 配色、CRT 效果、手機版排版           |
| game.js            | 題庫、計時、答案判斷、結局與音效     |
| scene.js           | 載入 GLB 模型，繪製房間與機器人       |
| 開始遊戲.command   | Mac 本機伺服器啟動器                 |
| glt/               | GLB 模型與內嵌材質                   |

## 遊戲流程

啟動 → 10 題國中數學 → 每題 20 秒 → 機器人反應 → 隔天送到學校批改 → 結局。

- 剩 7 秒時小羅開始不耐煩，時間繼續走。
- 答對時不特別稱讚，直接繼續；答錯時疑惑、歪斜並出現程式畫的摸頭提示。
- 逾時算錯，機器人生氣，然後下一題。
- 7 題以上正確：高價賣給科學家；6 題以下：被丟掉。
- 支援負數、小數、分數，Enter 確認，也可以點螢幕按鍵。
- 分頁在背景時仍會計時；回來後若逾時，當題記為錯誤。
- 結束後可展開批改紀錄，查看正確解法。

## 修改規則或題目

打開 game.js，最上方的 CONFIG：

```js
const CONFIG = {
  seconds: 20,
  passRate: 0.7,
  reactionMs: 2000,
  gradingMs: 3200,
};
```

seconds 是每題秒數；passRate 是科學家結局門檻（0.7 = 70%）；reactionMs 是反應停留毫秒；gradingMs 是批改停留毫秒。QUESTIONS 陣列每題的 text 是題目，answer 是數值答案，explain 是批改說明。題數會自動依陣列長度更新。

## 目前動畫與畫面的範圍

場景使用 Three.js 載入機器人、容器、大腦和背景的 GLB 模型。畫面以場景光照搭配 CRT 圓點呈現。
