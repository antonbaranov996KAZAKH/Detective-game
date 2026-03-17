const express = require('express');
const path = require('path');
const app = express();

// -----------------------------
// 📦 Настройка
app.use(express.json()); // чтобы получать JSON из POST
app.use(express.static(path.join(__dirname, 'public'))); // чтобы отдавать index.html и JS

// -----------------------------
// 🟢 Состояние игры
let gameState = {
  isRunning: false, // игра включена или нет
  endTime: null     // время конца игры (timestamp)
};
// -----------------------------

// -----------------------------
// 🚀 Маршруты админа

// POST /api/admin/start
app.post('/api/admin/start', (req, res) => {
  const { minutes } = req.body;
  if (!minutes || isNaN(minutes)) {
    return res.status(400).json({ message: 'Укажи правильное количество минут' });
  }

  gameState.isRunning = true;
  gameState.endTime = Date.now() + minutes * 60000;

  res.json({ message: 'Таймер запущен', endTime: gameState.endTime });
});

// POST /api/admin/stop
app.post('/api/admin/stop', (req, res) => {
  gameState.isRunning = false;
  gameState.endTime = null;

  res.json({ message: 'Таймер остановлен' });
});
// -----------------------------

// -----------------------------
// 🌐 Статус игры (GET /api/status)
app.get('/api/status', (req, res) => {
  let remaining = null;
  if (gameState.isRunning && gameState.endTime) {
    remaining = Math.max(0, gameState.endTime - Date.now()); // миллисекунды
  }
  res.json({ ...gameState, remaining });
});
// -----------------------------

// -----------------------------
// 🚫 Поездка игрока (POST /api/trip)
app.post('/api/trip', (req, res) => {
  if (!gameState.isRunning) {
    return res.json({ success: false, info: 'Игра не запущена' });
  }

  // Здесь вставляешь логику поездки
  res.json({ success: true, info: 'Поездка подтверждена!' });
});
// -----------------------------

// -----------------------------
// 🔥 Старт сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
