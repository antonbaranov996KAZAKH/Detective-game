let isGameRunning = false;
let endTime = null;
let teamCode = '';
let tripCounter = 0;

// ================= LOGIN =================
async function login() {
  teamCode = document.getElementById('teamCode').value.trim();
  if (!teamCode) return alert('Введите код команды');

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamCode })
    });

    const data = await res.json();

    if (!data.success) return alert('Ошибка входа');

    tripCounter = data.tripsHistory.length;

    document.getElementById('tripsLeft').textContent = tripCounter;
    document.getElementById('teamCodeDisplay').textContent = teamCode;

    updateHistory(data.tripsHistory);

    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('game').style.display = 'block';

  } catch (err) {
    console.error(err);
    alert('Ошибка связи с сервером');
  }
}

// ================= TIMER =================
function updateTimer() {
  const timerEl = document.getElementById('timer');
  if (!timerEl) return; // защита от ошибки

  if (!isGameRunning || !endTime) {
    timerEl.textContent = "Остановлен";
    return;
  }

  const diff = endTime - Date.now();

  if (diff <= 0) {
    isGameRunning = false;
    timerEl.textContent = "00:00";
    return;
  }

  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  timerEl.textContent =
    `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// ================= STATUS =================
async function fetchGameStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();

    isGameRunning = data.isRunning;
    endTime = data.endTime;

  } catch (err) {
    console.error('Ошибка статуса:', err);
  }
}

// ================= TRIP =================
async function goTrip() {
  if (!isGameRunning) {
    alert('Игра ещё не началась!');
    return;
  }

  const address = document.getElementById('addressInput').value.trim();
  if (!address) return alert('Введите адрес');

  if (!confirm('Вы действительно хотите совершить поездку?')) return;

  try {
    const res = await fetch('/api/trip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamCode, address })
    });

    const data = await res.json();

    if (!data.success) return alert(data.info);

    tripCounter++;

    const tripsEl = document.getElementById('tripsLeft');
    tripsEl.textContent = tripCounter;

    // анимация
    tripsEl.classList.remove('jump');
    void tripsEl.offsetWidth;
    tripsEl.classList.add('jump');

    updateHistory(data.tripsHistory);

    document.getElementById('addressInput').value = '';

    const historyBox = document.getElementById('history-box');
    historyBox.scrollTop = historyBox.scrollHeight;

    alert(data.info);

  } catch (err) {
    console.error(err);
    alert('Ошибка сервера');
  }
}

// ================= ADMIN =================
async function startGame(minutes) {
  try {
    const res = await fetch('/api/admin/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minutes })
    });

    const data = await res.json();
    alert(data.message);

  } catch (err) {
    console.error(err);
    alert('Ошибка запуска');
  }
}

async function stopGame() {
  try {
    const res = await fetch('/api/admin/stop', {
      method: 'POST'
    });

    const data = await res.json();
    alert(data.message);

  } catch (err) {
    console.error(err);
    alert('Ошибка остановки');
  }
}

// ================= HISTORY =================
function updateHistory(history) {
  const ul = document.getElementById('tripsHistory');
  ul.innerHTML = '';

  history.forEach(h => {
    const li = document.createElement('li');
    li.textContent = `${h.time} — ${h.address} → ${h.info}`;
    ul.appendChild(li);
  });
}

// ================= AUTO UPDATE =================
setInterval(() => {
  fetchGameStatus();
  updateTimer();
}, 1000);
