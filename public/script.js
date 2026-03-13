let teamCode = '';
let tripCounter = 0; // вместо tripsLeft

function login() {
  teamCode = document.getElementById('teamCode').value.trim();
  if (!teamCode) return alert('Введите код команды');

  fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teamCode })
  })
  .then(res => res.json())
  .then(data => {
    if (!data.success) return alert('Ошибка входа');
    
    // убираем tripsLeft, считаем уже сделанные поездки
    tripCounter = data.tripsHistory.length; 
    document.getElementById('tripsLeft').textContent = tripCounter; // теперь просто счётчик
    updateHistory(data.tripsHistory);
    document.getElementById('game').style.display = 'block';
  });
}

function goTrip() {
  const address = document.getElementById('addressInput').value.trim();
  if (!address) return alert('Введите адрес');

  fetch('/api/trip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teamCode, address })
  })
  .then(res => res.json())
  .then(data => {
    // увеличиваем счётчик на 1 после каждой поездки
    tripCounter++; 
    document.getElementById('tripsLeft').textContent = tripCounter;
    updateHistory(data.tripsHistory);
    alert(data.info);

    // больше лимита нет, так что проверка tripsLeft удалена
    // if (tripsLeft <= 0) alert('Поездки закончились!');
  });
}

function updateHistory(history) {
  const ul = document.getElementById('tripsHistory');
  ul.innerHTML = '';
  history.forEach(h => {
    const li = document.createElement('li');
    li.textContent = `${h.time} — ${h.address} → ${h.info}`;
    ul.appendChild(li);
  });
}
