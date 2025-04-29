// Canvas & Skalierung
const canvas = document.getElementById('tetris');
const ctx    = canvas.getContext('2d');
ctx.scale(30, 30);

// Profile aus localStorage oder neuer Standard
let profiles = JSON.parse(localStorage.getItem('tetrisProfiles') || '[]');
if (!profiles.length) {
  profiles = [{ name: 'Gast', highScore: 0 }];
  localStorage.setItem('tetrisProfiles', JSON.stringify(profiles));
}
let currentProfile = profiles[0].name;

// UI-Elemente
const profileNameInput = document.getElementById('profileName');
const createProfileBtn = document.getElementById('createProfile');
const profileSelect    = document.getElementById('profileSelect');
const deleteProfileBtn = document.getElementById('deleteProfile');
const startBtn         = document.getElementById('startBtn');
const restartBtn       = document.getElementById('restartBtn');
const quitBtn          = document.getElementById('quitBtn');
const modeEasy         = document.getElementById('modeEasy');
const modeHard         = document.getElementById('modeHard');
const modeImpossible   = document.getElementById('modeImpossible');
const scoresList       = document.getElementById('scoresList');
const gameOverEl       = document.getElementById('gameOver');
const scoreEl          = document.getElementById('score');

// Spielvariablen
const EASY       = 1000;
const HARD       = 200;
const IMPOSSIBLE = HARD / 4;
let dropInterval = EASY, dropCounter = 0, lastTime = 0;
let isGameOver = false, gameStarted = false;

const arena = Array.from({ length: 20 }, () => Array(10).fill(0));
const colors = [
  null,
  '#FF0D72','#0DC2FF','#0DFF72',
  '#F538FF','#FF8E0D','#FFE138','#3877FF'
];
const player = { pos: { x:0, y:0 }, matrix: null, score: 0 };

// — UI-Rendering —
function renderProfiles() {
  profileSelect.innerHTML = '';
  profiles.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.name;
    opt.textContent = p.name;
    profileSelect.appendChild(opt);
  });
  profileSelect.value = currentProfile;
}

function renderLeaderboard() {
  const sorted = [...profiles].sort((a,b)=>b.highScore - a.highScore);
  scoresList.innerHTML = '';
  sorted.forEach(p => {
    const li = document.createElement('li');
    li.textContent = `${p.name}: ${p.highScore}`;
    scoresList.appendChild(li);
  });
}

renderProfiles();
renderLeaderboard();

// — Event-Handler —
createProfileBtn.addEventListener('click', () => {
  const name = profileNameInput.value.trim();
  if (!name || profiles.some(p=>p.name===name)) return;
  profiles.push({ name, highScore: 0 });
  localStorage.setItem('tetrisProfiles', JSON.stringify(profiles));
  currentProfile = name;
  profileNameInput.value = '';
  renderProfiles();
  renderLeaderboard();
});

profileSelect.addEventListener('change', () => currentProfile = profileSelect.value);

deleteProfileBtn.addEventListener('click', () => {
  if (profiles.length <= 1) return;
  profiles = profiles.filter(p => p.name !== currentProfile);
  currentProfile = profiles[0].name;
  localStorage.setItem('tetrisProfiles', JSON.stringify(profiles));
  renderProfiles();
  renderLeaderboard();
});

modeEasy.addEventListener('change', () => dropInterval = EASY);
modeHard.addEventListener('change', () => dropInterval = HARD);
modeImpossible.addEventListener('change', () => dropInterval = IMPOSSIBLE);

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
quitBtn.addEventListener('click', () => endGame(true));

// — Tastatursteuerung —
window.addEventListener('keydown', e => {
  if (!gameStarted || isGameOver) return;
  switch (e.key) {
    case 'ArrowLeft':  playerMove(-1); break;
    case 'ArrowRight': playerMove(1);  break;
    case 'ArrowDown':  playerDrop();    break;
    case 'w': case 'W': playerRotate(1); break;
  }
});

// — Spiellogik —
function createPiece(type) {
  return {
    T: [[0,0,0],[1,1,1],[0,1,0]],
    O: [[2,2],[2,2]],
    L: [[0,3,0],[0,3,0],[0,3,3]],
    J: [[0,4,0],[0,4,0],[4,4,0]],
    I: [[0,5,0,0],[0,5,0,0],[0,5,0,0],[0,5,0,0]],
    S: [[0,6,6],[6,6,0],[0,0,0]],
    Z: [[7,7,0],[0,7,7],[0,0,0]]
  }[type];
}

function drawMatrix(m, o) {
  m.forEach((row,y) => {
    row.forEach((v,x) => {
      if (v) {
        ctx.fillStyle = colors[v];
        ctx.fillRect(o.x+x, o.y+y, 1, 1);
      }
    });
  });
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  drawMatrix(arena, {x:0,y:0});
  if (player.matrix) drawMatrix(player.matrix, player.pos);
}

function collide(arena, player) {
  const [m,o] = [player.matrix, player.pos];
  return m.some((row,y) =>
    row.some((v,x) =>
      v && (
        o.y+y >= arena.length ||
        o.x+x < 0 ||
        o.x+x >= arena[0].length ||
        arena[o.y+y][o.x+x]
      )
    )
  );
}

function merge(arena, player) {
  player.matrix.forEach((row,y) =>
    row.forEach((v,x) => {
      if (v) arena[player.pos.y+y][player.pos.x+x] = v;
    })
  );
}

function sweep() {
  let rowCount = 1;
  outer: for (let y=arena.length-1; y>0; --y) {
    if (arena[y].every(v=>v>0)) {
      const row = arena.splice(y,1)[0].fill(0);
      arena.unshift(row);
      player.score += rowCount * 10;
      rowCount *= 2;
      updateScore();
      ++y;
    }
  }
}

function playerDrop() {
  player.pos.y++;
  if (collide(arena,player)) {
    player.pos.y--;
    merge(arena,player);
    sweep();
    playerReset();
  }
  dropCounter = 0;
}

function playerMove(dir) {
  player.pos.x += dir;
  if (collide(arena,player)) player.pos.x -= dir;
}

function rotate(m,dir) {
  for (let y=0; y<m.length; ++y)
    for (let x=0; x<y; ++x)
      [m[x][y],m[y][x]]=[m[y][x],m[x][y]];
  dir>0 ? m.forEach(r=>r.reverse()) : m.reverse();
}

function playerRotate(dir) {
  const pos = player.pos.x;
  let off = 1;
  rotate(player.matrix,dir);
  while (collide(arena,player)) {
    player.pos.x += off;
    off = -(off + (off>0?1:-1));
    if (off > player.matrix[0].length) {
      rotate(player.matrix,-dir);
      player.pos.x = pos;
      return;
    }
  }
}

function updateScore() {
  scoreEl.innerText = player.score;
}

function playerReset() {
  const pieces = 'TJLOSZI';
  player.matrix = createPiece(pieces[Math.floor(Math.random()*pieces.length)]);
  player.pos.y = 0;
  player.pos.x = Math.floor(arena[0].length/2) - Math.floor(player.matrix[0].length/2);
  if (collide(arena,player)) endGame();
}

function update(time=0) {
  if (!gameStarted) return;
  const delta = time - lastTime;
  lastTime = time;
  dropCounter += delta;
  if (dropCounter > dropInterval) playerDrop();
  draw();
  requestAnimationFrame(update);
}

// — Start / Restart / End —
function startGame() {
  gameOverEl.style.display = 'none';
  isGameOver = false;
  gameStarted = true;
  dropCounter = 0;
  lastTime = 0;
  arena.forEach(r=>r.fill(0));
  player.score = 0;
  updateScore();
  playerReset();
  requestAnimationFrame(update);
}

function endGame(quit=false) {
  if (!quit) gameOverEl.style.display = 'block';
  isGameOver = true;
  gameStarted = false;
  const prof = profiles.find(p=>p.name===currentProfile);
  if (player.score > prof.highScore) prof.highScore = player.score;
  localStorage.setItem('tetrisProfiles', JSON.stringify(profiles));
  renderLeaderboard();
}

