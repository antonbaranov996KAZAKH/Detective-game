const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ---------------- Игровое состояние ----------------
let gameState = { isRunning: false, endTime: null };
let teams = {}; // команды и история поездок

// ---------------- Загрузка адресов ----------------
let addresses = [];
try {
  const data = fs.readFileSync(path.join(__dirname, 'data', 'address.json'), 'utf-8');
  addresses = JSON.parse(data);
} catch (e) {
  console.error('Не удалось загрузить адреса:', e);
}

// ---------------- LOGIN ----------------
app.post('/api/login', (req, res) => {
  const { teamCode } = req.body;
  if (!teamCode) return res.json({ success: false });

  if (!teams[teamCode]) teams[teamCode] = { tripsHistory: [] };

  res.json({ success: true, tripsHistory: teams[teamCode].tripsHistory });
});

// ---------------- STATUS ----------------
app.get('/api/status', (req, res) => {
  let remaining = null;
  if (gameState.isRunning && gameState.endTime) {
    remaining = Math.max(0, gameState.endTime - Date.now());
  }
  res.json({ ...gameState, remaining });
});

// ---------------- TRIP ----------------
app.post('/api/trip', (req, res) => {
  if (!gameState.isRunning) return res.json({ success: false, info: 'Игра не запущена' });

  const { teamCode, address } = req.body;
  if (!teamCode || !teams[teamCode]) return res.json({ success: false, info: 'Команда не найдена' });
  if (!address) return res.json({ success: false, info: 'Введите адрес' });

  // Проверяем адрес в data/address.json
  const found = addresses.find(a => a.address.toLowerCase() === address.toLowerCase());
  const tripInfo = found ? found.info : 'Адрес не найден';

  const trip = { time: new Date().toLocaleTimeString(), address, info: tripInfo };
  teams[teamCode].tripsHistory.push(trip);

  res.json({ success: true, info: tripInfo, tripsHistory: teams[teamCode].tripsHistory });
});

// ---------------- ADMIN ----------------
const ADMIN_PASSWORD = 'admin123';

app.get('/api/admin/history', (req, res) => {
  const allTrips = [];
  for (let team in teams) {
    teams[team].tripsHistory.forEach(trip => allTrips.push({ team, ...trip }));
  }
  res.json({ allTrips });
});

app.post('/api/admin/start', (req, res) => {
  const { minutes, password } = req.body;
  if (password !== ADMIN_PASSWORD) return res.json({ success: false, message: 'Неверный пароль' });

  gameState.isRunning = true;
  gameState.endTime = Date.now() + minutes * 60000;
  res.json({ success: true, message: `Игра запущена на ${minutes} мин` });
});

app.post('/api/admin/stop', (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) return res.json({ success: false, message: 'Неверный пароль' });

  gameState.isRunning = false;
  gameState.endTime = null;
  res.json({ success: true, message: 'Игра остановлена' });
});

app.post('/api/admin/reset', (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) return res.json({ success: false });

  teams = {};
  gameState.isRunning = false;
  gameState.endTime = null;
  res.json({ success: true });
});

// ---------------- Отдать index ----------------
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => console.log(`Server running on port ${port}`));
