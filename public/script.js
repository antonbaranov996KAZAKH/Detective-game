let teamCode = '';
let tripsLeft = 0;

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
    tripsLeft = data.tripsLeft;
    document.getElementById('tripsLeft').textContent = tripsLeft;
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
    tripsLeft = data.tripsLeft;
    document.getElementById('tripsLeft').textContent = tripsLeft;
    updateHistory(data.tripsHistory);
    alert(data.info);
    if (tripsLeft <= 0) alert('Поездки закончились!');
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
