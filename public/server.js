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

// ================= ЗАГРУЗКА АДРЕСОВ =================
let addresses = [];
try {
  // Исправлен путь: data/addres.json (обратите внимание на имя файла)
  const data = fs.readFileSync(path.join(__dirname, 'data', 'addres.json'), 'utf-8');
  addresses = JSON.parse(data);
  console.log(`✅ Загружено ${addresses.length} адресов`);
  console.log('📋 Пример адреса:', addresses[0]);
} catch (e) {
  console.error('❌ Не удалось загрузить addres.json:', e.message);
  addresses = []; // Пустой массив, если файл не найден
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

// 👇 **ИСПРАВЛЕННАЯ ФУНКЦИЯ ПОЕЗДКИ**
app.post('/api/trip', (req, res) => {
  // Проверка: запущена ли игра
  if (!gameState.isRunning) {
    return res.json({ 
      success: false, 
      info: 'Игра ещё не началась!' 
    });
  }

  const { teamCode, address } = req.body;
  
  // Проверка команды
  if (!teamCode || !teams[teamCode]) {
    return res.json({ 
      success: false, 
      info: 'Команда не найдена' 
    });
  }

  // Проверка адреса
  if (!address || address.trim() === '') {
    return res.json({ 
      success: false, 
      info: 'Введите адрес' 
    });
  }

  // Нормализуем адрес (убираем лишние пробелы, приводим к нижнему регистру)
  const normalizedAddress = address.trim().toLowerCase();
  
  // 🔍 ИЩЕМ АДРЕС В НАШЕМ ФАЙЛЕ
  const foundAddress = addresses.find(a => 
    a.address.toLowerCase() === normalizedAddress
  );

  let tripInfo;
  let success = false;

  if (foundAddress) {
    // Адрес НАЙДЕН - показываем информацию
    tripInfo = foundAddress.info;
    success = true;
  } else {
    // Адрес НЕ НАЙДЕН - стандартное сообщение
    tripInfo = 'По этому адресу ничего интересного не обнаружено';
    success = true; // Всё равно успех, просто информации нет
  }

  // Создаем запись о поездке
  const trip = {
    time: new Date().toLocaleTimeString(),
    address: address, // сохраняем оригинальный ввод
    info: tripInfo
  };

  // Добавляем в историю команды
  teams[teamCode].tripsHistory.push(trip);
  
  // Ограничиваем историю (последние 50 поездок)
  if (teams[teamCode].tripsHistory.length > 50) {
    teams[teamCode].tripsHistory = teams[teamCode].tripsHistory.slice(-50);
  }

  // Отправляем ответ
  res.json({ 
    success: success,
    info: tripInfo,
    tripsHistory: teams[teamCode].tripsHistory
  });
});

// Статус игры
app.get('/api/status', (req, res) => {
  let remaining = null;
  if (gameState.isRunning && gameState.endTime) {
    remaining = Math.max(0, gameState.endTime - Date.now());
  }
  res.json({ ...gameState, remaining });
});

// ================= ADMIN ROUTES =================

// Старт игры
app.post('/api/admin/start', (req, res) => {
  const { minutes, password } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ message: 'Неверный пароль' });
  }
  if (!minutes || isNaN(minutes)) {
    return res.status(400).json({ message: 'Неверное время' });
  }

  gameState.isRunning = true;
  gameState.endTime = Date.now() + minutes * 60000;

  res.json({ message: `Игра запущена на ${minutes} мин.` });
});

// Остановка игры
app.post('/api/admin/stop', (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ message: 'Неверный пароль' });
  }

  gameState.isRunning = false;
  gameState.endTime = null;

  res.json({ message: 'Игра остановлена' });
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
  
  res.json({ success: true, message: 'Все данные сброшены' });
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
    if (a.time < b.time) return 1;
    if (a.time > b.time) return -1;
    return 0;
  });
  
  res.json({ allTrips });
});

// ================= ДОБАВОЧНЫЙ МАРШРУТ ДЛЯ ПРОВЕРКИ АДРЕСОВ =================
app.get('/api/check-address/:address', (req, res) => {
  const searchAddress = req.params.address.toLowerCase().trim();
  const found = addresses.find(a => a.address.toLowerCase() === searchAddress);
  
  res.json({
    found: !!found,
    info: found ? found.info : null
  });
});

// ================= CATCH ALL =================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ================= START SERVER =================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Файл с адресами: ${path.join(__dirname, 'data', 'addres.json')}`);
  console.log(`📊 Загружено адресов: ${addresses.length}`);
});
