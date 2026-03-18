// ================= GLOBAL =================
let isGameRunning = false;
let endTime = null;
let teamCode = '';
let isAdmin = false;
let tripCounter = 0;
const ADMIN_PASSWORD = 'admin123';

let gameInterval = null;
let adminInterval = null;

// ================= LOGIN =================
async function login() {
  const code = document.getElementById('teamCode').value.trim();
  const pass = document.getElementById('adminPass').value.trim();

  if(pass === ADMIN_PASSWORD) {
    isAdmin = true;
    try {
      const res = await fetch('/api/admin/history');
      const data = await res.json();
      updateAdminTable(data.allTrips || []);
      showAdminScreen();
      startAdminUpdates();
    } catch (err) {
      alert('Ошибка связи с сервером');
    }
  } else {
    if(!code) return alert('Введите код команды');
    teamCode = code;
    
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({teamCode})
      });
      const data = await res.json();
      
      if(!data.success) return alert('Ошибка входа');
      
      tripCounter = data.tripsHistory.length;
      document.getElementById('tripsLeft').textContent = tripCounter;
      document.getElementById('teamCodeDisplay').textContent = teamCode;
      updateHistory(data.tripsHistory);
      showGameScreen();
      startGameUpdates();
    } catch (err) {
      alert('Ошибка связи с сервером');
    }
  }
}

function showAdminScreen() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('admin-screen').style.display = 'block';
}

function showGameScreen() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('game').style.display = 'block';
}

// ================= GAME STATUS =================
async function updateGameStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    isGameRunning = data.isRunning;
    endTime = data.endTime;
    updateTimer();
  } catch (err) {
    console.warn('Не удалось получить статус игры');
  }
}

function updateTimer() {
  const timerEl = document.getElementById('timer');
  
  if(!isGameRunning || !endTime) {
    timerEl.textContent = "Остановлен";
    return;
  }
  
  const diff = endTime - Date.now();
  if(diff <= 0) {
    isGameRunning = false;
    timerEl.textContent = "00:00";
    return;
  }
  
  const minutes = Math.floor(diff/60000);
  const seconds = Math.floor((diff%60000)/1000);
  timerEl.textContent = `${minutes}:${seconds.toString().padStart(2,'0')}`;
}

// ================= TRIP =================
async function goTrip() {
  if(!isGameRunning) return alert('Игра ещё не началась!');
  
  const address = document.getElementById('addressInput').value.trim();
  if(!address) return alert('Введите адрес');
  if(address.length < 3) return alert('Адрес слишком короткий');
  if(address.length > 200) return alert('Адрес слишком длинный');

  try {
    const res = await fetch('/api/trip', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({teamCode, address})
    });
    
    const data = await res.json();
    
    if(!data.success) return alert(data.info);
    
    tripCounter++;
    updateTripCounter();
    updateHistory(data.tripsHistory);
    
  } catch (err) {
    alert('Ошибка связи с сервером');
  }
}

function updateTripCounter() {
  const tripsEl = document.getElementById('tripsLeft');
  tripsEl.textContent = tripCounter;
  
  // Рестарт анимации
  tripsEl.classList.remove('jump');
  void tripsEl.offsetWidth; // Форсируем reflow
  tripsEl.classList.add('jump');
}

function updateHistory(history) {
  const ul = document.getElementById('tripsHistory');
  ul.innerHTML = '';
  
  // Показываем последние 20 поездок
  history.slice(-20).reverse().forEach(h => {
    const li = document.createElement('li');
    li.textContent = `${h.time} — ${h.address} → ${h.info}`;
    ul.appendChild(li);
  });
}

// ================= ADMIN =================
async function adminRequest(endpoint, extraData = {}) {
  try {
    const res = await fetch(`/api/admin/${endpoint}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({password: ADMIN_PASSWORD, ...extraData})
    });
    return await res.json();
  } catch (err) {
    alert('Ошибка связи с сервером');
    return null;
  }
}

async function startGame(minutes) {
  const data = await adminRequest('start', { minutes });
  if (data) alert(data.message);
}

async function stopGame() {
  const data = await adminRequest('stop');
  if (data) alert(data.message);
}

async function resetAllData() {
  if(!confirm('Вы точно хотите сбросить все данные?')) return;
  
  const data = await adminRequest('reset');
  if (data?.success) {
    alert('Данные сброшены');
    document.getElementById('adminHistory').innerHTML = '';
  } else {
    alert('Ошибка сброса');
  }
}

async function updateAdminData() {
  try {
    const res = await fetch('/api/admin/history');
    const data = await res.json();
    updateAdminTable(data.allTrips || []);
  } catch (err) {
    const tbody = document.getElementById('adminHistory');
    tbody.innerHTML = '<tr><td colspan="4">Ошибка загрузки данных</td></tr>';
  }
}

function updateAdminTable(allTrips) {
  const tbody = document.getElementById('adminHistory');
  tbody.innerHTML = '';
  
  // Сортируем по времени (новые сверху)
  allTrips.sort((a, b) => new Date(b.time) - new Date(a.time));
  
  allTrips.forEach(trip => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${trip.team}</td>
      <td>${trip.time}</td>
      <td>${trip.address}</td>
      <td>${trip.info}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ================= UPDATES CONTROL =================
function startGameUpdates() {
  if (gameInterval) clearInterval(gameInterval);
  updateGameStatus(); // Первое обновление сразу
  gameInterval = setInterval(updateGameStatus, 1000);
}

function startAdminUpdates() {
  if (adminInterval) clearInterval(adminInterval);
  updateAdminData(); // Первое обновление сразу
  adminInterval = setInterval(updateAdminData, 2000);
}

function stopAllUpdates() {
  if (gameInterval) {
    clearInterval(gameInterval);
    gameInterval = null;
  }
  if (adminInterval) {
    clearInterval(adminInterval);
    adminInterval = null;
  }
}

// Очистка при уходе со страницы
window.addEventListener('beforeunload', stopAllUpdates);

// Добавить кнопку выхода (нужно добавить в HTML)
function logout() {
  stopAllUpdates();
  teamCode = '';
  isAdmin = false;
  tripCounter = 0;
  document.getElementById('game').style.display = 'none';
  document.getElementById('admin-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('teamCode').value = '';
  document.getElementById('adminPass').value = '';
}
