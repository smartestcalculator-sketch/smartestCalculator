"use strict";

const calculator = document.getElementById("calculator");
const calculation = document.getElementById("calculation");
const calculationResult = document.getElementById("calculation-result");
const calculatorToggle = document.getElementById("calculator-toggle");
const operations = {
  "+": (a, b) => a + b,
  "-": (a, b) => a - b,
  "*": (a, b) => a * b,
  "/": (a, b) => a / b,
  "^": (a, b) => a ** b,
};
const precedence = { "+": 1, "-": 1, "*": 2, "/": 2, "^": 3 };

function evaluateCalculation(expression) {
  const source = expression.replaceAll("×", "*").replaceAll("÷", "/")
    .replaceAll("−", "-").replace(/\s/g, "");
  const tokens = source.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|./gi) ?? [];
  let cursor = 0;

  function operand() {
    const token = tokens[cursor++];
    if (token === "+" || token === "-" || token === "√") {
      const value = parse(3);
      if (token === "√") return Math.sqrt(value);
      return token === "-" ? -value : value;
    }
    if (token === "(") {
      const value = parse(1);
      if (tokens[cursor++] !== ")") throw new Error();
      return value;
    }
    if (!/^\d|^\.\d/.test(token ?? "")) throw new Error();
    return Number(token);
  }

  function parse(minimum) {
    let value = operand();
    while (precedence[tokens[cursor]] >= minimum) {
      const operator = tokens[cursor++];
      const nextMinimum = precedence[operator] + (operator === "^" ? 0 : 1);
      value = operations[operator](value, parse(nextMinimum));
    }
    return value;
  }

  const value = parse(1);
  if (cursor !== tokens.length || !Number.isFinite(value)) throw new Error();
  return value;
}

function calculate() {
  try {
    calculationResult.textContent = String(Number(evaluateCalculation(calculation.value).toPrecision(12)));
  } catch {
    calculationResult.textContent = "無法計算，請檢查算式。";
  }
}

let calculatorOpen = false;
let calculatorMotion;

function setCalculatorOpen(open, restoreFocus = false) {
  if (calculatorOpen === open) return;
  const previousTransform = calculatorMotion && getComputedStyle(calculator).transform;
  calculatorMotion?.cancel();
  calculatorOpen = open;
  calculatorToggle.setAttribute("aria-expanded", String(open));
  calculatorToggle.textContent = open ? "按 F 收起計算機" : "按 F 進入計算機";
  if (open) {
    calculator.hidden = false;
    calculator.inert = false;
    calculation.focus({ preventScroll: true });
  } else {
    if (restoreFocus) document.getElementById("answer").focus({ preventScroll: true });
    calculator.inert = true;
  }

  if (typeof calculator.animate !== "function" || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    calculator.hidden = !open;
    return;
  }

  const travel = window.innerWidth;
  calculatorMotion = calculator.animate(
    [
      { transform: previousTransform || (open ? `translateX(${travel}px)` : "none") },
      { transform: open ? "none" : `translateX(${travel}px)` },
    ],
    { duration: 320, easing: "ease-in-out", fill: "forwards" },
  );
  calculatorMotion.onfinish = () => {
    calculator.hidden = !calculatorOpen;
    calculatorMotion.cancel();
    calculatorMotion = undefined;
  };
}

calculatorToggle.onclick = () => setCalculatorOpen(!calculatorOpen, true);
document.addEventListener("keydown", (event) => {
  if (calculatorToggle.hidden || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
  const toggle = event.key.toLowerCase() === "f";
  if (!toggle && (event.key !== "Escape" || !calculatorOpen)) return;
  event.preventDefault();
  if (!event.repeat) setCalculatorOpen(toggle && !calculatorOpen, true);
});

calculation.oninput = () => { calculationResult.textContent = ""; };
calculation.onkeydown = (event) => {
  if (event.isComposing || (event.key !== "Enter" && event.key !== "=")) return;
  event.preventDefault();
  calculate();
};

for (const key of [
  "AC", "⌫", "√", "÷", "7", "8", "9", "×", "4", "5", "6", "−",
  "1", "2", "3", "+", "0", ".", "=", "(", ")", "^",
]) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = key;
  if ("÷×−+=".includes(key)) button.classList.add("calculator-operation");
  if (["AC", "⌫", "√", "(", ")", "^"].includes(key)) button.classList.add("calculator-tool");
  if (key === "0") button.classList.add("calculator-zero");
  if (key === "AC") button.setAttribute("aria-label", "全部清除");
  if (key === "⌫") button.setAttribute("aria-label", "刪除一字");
  button.onclick = () => {
    if (key === "=") {
      calculate();
      return;
    }
    calculationResult.textContent = "";
    const { selectionStart: start, selectionEnd: end } = calculation;
    if (key === "AC") calculation.value = "";
    else if (key === "⌫") calculation.setRangeText("", start === end ? Math.max(0, start - 1) : start, end, "end");
    else if (calculation.value.length - (end - start) < calculation.maxLength) calculation.setRangeText(key, start, end, "end");
    calculation.focus();
  };
  document.getElementById("calculator-keys").append(button);
}
