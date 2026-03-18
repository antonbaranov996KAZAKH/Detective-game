const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ================= ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =================
let teams = {}; // { teamCode: { tripsHistory: [] } }

// ================= ЗАГРУЗКА АДРЕСОВ ИЗ ФАЙЛА =================
const ADDRESS_FILE = path.join(__dirname, 'data', 'address.json'); // Новое имя файла
let addresses = [];
let addressMap = new Map();

try {
  console.log('📁 Читаем файл:', ADDRESS_FILE);
  
  if (!fs.existsSync(ADDRESS_FILE)) {
    console.error('❌ Файл не найден!');
  } else {
    const fileContent = fs.readFileSync(ADDRESS_FILE, 'utf-8');
    addresses = JSON.parse(fileContent);
    
    // Создаем карту для быстрого поиска
    addresses.forEach(item => {
      const normalizedAddress = item.address.toLowerCase().trim();
      addressMap.set(normalizedAddress, item.info);
    });
    
    console.log(`✅ Успешно загружено ${addresses.length} адресов`);
    console.log('📋 Примеры адресов:');
    addresses.slice(0, 3).forEach((item, index) => {
      console.log(`   ${index + 1}. "${item.address}" -> "${item.info}"`);
    });
  }
} catch (e) {
  console.error('❌ Ошибка при загрузке адресов:', e.message);
  addresses = [];
}

// ================= ADMIN PASSWORD =================
const ADMIN_PASSWORD = 'admin123';

// ================= СОХРАНЕНИЕ СОСТОЯНИЯ =================
const STATE_FILE = path.join(__dirname, 'game-state.json');

function saveState() {
  try {
    const state = {
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
      teams = state.teams || {};
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
    teams[sanitizedCode] = { 
      tripsHistory: [],
      createdAt: Date.now(),
      lastActive: Date.now()
    };
    console.log(`👥 Новая команда: ${sanitizedCode}`);
  } else {
    teams[sanitizedCode].lastActive = Date.now();
  }

  res.json({ 
    success: true, 
    tripsHistory: teams[sanitizedCode].tripsHistory
  });
});

// 👇 **ГЛАВНЫЙ МАРШРУТ ДЛЯ ПОЕЗДОК - ТЕПЕРЬ БЕЗ ПРОВЕРКИ ТАЙМЕРА**
app.post('/api/trip', (req, res) => {
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

  // 🔍 ПОИСК АДРЕСА
  const normalizedAddress = address.trim().toLowerCase();
  const tripInfo = addressMap.get(normalizedAddress);
  
  // Формируем результат
  const resultInfo = tripInfo 
    ? tripInfo
    : 'По этому адресу ничего интересного не обнаружено';

  // Создаем запись о поездке
  const trip = {
    id: Date.now() + Math.random().toString(36).substr(2, 5),
    time: new Date().toLocaleTimeString('ru-RU'),
    timestamp: Date.now(),
    address: address,
    info: resultInfo
  };

  // Добавляем в историю команды
  teams[teamCode].tripsHistory.push(trip);
  teams[teamCode].lastActive = Date.now();
  
  // Ограничиваем историю (последние 100 поездок)
  const MAX_TRIPS = 100;
  if (teams[teamCode].tripsHistory.length > MAX_TRIPS) {
    teams[teamCode].tripsHistory = teams[teamCode].tripsHistory.slice(-MAX_TRIPS);
  }

  saveState();

  console.log(`🚗 Команда ${teamCode}: "${address}" -> ${tripInfo ? 'НАЙДЕНО' : 'НЕ НАЙДЕНО'}`);

  res.json({ 
    success: true,
    info: resultInfo,
    tripsHistory: teams[teamCode].tripsHistory
  });
});

// 👇 МАРШРУТ ДЛЯ СИНХРОНИЗАЦИИ КОМАНДЫ
app.get('/api/team/:teamCode/sync', (req, res) => {
  const { teamCode } = req.params;
  
  if (!teamCode || !teams[teamCode]) {
    return res.json({ success: false, error: 'Команда не найдена' });
  }
  
  teams[teamCode].lastActive = Date.now();
  
  res.json({
    success: true,
    tripsHistory: teams[teamCode].tripsHistory,
    serverTime: Date.now()
  });
});

// ================= АДМИНСКИЕ МАРШРУТЫ =================

// Получить все поездки для админа
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
  
  // Сортируем по времени (новые сверху)
  allTrips.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  res.json({ 
    allTrips,
    teamsInfo,
    totalTeams: Object.keys(teams).length
  });
});

// Сброс всех данных
app.post('/api/admin/reset', (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: 'Неверный пароль' });
  }

  teams = {};
  saveState();
  
  res.json({ success: true, message: '🔄 Все данные сброшены' });
});

// ================= ПИНГ ДЛЯ UPTIME ROBOT =================
app.get('/api/ping', (req, res) => {
  res.json({ 
    status: 'ok', 
    time: Date.now(),
    activeTeams: Object.keys(teams).length,
    totalTrips: Object.values(teams).reduce((sum, team) => sum + team.tripsHistory.length, 0)
  });
});

// ================= ДЕБАГ МАРШРУТ =================
app.get('/api/debug/address/:address', (req, res) => {
  const searchAddress = req.params.address.toLowerCase().trim();
  const found = addressMap.get(searchAddress);
  
  res.json({
    requested: req.params.address,
    normalized: searchAddress,
    found: !!found,
    info: found || null,
    allAddresses: Array.from(addressMap.keys()).slice(0, 10) // первые 10 для примера
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
