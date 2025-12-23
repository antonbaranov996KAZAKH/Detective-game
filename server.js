const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

const addresses = JSON.parse(fs.readFileSync('./data/addresses.json'));
let teams = {}; // прогресс команд хранится здесь

// Логин по коду команды
app.post('/api/login', (req, res) => {
  const { teamCode } = req.body;
  if (!teamCode) return res.status(400).json({ error: 'Нет кода команды' });

  if (!teams[teamCode]) {
    teams[teamCode] = { tripsLeft: 10, tripsHistory: [] };
  }

  res.json({
    success: true,
    tripsLeft: teams[teamCode].tripsLeft,
    tripsHistory: teams[teamCode].tripsHistory
  });
});

// Получение состояния команды
app.get('/api/state/:teamCode', (req, res) => {
  const team = teams[req.params.teamCode];
  if (!team) return res.status(400).json({ error: 'Команда не найдена' });
  res.json(team);
});

// Поездка по адресу
app.post('/api/trip', (req, res) => {
  const { teamCode, address } = req.body;
  const team = teams[teamCode];
  if (!team) return res.status(400).json({ error: 'Команда не найдена' });

  if (team.tripsLeft <= 0) {
    return res.json({ info: 'Поездки закончились', tripsLeft: 0 });
  }

  team.tripsLeft -= 1;

  const addrObj = addresses.find(a => a.address === address);
  const info = addrObj ? addrObj.info : 'Нет доступной информации';

  team.tripsHistory.push({ address, info, time: new Date().toLocaleTimeString() });

  res.json({ info, tripsLeft: team.tripsLeft, tripsHistory: team.tripsHistory });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
