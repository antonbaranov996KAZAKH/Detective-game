const express = require('express');
const path = require('path');

const app = express();

// -----------------------------
// 📦 Настройка
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// -----------------------------
// 🟢 Состояние игры
let gameState = {
  isRunning: false,
  endTime: null
};

// 👥 Команды и история
let teams = {}; 
// пример:
// teams = {
//   "123": { tripsHistory: [] }
// }

// -----------------------------
// 🚀 Админ

app.post('/api/admin/start', (req, res) => {
  try {
    const { minutes } = req.body;

    if (!minutes || isNaN(minutes)) {
      return res.status(400).json({ message: 'Укажи нормальное время' });
    }

    gameState.isRunning = true;
    gameState.endTime = Date.now() + minutes * 60000;

    console.log('Игра запущена');

    res.json({ message: 'Таймер запущен', endTime: gameState.endTime });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

app.post('/api/admin/stop', (req, res) => {
  try {
    gameState.isRunning = false;
    gameState.endTime = null;

    console.log('Игра остановлена');

    res.json({ message: 'Таймер остановлен' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// -----------------------------
// 🌐 Статус

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
// 🔐 ЛОГИН

app.post('/api/login', (req, res) => {
  try {
    const { teamCode } = req.body;

    if (!teamCode) {
      return res.json({ success: false });
    }

    // создаём команду если нет
    if (!teams[teamCode]) {
      teams[teamCode] = {
        tripsHistory: []
      };
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
// 🚗 ПОЕЗДКА

app.post('/api/trip', (req, res) => {
  try {
    if (!gameState.isRunning) {
      return res.json({
        success: false,
        info: 'Игра не запущена'
      });
    }

    const { teamCode, address } = req.body;

    if (!teamCode || !teams[teamCode]) {
      return res.json({
        success: false,
        info: 'Команда не найдена'
      });
    }

    if (!address) {
      return res.json({
        success: false,
        info: 'Нет адреса'
      });
    }

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
    res.status(500).json({
      success: false,
      info: 'Ошибка сервера'
    });
  }
});

// -----------------------------
// 🔥 Запуск

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});