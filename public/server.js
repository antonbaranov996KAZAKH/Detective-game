// server.js
const express = require('express');
const path = require('path');

const app = express();

// ================= Настройка =================
app.use(express.json());

// -----------------------------
// 🟢 Состояние игры
let gameState = {
  isRunning: false,
  endTime: null
};

// 👥 Команды и история
let teams = {}; 
// Пример структуры:
// teams = {
//   "123": { tripsHistory: [] }
// }

// -----------------------------
// 🔐 API: Логин команды
app.post('/api/login', (req, res) => {
  try {
    const { teamCode } = req.body;
    if (!teamCode) return res.json({ success: false });

    // создаём команду, если нет
    if (!teams[teamCode]) {
      teams[teamCode] = { tripsHistory: [] };
    }

    res.json({
      success: true,
      tripsHistory: teams[teamCode].tripsHistory
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false });
  }
});

// -----------------------------
// 🚗 API: Поездка команды
app.post('/api/trip', (req, res) => {
  try {
    if (!gameState.isRunning) return res.json({ success: false, info: 'Игра не запущена' });

    const { teamCode, address } = req.body;
    if (!teamCode || !teams[teamCode]) return res.json({ success: false, info: 'Команда не найдена' });
    if (!address) return res.json({ success: false, info: 'Нет адреса' });

    const trip = {
      time: new Date().toLocaleTimeString(),
      address,
      info: 'OK'
    };

    teams[teamCode].tripsHistory.push(trip);

    res.json({
      success: true,
      info: 'Поездка засчитана!',
      tripsHistory: teams[teamCode].tripsHistory
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, info: 'Ошибка сервера' });
  }
});

// -----------------------------
// 🌐 API: Статус игры
app.get('/api/status', (req, res) => {
  try {
    let remaining = null;
    if (gameState.isRunning && gameState.endTime) {
      remaining = Math.max(0, gameState.endTime - Date.now());
    }
    res.json({ ...gameState, remaining });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// -----------------------------
// 🚀 API: Админ
const ADMIN_PASSWORD = 'admin123';

app.post('/api/admin/start', (req, res) => {
  try {
    const { minutes, password } = req.body;
    if (password !== ADMIN_PASSWORD) return res.status(403).json({ message: 'Нет доступа' });
    if (!minutes || isNaN(minutes)) return res.status(400).json({ message: 'Укажи нормальное время' });

    gameState.isRunning = true;
    gameState.endTime = Date.now() + minutes * 60000;

    console.log('Игра запущена');
    res.json({ message: `Таймер запущен на ${minutes} мин`, endTime: gameState.endTime });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

app.post('/api/admin/stop', (req, res) => {
  try {
    const { password } = req.body;
    if (password !== ADMIN_PASSWORD) return res.status(403).json({ message: 'Нет доступа' });

    gameState.isRunning = false;
    gameState.endTime = null;

    console.log('Игра остановлена');
    res.json({ message: 'Таймер остановлен' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Админ: история всех поездок
app.get('/api/admin/history', (req, res) => {
  try {
    const allTrips = [];
    for (let team in teams) {
      teams[team].tripsHistory.forEach(trip => {
        allTrips.push({
          team,
          time: trip.time,
          address: trip.address,
          info: trip.info
        });
      });
    }
    res.json({ allTrips });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Админ: сброс всех данных
app.post('/api/admin/reset', (req, res) => {
  try {
    const { password } = req.body;
    if (password !== ADMIN_PASSWORD) return res.status(403).json({ success: false });

    teams = {};
    gameState.isRunning = false;
    gameState.endTime = null;

    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false });
  }
});

// -----------------------------
// 🔥 Статика и фронт (в самом конце)
app.use(express.static(path.join(__dirname, 'public')));

// Любой другой путь отдаём index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// -----------------------------
// 🚀 Запуск
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
