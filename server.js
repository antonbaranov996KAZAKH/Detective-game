const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Раздаём файлы из public
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json()); // чтобы парсить JSON при POST

// Простейшее хранилище команд
const teams = {
  "team1": "1234",
  "team2": "abcd",
  "detectives": "topsecret"
};

// Эндпоинт логина
app.post('/login', (req, res) => {
  const { login, password } = req.body;

  if (teams[login] && teams[login] === password) {
    res.json({ success: true, message: "Вход выполнен!" });
  } else {
    res.json({ success: false, message: "Неверный логин или пароль" });
  }
});

// Всё остальное — отдадим index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});