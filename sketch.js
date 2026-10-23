const STORAGE_KEY = "classroom-lottery-names";
const MAX_NUMBER_RANGE = 10000;
const DRAW_DURATION = 2000;

let lotteryMode = "number";
let drawnIds = new Set();
let historyItems = [];
let isDrawing = false;
let drawingStartedAt = 0;
let lastShuffleAt = 0;
let drawingPool = [];
let drawingCount = 1;
let finalSelection = [];
let confetti = [];
let audioContext;

function setup() {
  const page = document.getElementById("app");
  page.innerHTML = `
    <main class="app-shell">
      <header class="topbar">
        <div class="brand">
          <div class="brand-mark" aria-hidden="true">抽</div>
          <div>
            <p class="eyebrow">CLASSROOM TOOL</p>
            <h1>課堂抽籤機</h1>
          </div>
        </div>
        <div class="live-badge"><span class="live-dot"></span>準備好開始了嗎？</div>
      </header>

      <div class="workspace">
        <section class="panel settings-panel" aria-labelledby="settings-title">
          <div class="section-heading">
            <div>
              <p class="eyebrow">DRAW SETTINGS</p>
              <h2 id="settings-title">抽籤設定</h2>
            </div>
            <span class="step-number">01</span>
          </div>

          <div class="field-group">
            <span class="field-label">抽籤模式</span>
            <div class="mode-switch" role="group" aria-label="抽籤模式">
              <button class="mode-button is-active" type="button" data-mode="number" aria-pressed="true">🔢 號碼</button>
              <button class="mode-button" type="button" data-mode="name" aria-pressed="false">👥 姓名</button>
            </div>
          </div>

          <div id="number-fields" class="field-group">
            <span class="field-label">號碼範圍</span>
            <div class="range-fields">
              <label class="input-wrap">
                <span class="sr-only">起始號碼</span>
                <input id="start-number" type="number" value="1" step="1" inputmode="numeric">
              </label>
              <span class="range-divider">到</span>
              <label class="input-wrap">
                <span class="sr-only">結束號碼</span>
                <input id="end-number" type="number" value="30" step="1" inputmode="numeric">
              </label>
            </div>
            <p class="field-hint">輸入要參加抽籤的起始與結束號碼</p>
          </div>

          <div id="name-fields" class="field-group" hidden>
            <label class="field-label" for="name-list">班級名單</label>
            <textarea id="name-list" rows="5" placeholder="每行輸入一位同學姓名&#10;王小明&#10;林小華&#10;陳同學"></textarea>
            <p class="field-hint">名單會自動儲存在這台裝置，下次開啟仍會保留。</p>
          </div>

          <div class="field-group">
            <label class="field-label" for="excluded-list">排除對象 <span class="optional-tag">選填</span></label>
            <textarea id="excluded-list" class="exclusion-input" rows="2" placeholder="輸入要排除的號碼或姓名，以逗號或換行分隔"></textarea>
            <p class="field-hint">例如：5, 12　或　請假同學姓名</p>
          </div>

          <div class="field-group draw-options">
            <label class="field-label" for="draw-count">一次抽出</label>
            <div class="count-control">
              <input id="draw-count" type="number" min="1" value="1" step="1" inputmode="numeric">
              <span>位</span>
            </div>
          </div>

          <label class="toggle-row" for="no-repeat">
            <span class="toggle-copy">
              <strong>不重複抽籤</strong>
              <span>抽過的對象不會再次出現</span>
            </span>
            <input id="no-repeat" type="checkbox" checked>
            <span class="toggle-track" aria-hidden="true"></span>
          </label>

          <div id="feedback" class="feedback" role="status" aria-live="polite"></div>
          <button id="draw-button" class="draw-button" type="button">
            <span aria-hidden="true">✦</span>
            <span>開始抽籤</span>
            <span class="button-arrow" aria-hidden="true">→</span>
          </button>
          <p class="keyboard-hint">按下按鈕，看看今天的幸運兒是誰！</p>
        </section>

        <div class="right-column">
          <section class="panel stage-panel" aria-labelledby="stage-title">
            <div class="stage-topline">
              <div>
                <p class="eyebrow">LET'S FIND OUT</p>
                <h2 id="stage-title">幸運兒是⋯⋯</h2>
              </div>
              <div id="remaining-badge" class="remaining-badge">
                <span>剩餘可抽</span><strong id="remaining-count">30</strong><span>位</span>
              </div>
            </div>
            <div id="result-display" class="result-display" aria-live="polite" aria-atomic="true">
              <span class="result-placeholder">準備揭曉</span>
            </div>
            <p id="result-caption" class="result-caption">按下「開始抽籤」，讓好運揭曉！</p>
            <div class="stage-decoration" aria-hidden="true"><span>✦</span><span>✧</span><span>✦</span></div>
          </section>

          <section class="panel history-panel" aria-labelledby="history-title">
            <div class="history-heading">
              <div>
                <p class="eyebrow">THE DRAW SO FAR</p>
                <h2 id="history-title">抽籤紀錄 <span id="history-count" class="history-count">0</span></h2>
              </div>
              <button id="reset-button" class="reset-button" type="button">↻ 重置紀錄</button>
            </div>
            <ol id="history-list" class="history-list">
              <li class="history-empty">還沒有抽籤紀錄</li>
            </ol>
          </section>
        </div>
      </div>
      <footer class="footer-note">每一次抽籤，都是一次公平又有趣的驚喜。</footer>
    </main>
    <div id="effects" aria-hidden="true"></div>
  `;

  const savedNames = loadSavedNames();
  document.getElementById("name-list").value = savedNames;
  bindControls();
  const canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("effects");
  canvas.elt.setAttribute("aria-hidden", "true");
  refreshAvailability();
}

function bindControls() {
  document.querySelectorAll(".mode-button").forEach((button) => {
    button.addEventListener("click", () => {
      if (isDrawing) return;
      lotteryMode = button.dataset.mode;
      document.querySelectorAll(".mode-button").forEach((item) => {
        const selected = item === button;
        item.classList.toggle("is-active", selected);
        item.setAttribute("aria-pressed", String(selected));
      });
      document.getElementById("number-fields").hidden = lotteryMode !== "number";
      document.getElementById("name-fields").hidden = lotteryMode !== "name";
      clearFeedback();
      refreshAvailability();
    });
  });

  ["start-number", "end-number", "name-list", "excluded-list", "draw-count", "no-repeat"].forEach((id) => {
    const input = document.getElementById(id);
    input.addEventListener("input", onSettingsChanged);
    input.addEventListener("change", onSettingsChanged);
  });

  document.getElementById("draw-button").addEventListener("click", drawLottery);
  document.getElementById("reset-button").addEventListener("click", resetLottery);
}

function setSettingsDisabled(disabled) {
  document.querySelectorAll(
    ".mode-button, #start-number, #end-number, #name-list, #excluded-list, #draw-count, #no-repeat"
  ).forEach((control) => {
    control.disabled = disabled;
  });
}

function onSettingsChanged(event) {
  clearFeedback();
  if (event.target.id === "name-list") saveNames(event.target.value);
  refreshAvailability();
}

function loadSavedNames() {
  try {
    return localStorage.getItem(STORAGE_KEY) || "";
  } catch (error) {
    showFeedback("無法讀取這台裝置的名單儲存空間。", "error");
    return "";
  }
}

function saveNames(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch (error) {
    showFeedback("名單無法儲存，請確認瀏覽器允許使用本機儲存空間。", "error");
  }
}

function getSource() {
  if (lotteryMode === "number") {
    const start = document.getElementById("start-number").valueAsNumber;
    const end = document.getElementById("end-number").valueAsNumber;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
      return { candidates: [], error: "請輸入有效的整數起訖號碼。" };
    }
    if (start > end) {
      return { candidates: [], error: "起始號碼不可大於結束號碼，請重新確認範圍。" };
    }
    if (end - start + 1 > MAX_NUMBER_RANGE) {
      return { candidates: [], error: `號碼範圍最多可設定 ${MAX_NUMBER_RANGE.toLocaleString()} 位。` };
    }
    return {
      candidates: Array.from({ length: end - start + 1 }, (_, index) => {
        const value = start + index;
        return { id: `number:${value}`, label: String(value), value };
      }),
      error: ""
    };
  }

  const names = [...new Set(document.getElementById("name-list").value
    .split(/\r?\n/)
    .map((name) => name.trim())
    .filter(Boolean))];
  if (!names.length) {
    return { candidates: [], error: "請先貼上名單，每行輸入一位同學姓名。" };
  }
  return {
    candidates: names.map((name) => ({ id: `name:${name}`, label: name })),
    error: ""
  };
}

function getExcludedTokens() {
  const text = document.getElementById("excluded-list").value.trim();
  if (!text) return new Set();
  const parts = lotteryMode === "number"
    ? text.split(/[,\s，、]+/)
    : text.split(/[,\n，、]+/);
  return new Set(parts.map((part) => part.trim()).filter(Boolean));
}

function getEligibleCandidates() {
  const source = getSource();
  if (source.error) return { candidates: [], error: source.error };

  const excluded = getExcludedTokens();
  const candidates = source.candidates.filter((candidate) => !excluded.has(candidate.label));
  return { candidates, error: "" };
}

function refreshAvailability() {
  const result = getEligibleCandidates();
  const noRepeat = document.getElementById("no-repeat").checked;
  const available = noRepeat
    ? result.candidates.filter((candidate) => !drawnIds.has(candidate.id)).length
    : result.candidates.length;
  document.getElementById("remaining-count").textContent = result.error ? "—" : String(available);
  document.getElementById("remaining-badge").classList.toggle("is-empty", !result.error && available === 0);
  document.getElementById("remaining-badge").querySelector("span").textContent = noRepeat ? "剩餘可抽" : "目前可抽";
}

function drawLottery() {
  if (isDrawing) return;

  const { candidates, error } = getEligibleCandidates();
  if (error) {
    showFeedback(error, "error");
    return;
  }

  const count = Number(document.getElementById("draw-count").value);
  if (!Number.isSafeInteger(count) || count < 1) {
    showFeedback("請輸入至少 1 位抽籤人數。", "error");
    return;
  }

  const noRepeat = document.getElementById("no-repeat").checked;
  const available = noRepeat
    ? candidates.filter((candidate) => !drawnIds.has(candidate.id))
    : candidates;
  if (available.length < count) {
    showFeedback(`可抽人數不足：目前只有 ${available.length} 位，無法抽出 ${count} 位。請調整人數、排除名單或抽籤範圍。`, "error");
    return;
  }

  clearFeedback();
  prepareAudio();
  drawingPool = shuffle([...available]);
  finalSelection = drawingPool.slice(0, count);
  drawingCount = count;
  drawingStartedAt = millis();
  lastShuffleAt = 0;
  isDrawing = true;
  setSettingsDisabled(true);
  document.getElementById("draw-button").disabled = true;
  document.getElementById("draw-button").querySelector("span:nth-child(2)").textContent = "抽籤中⋯";
  document.getElementById("result-caption").textContent = "好運正在轉動，準備揭曉！";
}

function draw() {
  clear();
  if (isDrawing) {
    const elapsed = millis() - drawingStartedAt;
    if (elapsed >= DRAW_DURATION) {
      finishDrawing();
    } else if (millis() - lastShuffleAt >= 65) {
      lastShuffleAt = millis();
      const rolling = shuffle([...drawingPool]).slice(0, drawingCount);
      showResult(rolling.map((person) => person.label));
    }
  }

  if (confetti.length) drawConfetti();
}

function finishDrawing() {
  isDrawing = false;
  const noRepeat = document.getElementById("no-repeat").checked;
  if (noRepeat) finalSelection.forEach((person) => drawnIds.add(person.id));
  showResult(finalSelection.map((person) => person.label));
  addHistoryItem(finalSelection.map((person) => person.label));
  document.getElementById("result-caption").textContent = `恭喜 ${finalSelection.length} 位幸運兒！`;
  document.getElementById("draw-button").disabled = false;
  document.getElementById("draw-button").querySelector("span:nth-child(2)").textContent = "再抽一次";
  setSettingsDisabled(false);
  launchConfetti();
  playCelebrationSound();
  refreshAvailability();
}

function showResult(labels) {
  const display = document.getElementById("result-display");
  display.replaceChildren();
  labels.forEach((label) => {
    const chip = document.createElement("span");
    chip.className = "result-name";
    chip.textContent = label;
    display.appendChild(chip);
  });
  display.classList.toggle("is-multiple", labels.length > 1);
}

function addHistoryItem(labels) {
  historyItems.unshift({ labels, time: new Date() });
  const list = document.getElementById("history-list");
  list.replaceChildren();
  historyItems.forEach((item, index) => {
    const entry = document.createElement("li");
    entry.className = "history-entry";

    const number = document.createElement("span");
    number.className = "history-index";
    number.textContent = String(historyItems.length - index).padStart(2, "0");

    const names = document.createElement("span");
    names.className = "history-names";
    names.textContent = item.labels.join("、");

    const time = document.createElement("time");
    time.className = "history-time";
    time.dateTime = item.time.toISOString();
    time.textContent = item.time.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });

    entry.append(number, names, time);
    list.appendChild(entry);
  });
  document.getElementById("history-count").textContent = String(historyItems.length);
}

function resetLottery() {
  drawnIds.clear();
  historyItems = [];
  finalSelection = [];
  confetti = [];
  isDrawing = false;
  setSettingsDisabled(false);
  document.getElementById("history-list").innerHTML = '<li class="history-empty">還沒有抽籤紀錄</li>';
  document.getElementById("history-count").textContent = "0";
  document.getElementById("result-display").innerHTML = '<span class="result-placeholder">準備揭曉</span>';
  document.getElementById("result-caption").textContent = "按下「開始抽籤」，讓好運揭曉！";
  document.getElementById("draw-button").disabled = false;
  document.getElementById("draw-button").querySelector("span:nth-child(2)").textContent = "開始抽籤";
  clearFeedback();
  refreshAvailability();
}

function showFeedback(message, type) {
  const feedback = document.getElementById("feedback");
  feedback.textContent = message;
  feedback.className = `feedback is-visible ${type === "error" ? "is-error" : "is-info"}`;
}

function clearFeedback() {
  const feedback = document.getElementById("feedback");
  feedback.textContent = "";
  feedback.className = "feedback";
}

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const otherIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[otherIndex]] = [items[otherIndex], items[index]];
  }
  return items;
}

function launchConfetti() {
  const colors = ["#f7c948", "#ff6b6b", "#55d6be", "#a78bfa", "#63a6ff", "#ff9f68"];
  confetti = Array.from({ length: 150 }, () => ({
    x: random(windowWidth),
    y: random(-windowHeight * 0.35, 0),
    size: random(5, 11),
    speedY: random(2.2, 6.2),
    speedX: random(-2.4, 2.4),
    rotation: random(TWO_PI),
    rotationSpeed: random(-0.12, 0.12),
    color: random(colors),
    shape: random() > 0.45 ? "rect" : "circle"
  }));
}

function drawConfetti() {
  noStroke();
  confetti = confetti.filter((piece) => piece.y < windowHeight + 25);
  confetti.forEach((piece) => {
    piece.x += piece.speedX;
    piece.y += piece.speedY;
    piece.speedX += sin(piece.y * 0.025) * 0.025;
    piece.rotation += piece.rotationSpeed;
    fill(piece.color);
    push();
    translate(piece.x, piece.y);
    rotate(piece.rotation);
    if (piece.shape === "rect") rect(-piece.size / 2, -piece.size / 2, piece.size, piece.size * 0.62, 2);
    else ellipse(0, 0, piece.size, piece.size);
    pop();
  });
}

function playCelebrationSound() {
  if (!audioContext) return;
  try {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    const startTime = audioContext.currentTime;
    notes.forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const noteStart = startTime + index * 0.11;
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.16, noteStart + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.3);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(noteStart);
      oscillator.stop(noteStart + 0.31);
    });
  } catch (error) {
    showFeedback("抽籤完成，但音效無法播放。", "info");
  }
}

function prepareAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    showFeedback("這個瀏覽器不支援 Web Audio 音效，抽籤仍會繼續。", "info");
    return;
  }

  try {
    if (!audioContext) audioContext = new AudioContextClass();
    if (audioContext.state === "suspended") {
      audioContext.resume().catch(() => {
        showFeedback("瀏覽器未允許啟用音效，抽籤仍會繼續。", "info");
      });
    }
  } catch (error) {
    showFeedback("無法啟用音效，抽籤仍會繼續。", "info");
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
