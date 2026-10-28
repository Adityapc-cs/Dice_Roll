// ===== 1. GET ELEMENTS FROM THE PAGE =====

// Top bar
const soundBtn = document.getElementById("soundBtn");
const themeBtn = document.getElementById("themeBtn");

// Table
const diceArea = document.getElementById("diceArea");
const totalEl = document.getElementById("total");

// Controls
const minusBtn = document.getElementById("minusBtn");
const countOut = document.getElementById("countOut");
const plusBtn = document.getElementById("plusBtn");
const rollBtn = document.getElementById("rollBtn");
const roll10Btn = document.getElementById("roll10Btn");

// History
const historyList = document.getElementById("historyList");
const emptyMsg = document.getElementById("emptyMsg");
const clearBtn = document.getElementById("clearBtn");

// Statistics
const resetStatsBtn = document.getElementById("resetStatsBtn");
const rollCountEl = document.getElementById("rollCount");
const averageEl = document.getElementById("average");
const avgBar = document.getElementById("avgBar");
const bars = document.querySelectorAll(".bar");
const barCounts = document.querySelectorAll(".bar-count");

// ===== 2. SETTINGS AND DATA =====

const MIN_DICE = 1;
const MAX_DICE = 6;
const HISTORY_LIMIT = 10;   // how many rolls the history keeps
const FLIP_TIME = 80;       // milliseconds between face changes while rolling
const ROLL_TIME = 900;      // milliseconds the roll animation lasts
const BAR_HEIGHT = 80;      // pixel height of the tallest statistics bar

// Each die has 9 dot spots (0 to 8):   0 1 2
//                                      3 4 5
//                                      6 7 8
// For each number, these are the spots that get a dot.
const pipPatterns = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

// Data the program remembers (some of it is saved in the browser)
let diceCount = Number(localStorage.getItem("diceCount")) || 2;
if (diceCount < MIN_DICE || diceCount > MAX_DICE) diceCount = 2;

let isRolling = false;                      // true while the animation runs
let muted = localStorage.getItem("muted") === "true";
let rollHistory = JSON.parse(localStorage.getItem("history")) || [];
let stats = JSON.parse(localStorage.getItem("stats")) || emptyStats();

// Statistics: how many times we rolled, and how often each face came up.
// counts[0] is for the number 1, counts[1] for 2, ... counts[5] for 6.
function emptyStats() {
  return { rolls: 0, counts: [0, 0, 0, 0, 0, 0] };
}

// ===== 3. SMALL HELPERS =====

// A random whole number from 1 to 6.
// Math.random() gives 0 up to (but not including) 1.
// Multiply by 6 -> 0 to 5.99, floor it -> 0 to 5, add 1 -> 1 to 6.
// Every number has an equal chance.
function randomNumber() {
  return Math.floor(Math.random() * 6) + 1;
}

// Add up a list of numbers, e.g. [3, 4] -> 7
function sumOf(values) {
  let sum = 0;
  values.forEach((v) => (sum += v));
  return sum;
}

// true if every number in the list is the same, e.g. [4, 4]
function allMatch(values) {
  return values.every((v) => v === values[0]);
}

// ===== 4. DRAWING THE DICE =====

// Show the right dots on one die
function showFace(die, value) {
  for (let i = 0; i < 9; i++) {
    const hasDot = pipPatterns[value].includes(i);
    die.children[i].classList.toggle("on", hasDot);
  }
}

// Build all the dice from scratch (each one starts on 6)
function createDice() {
  diceArea.innerHTML = "";
  for (let i = 0; i < diceCount; i++) {
    const die = document.createElement("div");
    die.className = "die";
    for (let j = 0; j < 9; j++) {
      const pip = document.createElement("span");
      pip.className = "pip";
      die.appendChild(pip);
    }
    showFace(die, 6);
    diceArea.appendChild(die);
  }
}

// Put the table back to how it looks when the page first opens
function resetTable() {
  createDice();
  totalEl.textContent = "Press Roll (or the Space bar) to throw the dice";
}

// ===== 5. TEXT UNDER THE DICE =====

// Add a gold message line, e.g. "Doubles!"
function addMessage(text) {
  totalEl.innerHTML += '<span class="message">' + text + "</span>";
}

// After one roll: big total, then the numbers, then "Doubles!" if they match
function showTotal(values) {
  const label = values.length > 1 ? "Total of " + values.join(" + ") : "You rolled";
  totalEl.innerHTML = "<strong>" + sumOf(values) + "</strong>" + label;

  if (values.length > 1 && allMatch(values)) {
    addMessage(values.length === 2 ? "Doubles!" : "All dice match!");
  }
}

// After many rolls at once: grand total, average, and how many rolls matched
function showBatchTotal(allRolls) {
  let grandTotal = 0;
  let matches = 0;
  allRolls.forEach((values) => {
    grandTotal += sumOf(values);
    if (allMatch(values)) matches++;
  });

  const average = (grandTotal / allRolls.length).toFixed(1);
  totalEl.innerHTML =
    "<strong>" + grandTotal + "</strong>" +
    "Total of " + allRolls.length + " rolls (average " + average + " per roll)";

  if (allRolls[0].length > 1 && matches > 0) {
    addMessage("Matching dice: " + matches + (matches === 1 ? " time" : " times"));
  }
  totalEl.innerHTML += "<small>The dice show the last roll</small>";
}

// ===== 6. ROLLING =====

// times = 1 for a normal roll, 10 for "Roll x10"
function rollDice(times) {
  if (isRolling) return;          // ignore clicks while already rolling
  isRolling = true;
  updateButtons();
  totalEl.textContent = "Rolling...";

  // Start the shake (CSS does the animation)
  const dice = Array.from(diceArea.children);
  dice.forEach((die) => {
    die.classList.remove("landed");
    die.classList.add("rolling");
  });

  // While shaking, flip through random faces
  const timer = setInterval(() => {
    dice.forEach((die) => showFace(die, randomNumber()));
    playClick();
  }, FLIP_TIME);

  // When the time is up, show the real result
  setTimeout(() => finishRoll(dice, timer, times), ROLL_TIME);
}

function finishRoll(dice, timer, times) {
  clearInterval(timer);

  // Roll all the dice once for each time (1 time, or 10 times)
  const allRolls = [];
  for (let r = 0; r < times; r++) {
    const values = [];
    dice.forEach(() => values.push(randomNumber()));
    allRolls.push(values);
  }

  // The dice on screen show the last roll
  const lastRoll = allRolls[allRolls.length - 1];
  dice.forEach((die, i) => {
    showFace(die, lastRoll[i]);
    die.classList.remove("rolling");
    die.classList.add("landed");    // CSS plays the small pop
  });

  if (times === 1) {
    showTotal(lastRoll);
  } else {
    showBatchTotal(allRolls);
  }

  // Save every roll to the history and the statistics
  allRolls.forEach((values) => {
    addToHistory(values);
    addToStats(values);
  });
  playThud();

  isRolling = false;
  updateButtons();
}

// Turn buttons on or off
function updateButtons() {
  rollBtn.disabled = isRolling;
  roll10Btn.disabled = isRolling;
  minusBtn.disabled = isRolling || diceCount === MIN_DICE;
  plusBtn.disabled = isRolling || diceCount === MAX_DICE;
  clearBtn.disabled = isRolling;
  resetStatsBtn.disabled = isRolling;
}

// ===== 7. NUMBER OF DICE =====

function updateCountText() {
  countOut.textContent = diceCount + (diceCount === 1 ? " die" : " dice");
}

function changeCount(change) {
  const newCount = diceCount + change;
  if (isRolling || newCount < MIN_DICE || newCount > MAX_DICE) return;

  diceCount = newCount;
  localStorage.setItem("diceCount", diceCount);
  updateCountText();
  resetTable();
  updateButtons();
}

// ===== 8. HISTORY =====

function saveHistory() {
  localStorage.setItem("history", JSON.stringify(rollHistory));
}

function addToHistory(values) {
  rollHistory.unshift({ values: values, total: sumOf(values) });   // add to the front
  rollHistory = rollHistory.slice(0, HISTORY_LIMIT);               // keep only the newest
  saveHistory();
  showHistory();
}

function clearHistory() {
  rollHistory = [];
  saveHistory();
  showHistory();
  resetTable();
}

function showHistory() {
  historyList.innerHTML = "";
  historyList.scrollTop = 0;    // jump back to the newest roll
  rollHistory.forEach((roll) => {
    let chips = "";
    roll.values.forEach((v) => {
      chips += '<span class="chip">' + v + "</span>";
    });
    const li = document.createElement("li");
    li.innerHTML =
      '<span class="faces">' + chips + "</span>" +
      '<span class="sum">= ' + roll.total + "</span>";
    historyList.appendChild(li);
  });
  emptyMsg.hidden = rollHistory.length > 0;      // hide the message if there is history
  clearBtn.hidden = rollHistory.length === 0;    // hide Clear if there is none
}

// ===== 9. STATISTICS =====

function saveStats() {
  localStorage.setItem("stats", JSON.stringify(stats));
}

function addToStats(values) {
  stats.rolls++;
  values.forEach((v) => stats.counts[v - 1]++);
  saveStats();
  showStats();
}

function resetStats() {
  stats = emptyStats();
  saveStats();
  showStats();
  resetTable();
}

function showStats() {
  let diceThrown = 0;   // total number of single dice rolled
  let faceSum = 0;      // all the face values added together
  let biggest = 0;      // the highest count (used to scale the bars)

  for (let i = 0; i < 6; i++) {
    const count = stats.counts[i];
    diceThrown += count;
    faceSum += count * (i + 1);
    if (count > biggest) biggest = count;
  }

  rollCountEl.textContent = stats.rolls;

  // Average per die, and the average bar (an average of 1 is empty, 6 is full)
  if (diceThrown === 0) {
    averageEl.textContent = "-";
    avgBar.style.width = "0%";
  } else {
    const average = faceSum / diceThrown;
    averageEl.textContent = average.toFixed(2);
    avgBar.style.width = ((average - 1) / 5) * 100 + "%";
  }

  // One bar per face: the tallest is BAR_HEIGHT, the others are in proportion
  for (let i = 0; i < 6; i++) {
    barCounts[i].textContent = stats.counts[i];
    bars[i].style.height = biggest === 0 ? "0px" : (stats.counts[i] / biggest) * BAR_HEIGHT + "px";
  }
}

// ===== 10. SOUND =====
// No sound files needed: the browser makes the sounds itself.
let audioCtx = null;

function playSound(wave, frequency, volume, seconds) {
  if (muted) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const now = audioCtx.currentTime;

    osc.type = wave;
    osc.frequency.value = frequency;

    // Start at a volume, then fade to silence
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + seconds);
  } catch {
    // if audio is not available, just stay silent
  }
}

// Tiny click while the dice shake (the pitch changes a little each time)
function playClick() {
  playSound("square", 260 + Math.random() * 180, 0.05, 0.06);
}

// Deeper thud when the dice land
function playThud() {
  playSound("triangle", 160, 0.25, 0.25);
}

function updateSoundButton() {
  soundBtn.textContent = muted ? "🔇" : "🔊";
  soundBtn.title = muted ? "Unmute sound" : "Mute sound";
}

// ===== 11. THEME =====

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeBtn.textContent = theme === "dark" ? "☀️" : "🌙";
  themeBtn.title = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
  localStorage.setItem("theme", theme);
}

// ===== 12. BUTTON CLICKS AND KEYS =====

rollBtn.addEventListener("click", () => rollDice(1));
roll10Btn.addEventListener("click", () => rollDice(10));
minusBtn.addEventListener("click", () => changeCount(-1));
plusBtn.addEventListener("click", () => changeCount(1));
clearBtn.addEventListener("click", clearHistory);
resetStatsBtn.addEventListener("click", resetStats);

soundBtn.addEventListener("click", () => {
  muted = !muted;
  localStorage.setItem("muted", muted);
  updateSoundButton();
});

themeBtn.addEventListener("click", () => {
  const current = document.documentElement.dataset.theme;
  setTheme(current === "dark" ? "light" : "dark");
});

// Press the Space bar to roll (ignored if a button is focused,
// because Space already presses a focused button)
document.addEventListener("keydown", (event) => {
  if (event.code === "Space" && event.target.tagName !== "BUTTON") {
    event.preventDefault();   // stop the page from scrolling down
    rollDice(1);
  }
});

// ===== 13. START THE PAGE =====
setTheme(localStorage.getItem("theme") || "dark");
updateSoundButton();
updateCountText();
createDice();
showHistory();
showStats();
updateButtons();