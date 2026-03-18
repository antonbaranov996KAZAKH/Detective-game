// ================= GLOBAL =================
let isGameRunning = false;
let endTime = null;
let teamCode = '';
let tripCounter = 0;

// ---------------- LOGIN ----------------
const ADMIN_PASSWORD = 'admin123';

function login() {
  const code = document.getElementById('teamCode').value.trim();
  const pass = document.getElementById('adminPass').value.trim();

  if (pass === ADMIN_PASSWORD) {
    // Вход админа
    fetch('/api/admin/history')
      .then(res => res.json())
      .then(data => {
        updateAdminTable(data.allTrips);
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('admin-screen').style.display = 'block';
      })
      .catch(err => alert('Ошибка связи с сервером'));
  } else {
    // Игрок
    if (!code) return alert('Введите код команды');

    teamCode = code;

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
    })
    .catch(err => alert('Ошибка связи с сервером'));
  }
}

// ---------------- TIMER ----------------
function updateTimer() {
  if (!isGameRunning || !endTime) {
    document.getElementById('timer')?.textContent = "Остановлен";
    return;
  }

  const now = Date.now();
  const diff = endTime - now;

  if (diff <= 0) {
    isGameRunning = false;
    document.getElementById('timer')?.textContent = "00:00";
    return;
  }

  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  document.getElementById('timer')?.textContent =
    `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function fetchGameStatus() {
  fetch('/api/status')
    .then(res => res.json())
    .then(data => {
      isGameRunning = data.isRunning;
      endTime = data.endTime;
    })
    .catch(err => console.warn('Не удалось получить статус игры'));
}

// ---------------- TRIP ----------------
function goTrip() {
  if (!isGameRunning) return alert('Игра ещё не началась!');

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

    // Анимация счетчика
    tripsEl.classList.remove('jump');
    void tripsEl.offsetWidth;
    tripsEl.classList.add('jump');

    updateHistory(data.tripsHistory);
    alert(data.info);
  })
  .catch(err => alert('Ошибка связи с сервером'));
}

function updateHistory(history) {
  const ul = document.getElementById('tripsHistory');
  ul.innerHTML = '';
  history.forEach(h => {
    const li = document.createElement('li');
    li.textContent = `${h.time} — ${h.address} → ${h.info}`;
    ul.appendChild(li);
  });
}

// ---------------- ADMIN ----------------
function startGame(minutes) {
  fetch('/api/admin/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ minutes, password: ADMIN_PASSWORD })
  })
  .then(res => res.json())
  .then(data => alert(data.message))
  .catch(err => alert('Ошибка связи с сервером'));
}

function stopGame() {
  fetch('/api/admin/stop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: ADMIN_PASSWORD })
  })
  .then(res => res.json())
  .then(data => alert(data.message))
  .catch(err => alert('Ошибка связи с сервером'));
}

function resetAllData() {
  if (!confirm('Вы точно хотите сбросить все данные?')) return;

  fetch('/api/admin/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: ADMIN_PASSWORD })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      alert('Данные сброшены');
      document.getElementById('adminHistory').innerHTML = '';
    } else alert('Ошибка сброса');
  })
  .catch(err => alert('Ошибка связи с сервером'));
}

function updateAdminTable(allTrips) {
  const tbody = document.getElementById('adminHistory');
  tbody.innerHTML = '';
  allTrips.forEach(trip => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${trip.team}</td><td>${trip.time}</td><td>${trip.address}</td><td>${trip.info}</td>`;
    tbody.appendChild(tr);
  });
}

// ---------------- AUTO UPDATE ----------------
setInterval(() => {
  fetchGameStatus();
  updateTimer();

  // Автообновление админки
  if (document.getElementById('admin-screen').style.display === 'block') {
    fetch('/api/admin/history')
      .then(res => res.json())
      .then(data => updateAdminTable(data.allTrips))
      .catch(err => console.warn('Не удалось обновить админку'));
  }
}, 1000);
