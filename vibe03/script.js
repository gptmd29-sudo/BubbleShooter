const canvas = document.querySelector('#game-canvas');
const context = canvas.getContext('2d');
const scoreElement = document.querySelector('#score');
const roundElement = document.querySelector('#round');
const penaltiesElement = document.querySelector('#penalties');
const messageElement = document.querySelector('#message');
const currentPreview = document.querySelector('#current-preview');
const nextPreview = document.querySelector('#next-preview');
const overlay = document.querySelector('#overlay');
const overlayKicker = document.querySelector('#overlay-kicker');
const overlayTitle = document.querySelector('#overlay-title');
const overlayScore = document.querySelector('#overlay-score');
const primaryAction = document.querySelector('#primary-action');
const saveAction = document.querySelector('#save-action');

const COLORS = ['#f25555', '#4d8dff', '#58b878', '#f5c84b', '#a77bdf'];
const ROWS = 12;
const COLS = 14;
const RADIUS = 17;
const DIAMETER = RADIUS * 2;
const ROW_HEIGHT = Math.sqrt(3) * RADIUS;
const MAX_PENALTIES = 5;
const START_ROWS = 5;
const SHOOTER_Y = ROWS * ROW_HEIGHT + 65;
const DANGER_Y = ROWS * ROW_HEIGHT - 17;

let board = [];
let score = 0;
let highScore = readHighScore();
let round = 1;
let penaltiesLeft = MAX_PENALTIES;
let currentColor = 0;
let nextColor = 1;
let aimAngle = -Math.PI / 2;
let projectile = null;
let gameState = 'ready';
let lastFrame = 0;
let canvasScale = 1;
let boardWidth = 0;
let effects = [];
let fallingBubbles = [];

function readHighScore() { try { return Number(localStorage.getItem('bubbleShooterHighScore')) || 0; } catch { return 0; } }
function randomColor() { return Math.floor(Math.random() * COLORS.length); }
function createInitialBoard() { return Array.from({ length: ROWS }, (_, row) => Array.from({ length: COLS }, () => row < Math.min(START_ROWS + round - 1, 9) ? randomColor() : null)); }
function rowOffset(row) { return row % 2 ? RADIUS : 0; }
function cellPosition(row, col) { return { x: RADIUS + col * DIAMETER + rowOffset(row), y: RADIUS + row * ROW_HEIGHT }; }
function isInside(row, col) { return row >= 0 && row < ROWS && col >= 0 && col < COLS; }
function neighbors(row, col) { const even = row % 2 === 0; const offsets = even ? [[-1,-1],[-1,0],[0,-1],[0,1],[1,-1],[1,0]] : [[-1,0],[-1,1],[0,-1],[0,1],[1,0],[1,1]]; return offsets.map(([rowOffsetValue, colOffsetValue]) => [row + rowOffsetValue, col + colOffsetValue]).filter(([nextRow, nextCol]) => isInside(nextRow, nextCol)); }
function setCanvasSize() { const width = Math.min(820, Math.max(300, canvas.parentElement.clientWidth)); boardWidth = width; canvasScale = width / (COLS * DIAMETER + RADIUS * 2 + RADIUS); canvas.width = width * devicePixelRatio; canvas.height = (SHOOTER_Y + 18) * canvasScale * devicePixelRatio; context.setTransform(devicePixelRatio * canvasScale, 0, 0, devicePixelRatio * canvasScale, 0, 0); }
function colorStyle(color) { return COLORS[color]; }
function drawBubble(x, y, color, radius = RADIUS, alpha = 1) { context.save(); context.globalAlpha = alpha; const gradient = context.createRadialGradient(x - radius * .35, y - radius * .42, radius * .1, x, y, radius); gradient.addColorStop(0, '#ffffff'); gradient.addColorStop(.14, colorStyle(color)); gradient.addColorStop(1, colorStyle(color)); context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.fillStyle = gradient; context.fill(); context.strokeStyle = 'rgba(255,255,255,.35)'; context.lineWidth = 1.5; context.stroke(); context.restore(); }
function drawBoard() { context.clearRect(0, 0, boardWidth / canvasScale, SHOOTER_Y + 20); const logicalWidth = boardWidth / canvasScale; context.fillStyle = 'rgba(255,255,255,.025)'; context.fillRect(0, 0, logicalWidth, SHOOTER_Y); context.strokeStyle = 'rgba(255,123,115,.38)'; context.setLineDash([5, 7]); context.beginPath(); context.moveTo(0, DANGER_Y); context.lineTo(logicalWidth, DANGER_Y); context.stroke(); context.setLineDash([]); board.forEach((row, rowIndex) => row.forEach((color, colIndex) => { if (color !== null) { const position = cellPosition(rowIndex, colIndex); drawBubble(position.x, position.y, color); } })); fallingBubbles.forEach((bubble) => { const wobble = Math.sin(bubble.age * 17 + bubble.phase) * Math.min(9, 3 + bubble.age * 7); drawBubble(bubble.baseX + wobble, bubble.y, bubble.color, RADIUS, Math.max(0, 1 - Math.max(0, bubble.age - .65) * 2.8)); }); if (projectile) drawBubble(projectile.x, projectile.y, projectile.color); if (gameState === 'ready') drawAimGuide(); }
function drawAimGuide() { const start = { x: boardWidth / canvasScale / 2, y: SHOOTER_Y - 24 }; const length = 104; context.save(); context.setLineDash([4, 7]); context.strokeStyle = 'rgba(100,214,232,.55)'; context.lineWidth = 2; context.beginPath(); context.moveTo(start.x, start.y); context.lineTo(start.x + Math.cos(aimAngle) * length, start.y + Math.sin(aimAngle) * length); context.stroke(); context.restore(); }
function updatePreview() { currentPreview.style.background = colorStyle(currentColor); nextPreview.style.background = colorStyle(nextColor); scoreElement.textContent = String(score).padStart(4, '0'); roundElement.textContent = String(round).padStart(2, '0'); penaltiesElement.innerHTML = ''; for (let index = 0; index < MAX_PENALTIES; index += 1) { const penalty = document.createElement('span'); penalty.className = `penalty ${index >= penaltiesLeft ? 'empty' : ''}`; penaltiesElement.appendChild(penalty); } }
function setMessage(message) { messageElement.textContent = message; }
function pointerPosition(event) { const rectangle = canvas.getBoundingClientRect(); return { x: (event.clientX - rectangle.left) / canvasScale, y: (event.clientY - rectangle.top) / canvasScale }; }
function updateAim(event) { if (gameState !== 'ready') return; const point = pointerPosition(event); const shooter = { x: boardWidth / canvasScale / 2, y: SHOOTER_Y - 24 }; let angle = Math.atan2(point.y - shooter.y, point.x - shooter.x); if (angle > -0.12) angle = -0.12; if (angle < -Math.PI + 0.12) angle = -Math.PI + 0.12; aimAngle = angle; }
function fireBubble() { if (gameState !== 'ready') return; gameState = 'firing'; const shooter = { x: boardWidth / canvasScale / 2, y: SHOOTER_Y - 24 }; projectile = { x: shooter.x, y: shooter.y, vx: Math.cos(aimAngle) * 500, vy: Math.sin(aimAngle) * 500, color: currentColor }; currentColor = nextColor; nextColor = randomColor(); updatePreview(); setMessage('버블이 날아가고 있어요'); }
function distance(first, second) { return Math.hypot(first.x - second.x, first.y - second.y); }
function findCollision() { if (!projectile) return false; if (projectile.y - RADIUS <= 0) return true; for (let row = 0; row < ROWS; row += 1) for (let col = 0; col < COLS; col += 1) if (board[row][col] !== null && distance(projectile, cellPosition(row, col)) <= DIAMETER - 2) return true; return false; }
function nearestEmptyCell() { let best = null; let bestDistance = Infinity; for (let row = 0; row < ROWS; row += 1) for (let col = 0; col < COLS; col += 1) if (board[row][col] === null) { const candidate = cellPosition(row, col); const candidateDistance = distance(projectile, candidate); if (candidateDistance < bestDistance) { best = [row, col]; bestDistance = candidateDistance; } } return best; }
function connectedGroup(row, col, color) { const group = []; const visited = new Set(); const queue = [[row, col]]; while (queue.length) { const [currentRow, currentCol] = queue.shift(); const key = `${currentRow},${currentCol}`; if (visited.has(key) || !isInside(currentRow, currentCol) || board[currentRow][currentCol] !== color) continue; visited.add(key); group.push([currentRow, currentCol]); neighbors(currentRow, currentCol).forEach((next) => queue.push(next)); } return group; }
function floatingBubbles() { const connected = new Set(); const queue = []; for (let col = 0; col < COLS; col += 1) if (board[0][col] !== null) queue.push([0, col]); while (queue.length) { const [row, col] = queue.shift(); const key = `${row},${col}`; if (connected.has(key) || board[row][col] === null) continue; connected.add(key); neighbors(row, col).forEach((next) => queue.push(next)); } const floating = []; board.forEach((row, rowIndex) => row.forEach((color, colIndex) => { if (color !== null && !connected.has(`${rowIndex},${colIndex}`)) floating.push([rowIndex, colIndex]); })); return floating; }
function addFallingBubbles(cells) { cells.forEach(([row, col], index) => { const position = cellPosition(row, col); fallingBubbles.push({ baseX: position.x, y: position.y, color: board[row][col], vy: 35 + Math.random() * 45, age: -index * .035, phase: Math.random() * Math.PI * 2 }); }); }
function updateFallingBubbles(delta) { fallingBubbles = fallingBubbles.filter((bubble) => { if (bubble.age < 0) { bubble.age += delta; return true; } bubble.vy += 520 * delta; bubble.y += bubble.vy * delta; bubble.age += delta; return bubble.y < SHOOTER_Y + 35; }); }
function resolvePlacement(cell) { if (!cell) { gameOver('보드에 더 이상 자리가 없어요'); return; } const [row, col] = cell; board[row][col] = projectile.color; projectile = null; const group = connectedGroup(row, col, board[row][col]); if (group.length >= 3) { addFallingBubbles(group); group.forEach(([groupRow, groupCol]) => { board[groupRow][groupCol] = null; }); score += group.length * 10; const dropped = floatingBubbles(); addFallingBubbles(dropped); dropped.forEach(([dropRow, dropCol]) => { board[dropRow][dropCol] = null; }); score += dropped.length * 20; if (dropped.length) addEffect(`+${dropped.length * 20}`, boardWidth / canvasScale / 2, 100, '#ffbd67'); addEffect(`+${group.length * 10}`, cellPosition(row, col).x, cellPosition(row, col).y, '#64d6e8'); setMessage(dropped.length ? `${group.length}개 매칭 + 공중 버블 ${dropped.length}개!` : `${group.length}개 버블을 제거했어요!`); penaltiesLeft = Math.min(MAX_PENALTIES, penaltiesLeft + 1); const cleared = board.every((line) => line.every((color) => color === null)); window.setTimeout(() => { if (cleared) showClear(); else if (checkGameOver()) gameOver('버블이 위험선에 닿았어요'); else { gameState = 'ready'; updatePreview(); } }, 720); return; } handleMiss(); if (checkGameOver()) { gameOver('버블이 위험선에 닿았어요'); return; } gameState = 'ready'; updatePreview(); }
function handleMiss() { penaltiesLeft -= 1; setMessage(`매칭 실패 · 남은 기회 ${penaltiesLeft}회`); if (penaltiesLeft <= 0) { addCeilingRow(); penaltiesLeft = MAX_PENALTIES; } }
function addCeilingRow() { for (let row = ROWS - 1; row > 0; row -= 1) for (let col = 0; col < COLS; col += 1) board[row][col] = board[row - 1][col]; for (let col = 0; col < COLS; col += 1) board[0][col] = randomColor(); setMessage('천장이 한 줄 내려왔어요!'); }
function checkGameOver() { return board.some((row, rowIndex) => row.some((color) => color !== null && cellPosition(rowIndex, 0).y + RADIUS >= DANGER_Y)); }
function addEffect(text, x, y, color) { effects.push({ text, x, y, color, life: 1 }); }
function updateEffects(delta) { effects = effects.filter((effect) => { effect.y -= 28 * delta; effect.life -= delta; return effect.life > 0; }); }
function drawEffects() { effects.forEach((effect) => { context.save(); context.globalAlpha = effect.life; context.fillStyle = effect.color; context.font = '700 17px DM Sans'; context.textAlign = 'center'; context.fillText(effect.text, effect.x, effect.y); context.restore(); }); }
function gameOver(reason) { gameState = 'gameover'; projectile = null; overlay.hidden = false; overlayKicker.textContent = 'GAME OVER'; overlayTitle.textContent = '버블이 너무 내려왔어요'; overlayScore.textContent = `${reason} · Score ${score}`; primaryAction.textContent = '다시 시작'; saveAction.hidden = false; }
function showClear() { gameState = 'clear'; overlay.hidden = false; overlayKicker.textContent = `ROUND ${String(round).padStart(2, '0')} CLEAR`; overlayTitle.textContent = '깔끔하게 모두 제거했어요!'; overlayScore.textContent = `현재 점수 ${score} · 최고 점수 ${Math.max(score, highScore)}`; primaryAction.textContent = '다음 라운드'; saveAction.hidden = false; }
function saveScore() { if (score > highScore) { highScore = score; try { localStorage.setItem('bubbleShooterHighScore', String(highScore)); } catch {} } saveAction.textContent = '저장 완료'; }
function resetGame(nextRound = false) { if (nextRound) round += 1; else round = 1; score = nextRound ? score : 0; penaltiesLeft = MAX_PENALTIES; currentColor = randomColor(); nextColor = randomColor(); projectile = null; fallingBubbles = []; effects = []; board = createInitialBoard(); gameState = 'ready'; overlay.hidden = true; saveAction.hidden = false; saveAction.textContent = '점수 저장'; setMessage('버블을 조준하고 발사하세요'); updatePreview(); }
function frame(timestamp) { const delta = Math.min((timestamp - lastFrame) / 1000, .04); lastFrame = timestamp; if (projectile && gameState === 'firing') { projectile.x += projectile.vx * delta; projectile.y += projectile.vy * delta; const width = boardWidth / canvasScale; if (projectile.x - RADIUS < 0 || projectile.x + RADIUS > width) { projectile.vx *= -1; projectile.x = Math.max(RADIUS, Math.min(width - RADIUS, projectile.x)); } if (findCollision()) { gameState = 'resolving'; resolvePlacement(nearestEmptyCell()); } } updateFallingBubbles(delta); updateEffects(delta); drawBoard(); drawEffects(); requestAnimationFrame(frame); }
canvas.addEventListener('pointermove', updateAim); canvas.addEventListener('pointerdown', (event) => { canvas.focus(); updateAim(event); }); canvas.addEventListener('pointerup', fireBubble); canvas.addEventListener('pointercancel', () => { if (gameState === 'ready') setMessage('조준 후 터치 또는 클릭을 떼어 발사하세요'); }); canvas.addEventListener('keydown', (event) => { if (event.key === 'ArrowLeft') { aimAngle = Math.max(-Math.PI + .12, aimAngle - .08); event.preventDefault(); } if (event.key === 'ArrowRight') { aimAngle = Math.min(-.12, aimAngle + .08); event.preventDefault(); } if (event.key === ' ' || event.key === 'Enter') { fireBubble(); event.preventDefault(); } }); primaryAction.addEventListener('click', () => resetGame(gameState === 'clear')); saveAction.addEventListener('click', saveScore); window.addEventListener('resize', setCanvasSize); setCanvasSize(); resetGame(); requestAnimationFrame(frame);
