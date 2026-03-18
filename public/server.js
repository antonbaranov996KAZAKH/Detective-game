const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ================= CONFIG =================
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || 
  crypto.createHash('sha256').update('admin123').digest('hex');
const MAX_TRIPS_PER_TEAM = 100;
const STATE_FILE = path.join(__dirname, 'game-state.json');

// ================= GAME STATE =================
let gameState = {
  isRunning: false,
  endTime: null
};

let teams = {}; // { teamCode: { tripsHistory: [] } }

// ================= LOAD ADDRESSES =================
let addressMap = new Map();
try {
  const addresses = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'address.json')));
  addressMap = new Map(
    addresses.map(a => [a.address.toLowerCase().trim(), a])
  );
  console.log(`✅ Загружено ${addressMap.size} адресов`);
} catch (e) {
  console.error('❌ Не удалось загрузить address.json:', e);
}

// ================= LOAD STATE =================
function loadState() {
  try {
    const data = fs.readFileSync(STATE_FILE, 'utf-8');
    const state = JSON.parse(data);
    gameState = state.gameState;
    teams = state.teams;
    console.log('✅ Состояние игры загружено');
  } catch (e) {
    console.log('📝 Новое состояние игры');
  }
}

function saveState() {
  const state = {
    gameState,
    teams,
    savedAt: new Date().toISOString()
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// Загружаем состояние при старте
loadState();

// ================= HELPER FUNCTIONS =================
function validateTeamCode(code) {
  if (!code || typeof code !== 'string') return false;
  if (code.length < 2 || code.length > 50) return false;
  return true;
}

function sanitizeInput(input) {
  return input.replace(/[<>&'"]/g, '');
}

function logAction(action, details = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    action,
    ...details
  };
  console.log(JSON.stringify(logEntry));
  
  // Опционально: запись в лог-файл
  // fs.appendFileSync('game.log', JSON.stringify(logEntry) + '\n');
}

// ================= ROUTES =================

// Логин команды
app.post('/api/login', (req, res) => {
  const { teamCode } = req.body;
  
  if (!validateTeamCode(teamCode)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Некорректный код команды' 
    });
  }

  const sanitizedCode = sanitizeInput(teamCode);

  if (!teams[sanitizedCode]) {
    teams[sanitizedCode] = { tripsHistory: [] };
    logAction('TEAM_REGISTERED', { teamCode: sanitizedCode });
  }

  res.json({ 
    success: true, 
    tripsHistory: teams[sanitizedCode].tripsHistory 
  });
});

// Сделать поездку
app.post('/api/trip', (req, res) => {
  if (!gameState.isRunning) {
    return res.status(403).json({ 
      success: false, 
      info: 'Игра не запущена' 
    });
  }

  const { teamCode, address } = req.body;
  
  if (!validateTeamCode(teamCode) || !teams[teamCode]) {
    return res.status(400).json({ 
      success: false, 
      info: 'Команда не найдена' 
    });
  }

  if (!address || typeof address !== 'string') {
    return res.status(400).json({ 
      success: false, 
      info: 'Некорректный адрес' 
    });
  }

  const normalizedAddress = address.toLowerCase().trim();
  const addrData = addressMap.get(normalizedAddress);

  if (!addrData) {
    return res.json({ 
      success: false, 
      info: 'Адрес не найден' 
    });
  }

  const trip = {
    time: new Date().toLocaleTimeString(),
    address: addrData.address,
    info: addrData.info
  };

  teams[teamCode].tripsHistory.push(trip);
  
  // Ограничиваем историю
  if (teams[teamCode].tripsHistory.length > MAX_TRIPS_PER_TEAM) {
    teams[teamCode].tripsHistory = teams[teamCode].tripsHistory.slice(-MAX_TRIPS_PER_TEAM);
  }

  logAction('TRIP_MADE', { teamCode, address: addrData.address });
  saveState();

  res.json({ 
    success: true, 
    info: 'Поездка засчитана!', 
    tripsHistory: teams[teamCode].tripsHistory 
  });
});

// Статус игры
app.get('/api/status', (req, res) => {
  let remaining = null;
  if (gameState.isRunning && gameState.endTime) {
    remaining = Math.max(0, gameState.endTime - Date.now());
    
    // Автоматическая остановка
    if (remaining <= 0) {
      gameState.isRunning = false;
      gameState.endTime = null;
      saveState();
    }
  }
  res.json({ ...gameState, remaining });
});

// ================= ADMIN ROUTES =================

// Middleware для проверки админа
function adminAuth(req, res, next) {
  const { password } = req.body;
  
  if (!password) {
    return res.status(401).json({ message: 'Требуется пароль' });
  }

  const hash = crypto.createHash('sha256').update(password).digest('hex');
  
  if (hash !== ADMIN_PASSWORD_HASH) {
    logAction('ADMIN_AUTH_FAILED', { ip: req.ip });
    return res.status(401).json({ message: 'Неверный пароль' });
  }
  
  next();
}

// Старт игры
app.post('/api/admin/start', adminAuth, (req, res) => {
  const { minutes } = req.body;
  
  if (!minutes || isNaN(minutes) || minutes < 1 || minutes > 180) {
    return res.status(400).json({ 
      message: 'Введите корректное время (1-180 минут)' 
    });
  }

  gameState.isRunning = true;
  gameState.endTime = Date.now() + minutes * 60000;
  
  logAction('GAME_STARTED', { minutes, by: req.ip });
  saveState();

  res.json({ message: `✅ Игра запущена на ${minutes} мин.` });
});

// Остановка игры
app.post('/api/admin/stop', adminAuth, (req, res) => {
  gameState.isRunning = false;
  gameState.endTime = null;
  
  logAction('GAME_STOPPED', { by: req.ip });
  saveState();

  res.json({ message: '⏹️ Игра остановлена' });
});

// Сброс всех данных
app.post('/api/admin/reset', adminAuth, (req, res) => {
  teams = {};
  gameState.isRunning = false;
  gameState.endTime = null;
  
  logAction('GAME_RESET', { by: req.ip });
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
  
  // Сортируем по времени (новые сверху)
  allTrips.sort((a, b) => {
    const timeA = new Date(`1970/01/01 ${a.time}`).getTime();
    const timeB = new Date(`1970/01/01 ${b.time}`).getTime();
    return timeB - timeA;
  });

  res.json({ allTrips });
});

// ================= STATS =================
app.get('/api/admin/stats', (req, res) => {
  const stats = {
    totalTeams: Object.keys(teams).length,
    totalTrips: Object.values(teams).reduce((sum, team) => 
      sum + team.tripsHistory.length, 0
    ),
    gameActive: gameState.isRunning,
    timeRemaining: gameState.endTime ? Math.max(0, gameState.endTime - Date.now()) : null
  };
  
  res.json(stats);
});

// ================= CATCH ALL =================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ================= START SERVER =================
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Admin panel: http://localhost:${PORT}/admin.html`);
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
