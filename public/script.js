let teamCode = '';
let tripCounter = 0;

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
    
    tripCounter = data.tripsHistory.length;
    document.getElementById('tripsLeft').textContent = tripCounter;
    document.getElementById('teamCodeDisplay').textContent = teamCode;
    updateHistory(data.tripsHistory);

    // Скрываем логин, показываем игру
    document.getElementById('login-screen').style.display = 'none';
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
    tripCounter++;
    document.getElementById('tripsLeft').textContent = tripCounter;
    updateHistory(data.tripsHistory);
    alert(data.info);

    // Скроллим историю вниз автоматически
    const historyBox = document.getElementById('history-box');
    historyBox.scrollTop = historyBox.scrollHeight;
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
