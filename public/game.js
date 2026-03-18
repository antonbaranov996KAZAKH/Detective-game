// ================= ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =================
let isGameRunning = false;
let endTime = null;
let serverTimeDiff = 0;
let teamCode = '';
let tripCounter = 0;
let lastSyncTime = 0;
let syncInterval = null;

// ================= УВЕДОМЛЕНИЯ =================
function showNotification(message, type = 'info') {
  const notification = document.getElementById('notification');
  if (!notification) return;
  
  notification.textContent = message;
  notification.className = `notification ${type}`;
  notification.style.display = 'block';
  
  setTimeout(() => {
    notification.style.display = 'none';
  }, 3000);
}

// ================= ЛОГИН =================
function login() {
  const code = document.getElementById('teamCode')?.value.trim();
  const pass = document.getElementById('adminPass')?.value.trim();

  if (pass) {
    window.location.href = '/admin.html';
    return;
  }

  if (!code) {
    showNotification('Введите код команды', 'error');
    return;
  }
  
  teamCode = code;
  
  fetch('/api/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({teamCode})
  })
  .then(res => res.json())
  .then(data => {
    if(!data.success) {
      showNotification('Ошибка входа', 'error');
      return;
    }
    
    tripCounter = data.tripsHistory.length;
    document.getElementById('tripsLeft').textContent = tripCounter;
    document.getElementById('teamCodeDisplay').textContent = teamCode;
    updateHistory(data.tripsHistory);
    
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('game').style.display = 'block';
    
    showNotification(`Добро пожаловать, команда ${teamCode}!`, 'success');
    
    // 👇 ЗАПУСКАЕМ СИНХРОНИЗАЦИЮ
    startSync();
  })
  .catch(err => showNotification('Ошибка связи с сервером', 'error'));
}

// ================= СИНХРОНИЗАЦИЯ =================
function startSync() {
  // Синхронизируем каждые 3 секунды
  if (syncInterval) clearInterval(syncInterval);
  syncInterval = setInterval(syncTeamData, 3000);
}

function stopSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

function syncTeamData() {
  if (!teamCode) return;
  
  fetch(`/api/team/${teamCode}/sync`)
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        // Обновляем историю, если она изменилась
        const currentLength = document.getElementById('tripsHistory').children.length;
        if (data.tripsHistory.length !== currentLength) {
          console.log('🔄 Обнаружены изменения, синхронизируем...');
          updateHistory(data.tripsHistory);
          tripCounter = data.tripsHistory.length;
          document.getElementById('tripsLeft').textContent = tripCounter;
          
          // Анимация обновления
          const tripsEl = document.getElementById('tripsLeft');
          tripsEl.classList.remove('jump');
          void tripsEl.offsetWidth;
          tripsEl.classList.add('jump');
          
          showNotification('📱 Данные синхронизированы', 'info');
        }
        lastSyncTime = Date.now();
      }
    })
    .catch(err => console.warn('Ошибка синхронизации:', err));
}

// ================= ТАЙМЕР =================
function updateTimer() {
  const timerElement = document.getElementById('timer');
  if (!timerElement) return;
  
  if(!isGameRunning || !endTime) {
    timerElement.textContent = "⏸️ Остановлен";
    timerElement.style.color = '#888';
    return;
  }
  
  const now = Date.now() + serverTimeDiff;
  const diff = endTime - now;
  
  if(diff <= 0) {
    isGameRunning = false;
    timerElement.textContent = "⏰ 00:00";
    timerElement.style.color = '#f44336';
    fetchGameStatus();
    showNotification('Время игры истекло!', 'info');
    return;
  }
  
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  
  if (minutes < 1) {
    timerElement.style.color = '#f44336';
  } else if (minutes < 5) {
    timerElement.style.color = '#ff9800';
  } else {
    timerElement.style.color = '#4CAF50';
  }
  
  timerElement.textContent = `⏱️ ${minutes}:${seconds.toString().padStart(2,'0')}`;
}

// ================= СТАТУС ИГРЫ =================
function fetchGameStatus() {
  return fetch('/api/status')
    .then(res => res.json())
    .then(data => { 
      if (data.serverTime) {
        serverTimeDiff = data.serverTime - Date.now();
      }
      
      isGameRunning = data.isRunning; 
      endTime = data.endTime;
      
      updateTimer();
      
      return data;
    })
    .catch(err => {
      console.warn('Не удалось получить статус игры:', err);
      return null;
    });
}

// ================= ПОЕЗДКА =================
function goTrip() {
  if(!isGameRunning) {
    showNotification('⏸️ Игра ещё не началась!', 'error');
    return;
  }
  
  const address = document.getElementById('addressInput').value.trim();
  if(!address) {
    showNotification('❌ Введите адрес', 'error');
    return;
  }

  // Блокируем кнопку на время запроса
  const goButton = event.target;
  goButton.disabled = true;
  goButton.textContent = '⏳ Отправка...';

  fetch('/api/trip', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({teamCode, address})
  })
  .then(res => res.json())
  .then(data => {
    if(!data.success) {
      showNotification(data.info, 'error');
      return;
    }
    
    showNotification('✅ ' + data.info, 'success');
    
    tripCounter = data.tripsHistory.length;
    const tripsEl = document.getElementById('tripsLeft');
    tripsEl.textContent = tripCounter;
    
    tripsEl.classList.remove('jump');
    void tripsEl.offsetWidth;
    tripsEl.classList.add('jump');
    
    updateHistory(data.tripsHistory);
    document.getElementById('addressInput').value = '';
    
    // 👇 ПОКАЗЫВАЕМ, КТО СДЕЛАЛ ПОЕЗДКУ
    const lastTrip = data.tripsHistory[data.tripsHistory.length - 1];
    if (lastTrip) {
      showNotification(`🚗 Поездка засчитана!`, 'success');
    }
  })
  .catch(err => showNotification('❌ Ошибка связи с сервером', 'error'))
  .finally(() => {
    // Разблокируем кнопку
    goButton.disabled = false;
    goButton.textContent = '🚗 Поехать';
  });
}

// ================= ИСТОРИЯ =================
function updateHistory(history) {
  const ul = document.getElementById('tripsHistory');
  if (!ul) return;
  
  ul.innerHTML = '';
  
  // Показываем последние 30 поездок
  history.slice(-30).reverse().forEach((h, index) => {
    const li = document.createElement('li');
    li.style.opacity = '0';
    li.style.animation = `fadeIn 0.3s ease ${index * 0.1}s forwards`;
    
    if (h.info === 'По этому адресу ничего интересного не обнаружено') {
      li.style.color = '#888';
      li.innerHTML = `${h.time} — <span style="color:#888;">${h.address}</span> → <em>${h.info}</em>`;
    } else {
      li.style.color = '#000';
      li.style.borderLeftColor = '#4CAF50';
      li.style.borderLeftWidth = '3px';
      li.style.borderLeftStyle = 'solid';
      li.innerHTML = `${h.time} — <strong>${h.address}</strong> → ${h.info}`;
    }
    
    ul.appendChild(li);
  });
  
  // Автоскролл вниз
  const historyBox = document.getElementById('history-box');
  historyBox.scrollTop = historyBox.scrollHeight;
}

// ================= ВЫХОД =================
function logout() {
  stopSync();
  
  teamCode = '';
  tripCounter = 0;
  
  document.getElementById('game').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('teamCode').value = '';
  document.getElementById('adminPass').value = '';
  document.getElementById('addressInput').value = '';
  
  showNotification('Вы вышли из системы', 'info');
}

// ================= АВТООБНОВЛЕНИЕ =================
let lastServerCheck = 0;

setInterval(() => {
  if (Date.now() - lastServerCheck > 2000) {
    lastServerCheck = Date.now();
    fetchGameStatus();
  }
  
  updateTimer();
}, 1000);

// ================= ИНИЦИАЛИЗАЦИЯ =================
window.addEventListener('load', () => {
  console.log('🚀 Детективная игра загружена');
  fetchGameStatus();
  
  // Добавляем стили
  if (!document.querySelector('#game-styles')) {
    const style = document.createElement('style');
    style.id = 'game-styles';
    style.textContent = `
      .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 5px;
        color: white;
        font-weight: bold;
        z-index: 1000;
        animation: slideIn 0.3s ease;
        box-shadow: 0 3px 10px rgba(0,0,0,0.2);
      }
      .notification.success { background: #4CAF50; }
      .notification.error { background: #f44336; }
      .notification.info { background: #2196F3; }
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      .jump {
        animation: jump 0.5s ease;
        display: inline-block;
      }
      @keyframes jump {
        0% { transform: scale(1); }
        30% { transform: scale(1.5); color: #4CAF50; }
        60% { transform: scale(1.2); }
        100% { transform: scale(1); }
      }
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      #tripsHistory li {
        padding: 8px;
        margin: 4px 0;
        background: #f9f9f9;
        border-radius: 4px;
        transition: all 0.3s;
      }
      #tripsHistory li:hover {
        background: #f0f0f0;
        transform: translateX(5px);
      }
    `;
    document.head.appendChild(style);
  }
});

// Очистка при закрытии
window.addEventListener('beforeunload', () => {
  stopSync();
});
