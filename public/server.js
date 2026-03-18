const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ================= ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =================
let gameState = {
  isRunning: false,
  endTime: null,
  startTime: null
};

// 👇 ХРАНИЛИЩЕ КОМАНД - ОДНО ДЛЯ ВСЕХ УСТРОЙСТВ
let teams = {}; // { teamCode: { tripsHistory: [], lastActive: timestamp } }

// ================= ЗАГРУЗКА АДРЕСОВ =================
let addresses = [];
const ADDRESS_FILE = path.join(__dirname, 'data', 'addres.json');
let addressMap = new Map();

try {
  if (fs.existsSync(ADDRESS_FILE)) {
    const fileContent = fs.readFileSync(ADDRESS_FILE, 'utf-8');
    addresses = JSON.parse(fileContent);
    
    // Создаем карту для быстрого поиска
    addresses.forEach(item => {
      const normalizedAddress = item.address.toLowerCase().trim();
      addressMap.set(normalizedAddress, item.info);
    });
    
    console.log(`✅ Загружено ${addresses.length} адресов`);
  }
} catch (e) {
  console.error('❌ Ошибка загрузки адресов:', e.message);
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
        }
      }
      
      gameState = state.gameState;
      teams = state.teams || {};
      console.log('✅ Состояние загружено');
    }
  } catch (e) {
    console.log('📝 Новое состояние игры');
  }
}

loadState();

// ================= ОСНОВНЫЕ МАРШРУТЫ =================

// 👇 УЛУЧШЕННЫЙ ЛОГИН - обновляем время последней активности
app.post('/api/login', (req, res) => {
  const { teamCode } = req.body;
  
  if (!teamCode || typeof teamCode !== 'string') {
    return res.json({ success: false, error: 'Некорректный код команды' });
  }

  const sanitizedCode = teamCode.trim();
  
  // Если команда новая - создаем
  if (!teams[sanitizedCode]) {
    teams[sanitizedCode] = { 
      tripsHistory: [],
      createdAt: Date.now(),
      lastActive: Date.now()
    };
    console.log(`👥 Новая команда: ${sanitizedCode}`);
  } else {
    // Обновляем время последней активности
    teams[sanitizedCode].lastActive = Date.now();
    console.log(`👥 Команда ${sanitizedCode} зашла (всего устройств: считаем по сессиям)`);
  }

  // Отправляем историю команды
  res.json({ 
    success: true, 
    tripsHistory: teams[sanitizedCode].tripsHistory,
    teamInfo: {
      createdAt: teams[sanitizedCode].createdAt,
      tripsCount: teams[sanitizedCode].tripsHistory.length
    }
  });
});

// 👇 ПОЕЗДКА - синхронизируется для всей команды
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

  if (!address || typeof address !== 'string' || address.trim() === '') {
    return res.json({ 
      success: false, 
      info: 'Введите адрес' 
    });
  }

  const normalizedAddress = address.trim().toLowerCase();
  const tripInfo = addressMap.get(normalizedAddress);
  
  const resultInfo = tripInfo 
    ? tripInfo
    : 'По этому адресу ничего интересного не обнаружено';

  const trip = {
    id: Date.now() + Math.random().toString(36).substr(2, 5), // уникальный ID
    time: new Date().toLocaleTimeString('ru-RU'),
    timestamp: Date.now(), // для сортировки
    address: address,
    info: resultInfo
  };

  // Добавляем в историю команды
  teams[teamCode].tripsHistory.push(trip);
  teams[teamCode].lastActive = Date.now();
  
  // Ограничиваем историю
  const MAX_TRIPS = 100;
  if (teams[teamCode].tripsHistory.length > MAX_TRIPS) {
    teams[teamCode].tripsHistory = teams[teamCode].tripsHistory.slice(-MAX_TRIPS);
  }

  saveState();

  console.log(`🚗 Команда ${teamCode}: "${address}" -> ${tripInfo ? 'НАЙДЕНО' : 'НЕ НАЙДЕНО'}`);

  // 👇 ВАЖНО: отправляем ВСЮ историю команды, чтобы у всех устройств было одинаково
  res.json({ 
    success: true,
    info: resultInfo,
    tripsHistory: teams[teamCode].tripsHistory,
    timestamp: Date.now()
  });
});

// 👇 НОВЫЙ МАРШРУТ - для принудительной синхронизации
app.get('/api/team/:teamCode/sync', (req, res) => {
  const { teamCode } = req.params;
  
  if (!teamCode || !teams[teamCode]) {
    return res.json({ success: false, error: 'Команда не найдена' });
  }
  
  // Обновляем время активности
  teams[teamCode].lastActive = Date.now();
  
  res.json({
    success: true,
    tripsHistory: teams[teamCode].tripsHistory,
    serverTime: Date.now()
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
    }
  }
  
  res.json({ 
    ...gameState, 
    remaining: remaining > 0 ? remaining : 0,
    serverTime
  });
});

// ================= АДМИНСКИЕ МАРШРУТЫ =================

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

// 👇 УЛУЧШЕННАЯ ИСТОРИЯ ДЛЯ АДМИНА
app.get('/api/admin/history', (req, res) => {
  const allTrips = [];
  const teamsInfo = [];
  
  Object.keys(teams).forEach(team => {
    teamsInfo.push({
      team,
      tripsCount: teams[team].tripsHistory.length,
      lastActive: teams[team].lastActive,
      createdAt: teams[team].createdAt
    });
    
    teams[team].tripsHistory.forEach(trip => {
      allTrips.push({ team, ...trip });
    });
  });
  
  // Сортируем по времени
  allTrips.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  res.json({ 
    allTrips,
    teamsInfo,
    totalTeams: Object.keys(teams).length
  });
});

// ================= CATCH ALL =================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ================= ЗАПУСК СЕРВЕРА =================
const server = app.listen(PORT, () => {
  console.log('\n=== 🚀 СЕРВЕР ЗАПУЩЕН ===');
  console.log(`Порт: ${PORT}`);
  console.log(`Загружено адресов: ${addresses.length}`);
  console.log(`Активных команд: ${Object.keys(teams).length}`);
  console.log('========================\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n💾 Сохраняем состояние...');
  saveState();
  server.close(() => {
    console.log('👋 Сервер остановлен');
    process.exit(0);
  });
});

// Периодическая очистка неактивных команд (опционально)
setInterval(() => {
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  
  Object.keys(teams).forEach(team => {
    if (now - teams[team].lastActive > ONE_DAY) {
      console.log(`🧹 Очистка неактивной команды: ${team}`);
      delete teams[team];
    }
  });
}, 60 * 60 * 1000); // Раз в час
