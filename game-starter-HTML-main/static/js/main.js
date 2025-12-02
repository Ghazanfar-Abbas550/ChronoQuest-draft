/* main.js - Main game client */

const API_BASE = ''; // same origin

// Load from localStorage if available
const savedState = JSON.parse(localStorage.getItem('playerState') || '{}');

let GAME_STATE = {
  playerName: savedState.playerName || "Player",
  credits: savedState.credits ?? 1000,
  energy: savedState.energy ?? 1000,
  shards: savedState.shards || {},
  countShards: savedState.countShards ?? 0,
  currentLocation: savedState.currentLocation || "EFHK"
};

let AIRPORTS = [];

// DOM Elements
const sidebar = document.getElementById('sidebar');
const airportInfo = document.getElementById('airport-info');
const btnTravel = document.getElementById('btnTravel');
const statusName = document.getElementById('player-name');
const statusCredits = document.getElementById('credits');
const statusRange = document.getElementById('range');
const statusShards = document.getElementById('shards');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modal-body');
const modalClose = document.getElementById('modal-close');
const btnHowTo = document.getElementById('btnHowTo');
const btnBuyRange = document.getElementById('btnBuyRange');

// Modal helper
function showModal(html){ modalBody.innerHTML = html; modal.classList.remove('hidden'); }
function hideModal(){ modal.classList.add('hidden'); }
modalClose && modalClose.addEventListener('click', hideModal);

function renderStatus(){
  statusName.textContent = `Name: ${GAME_STATE.playerName}`;
  statusCredits.textContent = `Credits: ${GAME_STATE.credits}`;
  statusRange.textContent = `Range: ${GAME_STATE.energy}`;

  const shardCount = Object.values(GAME_STATE.shards).filter(Boolean).length;
  statusShards.textContent = `Shards: ${shardCount}/5`;
}

// Persist state to backend + localStorage
function persistState(){
  fetch('/api/main/update', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ state: GAME_STATE })
  }).catch(()=>{});
  localStorage.setItem('playerState', JSON.stringify(GAME_STATE));
}

// Load state: localStorage first, then server fallback
async function loadState() {
  const local = localStorage.getItem('playerState');

  if (local) {
    try {
      const parsed = JSON.parse(local);

      // Merge instead of overwrite:
      GAME_STATE = {
        ...GAME_STATE,
        ...parsed,
        shards: { ...GAME_STATE.shards, ...parsed.shards }
      };

    } catch (e) {}
  }

  // Optional backend sync:
  try {
    const res = await fetch('/api/main/state');
    const data = await res.json();

    if (data && data.state) {
      GAME_STATE = {
        ...GAME_STATE,
        ...data.state,
        shards: { ...GAME_STATE.shards, ...data.state.shards }
      };
    }
  } catch (e) {}

  // Count shards
  GAME_STATE.countShards = Object.values(GAME_STATE.shards).filter(Boolean).length;
}

// How to play
const HOW_TEMPLATE = `
<div class="how-container">
  <h2>How to Play</h2>
  <ul>
    <li>Travel between airports to collect 5 ChronoShards.</li>
    <li>Each flight costs range.</li>
    <li>1 credit = 2 range when buying range.</li>
    <li>Bandits may steal credits randomly.</li>
    <li>Collect all shards and return to EFHK to win.</li>
    <li>Game ends if you can't travel (not enough range/credits) or reach 0 credits/range.</li>
  </ul>
</div>
`;
btnHowTo && btnHowTo.addEventListener('click', ()=>showModal(HOW_TEMPLATE));

// Buy Range
btnBuyRange && btnBuyRange.addEventListener('click', ()=>{
  const html = `
    <h3>Buy Range</h3>
    <p>1 Credit = 2 Range</p>
    <input type="number" id="rangeCredits" placeholder="Credits to spend" min="1" style="width:100%;padding:6px;margin-top:6px;">
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px;">
      <button id="buyRangeCancel">Cancel</button>
      <button id="buyRangeConfirm">Buy</button>
    </div>
  `;
  showModal(html);

  document.getElementById('buyRangeCancel').addEventListener('click', hideModal);
  document.getElementById('buyRangeConfirm').addEventListener('click', ()=>{
    const val = parseInt(document.getElementById('rangeCredits').value);
    if(isNaN(val) || val<=0){
      showModal('<p>Please enter a valid number of credits.</p>');
      return;
    }
    if(val > GAME_STATE.credits){
      showModal('<p>Not enough credits.</p>');
      return;
    }
    GAME_STATE.credits -= val;
    GAME_STATE.energy += val*2;
    renderStatus();
    persistState();
    hideModal();
  });
});

// Load airports
async function loadAirports(){
  try{
    AIRPORTS = await (await fetch('/api/main/airports')).json();
  } catch(e){ AIRPORTS = []; }
}

// Map positions
const POS = {
  "EFHK": { left: "80%", top: "25%" },
  "EDDS": { left: "40%", top: "50%" },
  "EVRA": { left: "60%", top: "30%" },
  "ENZV": { left: "30%", top: "20%" },
  "EHAM": { left: "35%", top: "45%" },
  "EBBR": { left: "37%", top: "50%" },
  "LIPE": { left: "50%", top: "70%" },
  "LIRN": { left: "48%", top: "75%" },
  "ENGM": { left: "35%", top: "15%" },
  "ENTC": { left: "40%", top: "10%" },
  "LPFR": { left: "10%", top: "70%" }
};

// Render map markers
function renderMapMarkers(){
  const mapWrapper = document.getElementById('map-wrapper');
  mapWrapper.innerHTML = '<img id="map" src="../static/img/map.svg" alt="Map">';

  AIRPORTS.forEach(a=>{
    const pos = POS[a.ICAO] || { left:`${Math.random()*90}%`, top:`${Math.random()*90}%` };
    const img = document.createElement('img');
    img.className = 'airport-marker';
    img.dataset.icao = a.ICAO;
    img.alt = a.ICAO;
    img.title = `${a.ICAO} — ${a.name}`;
    img.style.left = pos.left;
    img.style.top = pos.top;

    if(GAME_STATE.currentLocation===a.ICAO){
      img.src = '../static/img/country-pin.png';
      img.classList.add('current');
    } else img.src = '../static/img/white-dot.png';

    img.addEventListener('click', e=>{ openSidebar(a); e.stopPropagation(); });
    mapWrapper.appendChild(img);
  });
}

// Sidebar
function openSidebar(a){
  const distance = a.distance ?? a.distanceFromEFHK ?? 'N/A';
  airportInfo.innerHTML = `
    <p><strong>${a.ICAO} — ${a.name}</strong></p>
    <p><strong>Country:</strong> ${a.country}</p>
    <p><strong>Distance from EFHK:</strong> ${distance} km</p>
    <p><strong>Energy required (est):</strong> random 20-200</p>
  `;

  if(GAME_STATE.currentLocation===a.ICAO) btnTravel.style.display='none';
  else btnTravel.style.display='inline-block', btnTravel.onclick=()=>handleTravel(a);

  sidebar.classList.add('visible');
  sidebar.setAttribute('aria-hidden','false');
}

document.addEventListener('click', e=>{
  if(!sidebar.contains(e.target) && !e.target.classList.contains('airport-marker')){
    sidebar.classList.remove('visible');
    sidebar.setAttribute('aria-hidden','true');
  }
});

// Travel
function handleTravel(a){
  const cost = Math.floor(Math.random()*(200-20+1))+20;
  if(GAME_STATE.energy<cost){
    showModal(`<p>Not enough range. Required ${cost}, you have ${GAME_STATE.energy}.</p>`);
    return;
  }
  if(GAME_STATE.credits<=0){
    showModal('<p>You have 0 credits. Game Over!</p>');
    return;
  }

  GAME_STATE.energy -= cost;

  const events=[];
  const remaining=[1,2,3,4,5].filter(i=>!GAME_STATE.shards[`shard${i}`]);
  if(remaining.length>0 && Math.random()<0.5){
    const shard = remaining[Math.floor(Math.random()*remaining.length)];
    GAME_STATE.shards[`shard${shard}`]=true;
    events.push({type:'shard',shard});
  }

  if(Math.random()<0.1){
    const loss=Math.floor(Math.random()*131)+20;
    GAME_STATE.credits=Math.max(0,GAME_STATE.credits-loss);
    events.push({type:'bandit',amount:loss});
  }

  if(Math.random()<0.6){
    const gain=Math.floor(Math.random()*101);
    if(gain>0){
      GAME_STATE.credits+=gain;
      events.push({type:'credit',amount:gain});
    }
  }

  GAME_STATE.currentLocation=a.ICAO;
  GAME_STATE.countShards=Object.values(GAME_STATE.shards).filter(Boolean).length;

  renderStatus();
  persistState();

  if(events.length>0){
    let html='';
    events.forEach(ev=>{
      if(ev.type==='shard') html+=`<p>✨ You found a ChronoShard (shard${ev.shard})!</p><img src="../static/img/chronoshard${ev.shard}.png" style="max-width:90px;">`;
      if(ev.type==='bandit') html+=`<p>Lost ${ev.amount} credits to bandits.</p><img src="../static/img/lose-credit-or-energy.png" style="max-width:120px;">`;
      if(ev.type==='credit') html+=`<p>Gained ${ev.amount} credits.</p><img src="../static/img/celebrate.png" style="max-width:120px;">`;
    });
    showModal(html);
  }

  if(GAME_STATE.countShards>=5 && GAME_STATE.currentLocation==='EFHK'){
    showModal('<p>🏆 You collected all shards and returned to EFHK — YOU WIN!</p>');
  } else if(GAME_STATE.credits<=0 || GAME_STATE.energy<=0){
    showModal('<p>💀 You ran out of credits or range — GAME OVER!</p>');
  }

  renderMapMarkers();
}

// Initialize
(async()=>{
  await loadState();
  await loadAirports();
  renderMapMarkers();
  renderStatus();
})();