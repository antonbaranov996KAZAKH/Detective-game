let isGameRunning = false;
let endTime = null;
let teamCode = '';
let tripCounter = 0;

// ================= LOGIN =================
function login() {
  teamCode = document.getElementById('teamCode').value.trim();
  if (!teamCode) return alert('Введите код команды');

  fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teamCode })
  })
  .then(res => res.json())
  .then(data => {
    if (!data.success) return alert('Ошибка входа');

    tripCounter = data.tripsHistory.length;
    document.getElementById('tripsLeft').textContent = tripCounter;
    document.getElementById('teamCodeDisplay').textContent = teamCode;

    updateHistory(data.tripsHistory);

    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('game').style.display = 'block';
  });
}

// ================= TIMER =================
function updateTimer() {
  if (!isGameRunning || !endTime) {
    document.getElementById('timer').textContent = "Остановлен";
    return;
  }

  const now = Date.now();
  const diff = endTime - now;

  if (diff <= 0) {
    isGameRunning = false;
    document.getElementById('timer').textContent = "00:00";
    return;
  }

  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  document.getElementById('timer').textContent =
    `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function fetchGameStatus() {
  fetch('/api/status')
    .then(res => res.json())
    .then(data => {
      isGameRunning = data.isRunning;
      endTime = data.endTime;
    });
}

// ================= TRIP =================
function goTrip() {
  if (!isGameRunning) {
    alert('Игра ещё не началась!');
    return;
  }

  const address = document.getElementById('addressInput').value.trim();
  if (!address) return alert('Введите адрес');

  if (!confirm('Вы действительно хотите совершить поездку?')) return;

  fetch('/api/trip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teamCode, address })
  })
  .then(res => res.json())
  .then(data => {
    if (!data.success) return alert(data.info);

    tripCounter++;

    const tripsEl = document.getElementById('tripsLeft');
    tripsEl.textContent = tripCounter;

    // анимация
    tripsEl.classList.remove('jump');
    void tripsEl.offsetWidth;
    tripsEl.classList.add('jump');

    updateHistory(data.tripsHistory);
    alert(data.info);

    const historyBox = document.getElementById('history-box');
    historyBox.scrollTop = historyBox.scrollHeight;
  });
}

// ================= ADMIN =================
function startGame(minutes) {
  fetch('/api/admin/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ minutes })
  })
  .then(res => res.json())
  .then(data => alert(data.message));
}

function stopGame() {
  fetch('/api/admin/stop', { method: 'POST' })
    .then(res => res.json())
    .then(data => alert(data.message));
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