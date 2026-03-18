const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ================= GAME STATE =================
let gameState = {
  isRunning: false,
  endTime: null,
  startTime: null
};

let teams = {}; // { teamCode: { tripsHistory: [] } }

// ================= ЗАГРУЗКА АДРЕСОВ =================
let addresses = [];
try {
  const data = fs.readFileSync(path.join(__dirname, 'data', 'addres.json'), 'utf-8');
  addresses = JSON.parse(data);
  console.log(`✅ Загружено ${addresses.length} адресов`);
} catch (e) {
  console.error('❌ Не удалось загрузить addres.json:', e.message);
  addresses = [];
}

// ================= ADMIN PASSWORD =================
const ADMIN_PASSWORD = 'admin123';

// ================= СОХРАНЕНИЕ СОСТОЯНИЯ =================
const STATE_FILE = path.join(__dirname, 'game-state.json');

function saveState() {
  try {
    const state = {
      gameState,
      teams,
      savedAt: Date.now()
    };
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    console.log('💾 Состояние сохранено');
  } catch (e) {
    console.error('Ошибка сохранения состояния:', e);
  }
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf-8');
      const state = JSON.parse(data);
      
      if (state.gameState.isRunning && state.gameState.endTime) {
        const remaining = state.gameState.endTime - Date.now();
        if (remaining <= 0) {
          state.gameState.isRunning = false;
          state.gameState.endTime = null;
          console.log('⏰ Игра автоматически остановлена при загрузке');
        }
      }
      
      gameState = state.gameState;
      teams = state.teams;
      console.log('✅ Состояние загружено');
    }
  } catch (e) {
    console.log('📝 Новое состояние игры');
  }
}

loadState();

// ================= ROUTES =================

// Логин команды
app.post('/api/login', (req, res) => {
  const { teamCode } = req.body;
  if (!teamCode) return res.json({ success: false });

  if (!teams[teamCode]) {
    teams[teamCode] = { tripsHistory: [] };
  }

  res.json({ success: true, tripsHistory: teams[teamCode].tripsHistory });
});

// Сделать поездку
app.post('/api/trip', (req, res) => {
  if (!gameState.isRunning) {
    return res.json({ 
      success: false, 
      info: 'Игра ещё не началась!' 
    });
  }

  const { teamCode, address } = req.body;
  
  if (!teamCode || !teams[teamCode]) {
    return res.json({ 
      success: false, 
      info: 'Команда не найдена' 
    });
  }

  if (!address || address.trim() === '') {
    return res.json({ 
      success: false, 
      info: 'Введите адрес' 
    });
  }

  const normalizedAddress = address.trim().toLowerCase();
  const foundAddress = addresses.find(a => 
    a.address.toLowerCase() === normalizedAddress
  );

  const tripInfo = foundAddress 
    ? foundAddress.info 
    : 'По этому адресу ничего интересного не обнаружено';

  const trip = {
    time: new Date().toLocaleTimeString(),
    address: address,
    info: tripInfo
  };

  teams[teamCode].tripsHistory.push(trip);
  
  if (teams[teamCode].tripsHistory.length > 50) {
    teams[teamCode].tripsHistory = teams[teamCode].tripsHistory.slice(-50);
  }

  saveState();

  res.json({ 
    success: true,
    info: tripInfo,
    tripsHistory: teams[teamCode].tripsHistory
  });
});

// Статус игры
app.get('/api/status', (req, res) => {
  let remaining = null;
  const serverTime = Date.now();
  
  if (gameState.isRunning && gameState.endTime) {
    remaining = gameState.endTime - serverTime;
    
    if (remaining <= 0) {
      gameState.isRunning = false;
      gameState.endTime = null;
      remaining = 0;
      saveState();
      console.log('⏰ Игра автоматически остановлена по таймеру');
    }
  }
  
  res.json({ 
    ...gameState, 
    remaining: remaining > 0 ? remaining : 0,
    serverTime
  });
});

// ================= ADMIN ROUTES =================

// Старт игры
app.post('/api/admin/start', (req, res) => {
  const { minutes, password } = req.body;
  
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ message: 'Неверный пароль' });
  }
  
  if (!minutes || isNaN(minutes) || minutes < 1) {
    return res.status(400).json({ message: 'Неверное время' });
  }

  const now = Date.now();
  
  gameState.isRunning = true;
  gameState.startTime = now;
  gameState.endTime = now + minutes * 60000;
  
  saveState();
  
  console.log(`🎮 Игра запущена на ${minutes} минут`);
  
  res.json({ message: `✅ Игра запущена на ${minutes} мин.` });
});

// Остановка игры
app.post('/api/admin/stop', (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ message: 'Неверный пароль' });
  }

  gameState.isRunning = false;
  gameState.endTime = null;
  gameState.startTime = null;
  
  saveState();

  res.json({ message: '⏹️ Игра остановлена' });
});

// Сброс всех данных
app.post('/api/admin/reset', (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false });
  }

  teams = {};
  gameState.isRunning = false;
  gameState.endTime = null;
  gameState.startTime = null;
  
  saveState();
  
  res.json({ success: true, message: '🔄 Все данные сброшены' });
});

// Получить все поездки для админа
app.get('/api/admin/history', (req, res) => {
  const allTrips = [];
  Object.keys(teams).forEach(team => {
    teams[team].tripsHistory.forEach(trip => {
      allTrips.push({ team, ...trip });
    });
  });
  
  allTrips.sort((a, b) => {
    if (a.time < b.time) return 1;
    if (a.time > b.time) return -1;
    return 0;
  });
  
  res.json({ allTrips });
});

// ================= CATCH ALL =================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ================= START SERVER =================
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Файл с адресами: ${path.join(__dirname, 'data', 'addres.json')}`);
  console.log(`📊 Загружено адресов: ${addresses.length}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n💾 Сохраняем состояние перед остановкой...');
  saveState();
  server.close(() => {
    console.log('👋 Сервер остановлен');
    process.exit(0);
  });
});

// Сохраняем состояние каждые 30 секунд
setInterval(saveState, 30000);
