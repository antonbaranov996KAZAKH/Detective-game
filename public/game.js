// ================= ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =================
let teamCode = '';
let tripCounter = 0;
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
    
    // Запускаем синхронизацию
    startSync();
  })
  .catch(err => showNotification('Ошибка связи с сервером', 'error'));
}

// ================= СИНХРОНИЗАЦИЯ =================
function startSync() {
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
        const currentLength = document.getElementById('tripsHistory').children.length;
        if (data.tripsHistory.length !== currentLength) {
          console.log('🔄 Обновление данных...');
          updateHistory(data.tripsHistory);
          tripCounter = data.tripsHistory.length;
          document.getElementById('tripsLeft').textContent = tripCounter;
        }
      }
    })
    .catch(err => console.warn('Ошибка синхронизации:', err));
}

// ================= ПОЕЗДКА =================
function goTrip() {
  const address = document.getElementById('addressInput').value.trim();
  if(!address) {
    showNotification('❌ Введите адрес', 'error');
    return;
  }

  const goButton = document.querySelector('#main-info button:first-of-type');
  const originalText = goButton.textContent;
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
    
    // Анимация
    tripsEl.classList.remove('jump');
    void tripsEl.offsetWidth;
    tripsEl.classList.add('jump');
    
    updateHistory(data.tripsHistory);
    document.getElementById('addressInput').value = '';
  })
  .catch(err => showNotification('❌ Ошибка связи с сервером', 'error'))
  .finally(() => {
    goButton.disabled = false;
    goButton.textContent = originalText;
  });
}

// ================= ИСТОРИЯ (обновлена для работы с <br>) =================
function updateHistory(history) {
  const ul = document.getElementById('tripsHistory');
  if (!ul) return;
  
  ul.innerHTML = '';
  
  history.slice(-30).reverse().forEach((h, index) => {
    const li = document.createElement('li');
    li.style.opacity = '0';
    li.style.animation = `fadeIn 0.3s ease ${index * 0.1}s forwards`;
    
    if (h.info.includes('ничего интересного')) {
      li.style.color = '#888';
      li.style.backgroundColor = '#f9f9f9';
      li.innerHTML = `
        <div style="display: flex; justify-content: space-between;">
          <span style="color:#888;">${h.address}</span>
          <span style="color:#999; font-size:0.9em;">${h.time}</span>
        </div>
        <div style="margin-top:5px; font-style:italic;">${h.info}</div>
      `;
    } else {
      li.style.borderLeft = '4px solid #4CAF50';
      li.style.backgroundColor = '#ffffff';
      li.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom:8px;">
          <strong style="color:#2196F3; font-size:1.1em;">${h.address}</strong>
          <span style="color:#666; font-size:0.9em;">${h.time}</span>
        </div>
        <div style="line-height:1.6; color:#333;">${h.info}</div>
      `;
    }
    
    ul.appendChild(li);
  });
  
  // Автоскролл вниз
  const historyBox = document.getElementById('history-box');
  if (historyBox) historyBox.scrollTop = historyBox.scrollHeight;
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

// ================= ИНИЦИАЛИЗАЦИЯ =================
window.addEventListener('load', () => {
  console.log('🚀 Детективная игра загружена');
  
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
      
      #tripsHistory {
        list-style: none;
        padding: 0;
      }
      
      #tripsHistory li {
        padding: 15px;
        margin-bottom: 10px;
        border-radius: 8px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        transition: all 0.3s ease;
      }
      
      #tripsHistory li:hover {
        transform: translateX(5px);
        box-shadow: 0 5px 15px rgba(0,0,0,0.15);
      }
      
      #history-box {
        max-height: 500px;
        overflow-y: auto;
        padding: 10px;
        background: #f0f2f5;
        border-radius: 10px;
      }
    `;
    document.head.appendChild(style);
  }
});

// Очистка при закрытии
window.addEventListener('beforeunload', () => {
  stopSync();
});