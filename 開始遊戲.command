#!/bin/zsh
cd -- "${0:A:h}"
if ! command -v python3 >/dev/null 2>&1; then
  print '找不到 Python 3。請改用 VS Code 的 Live Server 開啟 index.html。'
  read '?按 Enter 關閉'
  exit 1
fi
print '請在瀏覽器開啟：http://localhost:8000'
print '遊戲期間請保留此視窗；結束時按 Control + C。'
python3 -m http.server 8000 --bind 127.0.0.1
