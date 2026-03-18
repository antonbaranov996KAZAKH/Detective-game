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

let teams = {}; // { teamCode: { tripsHistory: [] } }

// ================= ЗАГРУЗКА АДРЕСОВ ИЗ ФАЙЛА =================
let addresses = [];
const ADDRESS_FILE = path.join(__dirname, 'data', 'addres.json');

try {
  console.log('📁 Читаем файл:', ADDRESS_FILE);
  
  // Проверяем существует ли файл
  if (!fs.existsSync(ADDRESS_FILE)) {
    console.error('❌ Файл не найден!');
  } else {
    // Читаем файл
    const fileContent = fs.readFileSync(ADDRESS_FILE, 'utf-8');
    console.log('📄 Содержимое файла (первые 200 символов):', fileContent.substring(0, 200));
    
    // Парсим JSON
    addresses = JSON.parse(fileContent);
    
    console.log(`✅ Успешно загружено ${addresses.length} адресов`);
    
    // Показываем первые 3 адреса для проверки
    console.log('📋 Примеры адресов:');
    addresses.slice(0, 3).forEach((item, index) => {
      console.log(`   ${index + 1}. "${item.address}" -> "${item.info}"`);
    });
  }
} catch (e) {
  console.error('❌ Ошибка при загрузке адресов:', e.message);
  addresses = [];
}

// ================= СОЗДАЕМ MAP ДЛЯ БЫСТРОГО ПОИСКА =================
// Это ускорит поиск и сделает его регистронезависимым
const addressMap = new Map();

addresses.forEach(item => {
  // Приводим адрес к нижнему регистру и убираем лишние пробелы
  const normalizedAddress = item.address.toLowerCase().trim();
  addressMap.set(normalizedAddress, item.info);
});

console.log(`🗺️ Создана карта поиска для ${addressMap.size} адресов`);

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

// ================= ТЕСТОВЫЙ МАРШРУТ ДЛЯ ПРОВЕРКИ АДРЕСОВ =================
app.get('/api/test-addresses', (req, res) => {
  res.json({
    total: addresses.length,
    sample: addresses.slice(0, 5),
    mapSize: addressMap.size
  });
});

// ================= ОСНОВНЫЕ МАРШРУТЫ =================

// Логин команды
app.post('/api/login', (req, res) => {
  const { teamCode } = req.body;
  
  if (!teamCode || typeof teamCode !== 'string') {
    return res.json({ success: false, error: 'Некорректный код команды' });
  }

  const sanitizedCode = teamCode.trim();
  
  if (!teams[sanitizedCode]) {
    teams[sanitizedCode] = { tripsHistory: [] };
    console.log(`👥 Новая команда: ${sanitizedCode}`);
  }

  res.json({ 
    success: true, 
    tripsHistory: teams[sanitizedCode].tripsHistory 
  });
});

// 👇 **ГЛАВНЫЙ МАРШРУТ ДЛЯ ПОЕЗДОК - ИСПОЛЬЗУЕТ ВАШ ФАЙЛ**
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
  if (!address || typeof address !== 'string' || address.trim() === '') {
    return res.json({ 
      success: false, 
      info: 'Введите адрес' 
    });
  }

  // 🔍 **НОРМАЛИЗУЕМ АДРЕС ДЛЯ ПОИСКА**
  const normalizedAddress = address.trim().toLowerCase();
  
  // 🔍 **ИЩЕМ В MAP (ЭТО БЫСТРЕЕ, ЧЕМ МАССИВ)**
  const tripInfo = addressMap.get(normalizedAddress);
  
  // Формируем результат
  const resultInfo = tripInfo 
    ? tripInfo  // Если нашли в файле
    : 'По этому адресу ничего интересного не обнаружено'; // Если не нашли

  // Создаем запись о поездке
  const trip = {
    time: new Date().toLocaleTimeString('ru-RU'),
    address: address, // сохраняем оригинальный ввод
    info: resultInfo,
    found: !!tripInfo // добавляем флаг для отладки
  };

  // Добавляем в историю команды
  teams[teamCode].tripsHistory.push(trip);
  
  // Ограничиваем историю
  const MAX_TRIPS = 50;
  if (teams[teamCode].tripsHistory.length > MAX_TRIPS) {
    teams[teamCode].tripsHistory = teams[teamCode].tripsHistory.slice(-MAX_TRIPS);
  }

  // Сохраняем состояние
  saveState();

  // Логируем для отладки
  console.log(`🚗 Команда ${teamCode}: "${address}" -> ${tripInfo ? 'НАЙДЕНО' : 'НЕ НАЙДЕНО'}`);

  // Отправляем ответ
  res.json({ 
    success: true,
    info: resultInfo,
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
      console.log('⏰ Игра автоматически остановлена');
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
  
  if (!minutes || isNaN(minutes) || minutes < 1 || minutes > 180) {
    return res.status(400).json({ message: 'Введите корректное время (1-180 минут)' });
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
  console.log('⏹️ Игра остановлена');

  res.json({ message: '⏹️ Игра остановлена' });
});

// Сброс всех данных
app.post('/api/admin/reset', (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: 'Неверный пароль' });
  }

  teams = {};
  gameState.isRunning = false;
  gameState.endTime = null;
  gameState.startTime = null;
  
  saveState();
  console.log('🔄 Все данные сброшены');
  
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
    if (a.time < b.time) return 1;
    if (a.time > b.time) return -1;
    return 0;
  });

  res.json({ allTrips });
});

// ================= ДОПОЛНИТЕЛЬНЫЙ МАРШРУТ ДЛЯ ПРОВЕРКИ =================
app.get('/api/debug/address/:address', (req, res) => {
  const searchAddress = req.params.address.toLowerCase().trim();
  const found = addressMap.get(searchAddress);
  
  res.json({
    requested: req.params.address,
    normalized: searchAddress,
    found: !!found,
    info: found || null,
    allAddresses: Array.from(addressMap.keys())
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
  console.log(`Файл с адресами: ${ADDRESS_FILE}`);
  console.log(`Загружено адресов: ${addresses.length}`);
  console.log(`Адресов в Map: ${addressMap.size}`);
  console.log(`Статус игры: ${gameState.isRunning ? '▶️ Идет' : '⏸️ Остановлена'}`);
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
