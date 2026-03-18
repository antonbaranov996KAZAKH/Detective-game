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
  endTime: null
};

let teams = {}; // { teamCode: { tripsHistory: [] } }

// Загружаем доступные адреса
let addresses = [];
try {
  addresses = JSON.parse(fs.readFileSync(path.join(__dirname,'data','address.json')));
} catch (e) {
  console.error('Не удалось загрузить address.json:', e);
}

// ================= ADMIN PASSWORD =================
const ADMIN_PASSWORD = 'admin123';

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
  if (!gameState.isRunning) return res.json({ success: false, info: 'Игра не запущена' });

  const { teamCode, address } = req.body;
  if (!teamCode || !teams[teamCode]) return res.json({ success: false, info: 'Команда не найдена' });
  if (!address) return res.json({ success: false, info: 'Нет адреса' });

  // Проверяем адрес в address.json
  const addrData = addresses.find(a => a.address.toLowerCase() === address.toLowerCase());
  if (!addrData) return res.json({ success: false, info: 'Адрес не найден' });

  const trip = {
    time: new Date().toLocaleTimeString(),
    address: addrData.address,
    info: addrData.info
  };

  teams[teamCode].tripsHistory.push(trip);

  res.json({ success: true, info: 'Поездка засчитана!', tripsHistory: teams[teamCode].tripsHistory });
});

// Статус игры
app.get('/api/status', (req, res) => {
  let remaining = null;
  if (gameState.isRunning && gameState.endTime) {
    remaining = Math.max(0, gameState.endTime - Date.now());
  }
  res.json({ ...gameState, remaining });
});

// ================= ADMIN =================

// Старт игры
app.post('/api/admin/start', (req, res) => {
  const { minutes, password } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ message: 'Неверный пароль' });
  if (!minutes || isNaN(minutes)) return res.status(400).json({ message: 'Неверное время' });

  gameState.isRunning = true;
  gameState.endTime = Date.now() + minutes * 60000;

  res.json({ message: `Игра запущена на ${minutes} мин.` });
});

// Остановка игры
app.post('/api/admin/stop', (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ message: 'Неверный пароль' });

  gameState.isRunning = false;
  gameState.endTime = null;

  res.json({ message: 'Игра остановлена' });
});

// Сброс всех данных
app.post('/api/admin/reset', (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ success: false });

  teams = {};
  res.json({ success: true });
});

// Получить все поездки для админа
app.get('/api/admin/history', (req, res) => {
  const allTrips = [];
  Object.keys(teams).forEach(team => {
    teams[team].tripsHistory.forEach(trip => {
      allTrips.push({ team, ...trip });
    });
  });
  res.json({ allTrips });
});

// ================= CATCH ALL =================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ================= START SERVER =================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
