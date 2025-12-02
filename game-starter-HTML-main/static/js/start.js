// start.js - Start Page logic (expects start-backend.py on port 5000 and main-backend on 5001)

const btnStart = document.getElementById('btnStart');
const nameInput = document.getElementById('player-name-input');
const errorMsg = document.getElementById('error-msg');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modal-body');
const modalClose = document.getElementById('modal-close');
const btnHowTo = document.getElementById('btnHowTo');

const START_API = 'http://127.0.0.1:5000/api/start';
const MAIN_API_UPDATE = 'http://127.0.0.1:5001/api/main/update';

function showModal(html) { modalBody.innerHTML = html; modal.classList.remove('hidden'); }
function hideModal() { modal.classList.add('hidden'); }
modalClose && modalClose.addEventListener('click', hideModal);

function isValidName(name) { return name.trim() !== '' && /[A-Za-z]/.test(name); }

const HOW_TEMPLATE = `
  <div class="how-container">
    <h2>How to Play</h2> 
    <ul style="text-align:left">
      <li>Enter your name to start the game.</li>
      <li>Travel to airports and collect 5 ChronoShards.</li>
      <li>Shards are random every playthrough.</li>
      <li>Range and Credits matter for survival.</li>
    </ul>
  </div>
`;

btnHowTo && btnHowTo.addEventListener('click', () => {
  showModal(HOW_TEMPLATE);
});

btnStart.addEventListener('click', async () => {
  const playerName = nameInput.value.trim();
  errorMsg.textContent = '';

  if (!isValidName(playerName)) {
    errorMsg.textContent = 'Please enter a valid name (letters required).';
    return;
  }

  // initial state
  const initialState = {
    playerName,
    credits: 1000,
    energy: 1000,
    shards: { shard1:false, shard2:false, shard3:false, shard4:false, shard5:false },
    countShards: 0,
    currentLocation: 'EFHK'
  };

  try {
    // POST to start-backend to initialize server-side start state
    const res = await fetch(START_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: playerName })
    });

    if (!res.ok) {
      const err = await res.json().catch(()=>({error:'Start failed'}));
      errorMsg.textContent = err.error || 'Failed to start game.';
      return;
    }

    const data = await res.json();

    // Save to localStorage (frontend canonical state)
    localStorage.setItem('playerState', JSON.stringify(initialState));
    localStorage.setItem('playerName', playerName);

    // Sync to main-backend so main has the state server-side
    try {
      await fetch(MAIN_API_UPDATE, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ state: initialState })
      }).catch(()=>{ /* non-fatal */ });
    } catch(e){ /* ignore */ }

    // Redirect to main page (main-backend serves /main)
    window.location.href = 'http://127.0.0.1:5001/main';
  } catch (err) {
    console.error(err);
    errorMsg.textContent = 'Error connecting to backend.';
  }
});