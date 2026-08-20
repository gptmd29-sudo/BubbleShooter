const ROWS = 8;
const COLS = 6;
const TARGET_SUM = 10;
const POINTS_PER_APPLE = 2;

const boardElement = document.querySelector('#board');
const scoreElement = document.querySelector('#score');
const selectedSumElement = document.querySelector('#selected-sum');
const selectionLabelElement = document.querySelector('#selection-label');
const statusElement = document.querySelector('#status-message');
const moveCountElement = document.querySelector('#move-count');
const restartButton = document.querySelector('#restart-button');

let board = [];
let score = 0;
let moveCount = 0;
let selectedCells = [];
let selectedSum = 0;
let isDragging = false;
let isAnimating = false;

function createApple() {
  return Math.floor(Math.random() * 9) + 1;
}

function createBoard() {
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, createApple));
}

function cellKey(row, col) {
  return `${row}-${col}`;
}

function isSelected(row, col) {
  return selectedCells.some((cell) => cell.row === row && cell.col === col);
}

function renderBoard({ animateNew = false } = {}) {
  boardElement.innerHTML = '';
  board.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      const apple = document.createElement('button');
      apple.type = 'button';
      apple.className = 'apple';
      if (animateNew && rowIndex < 2) apple.classList.add('new-apple');
      if (isSelected(rowIndex, colIndex)) apple.classList.add('selected');
      apple.dataset.row = rowIndex;
      apple.dataset.col = colIndex;
      apple.dataset.key = cellKey(rowIndex, colIndex);
      apple.textContent = value;
      apple.setAttribute('role', 'gridcell');
      apple.setAttribute('aria-label', `${rowIndex + 1}행 ${colIndex + 1}열, 숫자 ${value}`);
      boardElement.appendChild(apple);
    });
  });
}

function updateHud(message = '인접한 사과를 드래그하세요') {
  scoreElement.textContent = score;
  selectedSumElement.textContent = selectedSum;
  moveCountElement.textContent = moveCount;
  selectionLabelElement.textContent = selectedCells.length ? `${selectedCells.length}개 선택됨` : '사과를 선택해보세요';
  statusElement.textContent = message;
}

function isAdjacent(firstCell, secondCell) {
  return Math.abs(firstCell.row - secondCell.row) <= 1 && Math.abs(firstCell.col - secondCell.col) <= 1 && !(firstCell.row === secondCell.row && firstCell.col === secondCell.col);
}

function getCellFromTarget(target) {
  const apple = target.closest('.apple');
  if (!apple || !boardElement.contains(apple)) return null;
  return { row: Number(apple.dataset.row), col: Number(apple.dataset.col) };
}

function clearSelection(message = '선택이 취소됐어요') {
  selectedCells = [];
  selectedSum = 0;
  isDragging = false;
  renderBoard();
  updateHud(message);
}

function selectCell(cell) {
  if (!cell || !isDragging || isAnimating || isSelected(cell.row, cell.col)) return;
  const previousCell = selectedCells[selectedCells.length - 1];
  if (previousCell && !isAdjacent(previousCell, cell)) return;

  selectedCells.push(cell);
  selectedSum += board[cell.row][cell.col];

  if (selectedSum > TARGET_SUM) {
    clearSelection('합이 10을 넘었어요. 다시 선택해보세요');
    return;
  }

  renderBoard();
  updateHud(selectedSum === TARGET_SUM ? '합이 10이에요! 손을 떼세요' : '계속 인접한 사과를 연결하세요');
}

function collapseColumns() {
  for (let col = 0; col < COLS; col += 1) {
    const remaining = [];
    for (let row = ROWS - 1; row >= 0; row -= 1) {
      if (board[row][col] !== null) remaining.push(board[row][col]);
    }
    for (let row = ROWS - 1; row >= 0; row -= 1) {
      board[row][col] = remaining[ROWS - 1 - row] ?? createApple();
    }
  }
}

function removeSelectedCells() {
  const removedCount = selectedCells.length;
  selectedCells.forEach(({ row, col }) => { board[row][col] = null; });
  score += removedCount * POINTS_PER_APPLE;
  moveCount += 1;
  selectedCells = [];
  selectedSum = 0;
  isAnimating = true;
  renderBoard();
  updateHud(`${removedCount}개의 사과를 제거했어요! +${removedCount * POINTS_PER_APPLE}점`);

  window.setTimeout(() => {
    collapseColumns();
    renderBoard({ animateNew: true });
    isAnimating = false;
    updateHud('인접한 사과를 드래그하세요');
  }, 340);
}

function finishSelection() {
  if (!isDragging) return;
  isDragging = false;
  if (selectedSum === TARGET_SUM) {
    removeSelectedCells();
  } else if (selectedCells.length) {
    clearSelection('합이 10이 아니에요. 다시 시도해보세요');
  }
}

function handlePointerDown(event) {
  if (isAnimating) return;
  const cell = getCellFromTarget(event.target);
  if (!cell) return;
  event.preventDefault();
  isDragging = true;
  selectedCells = [];
  selectedSum = 0;
  selectCell(cell);
}

function handlePointerMove(event) {
  if (!isDragging || isAnimating) return;
  const cell = getCellFromTarget(event.target);
  if (cell) selectCell(cell);
}

function resetGame() {
  score = 0;
  moveCount = 0;
  selectedCells = [];
  selectedSum = 0;
  isDragging = false;
  isAnimating = false;
  board = createBoard();
  renderBoard();
  updateHud('인접한 사과를 드래그하세요');
}

boardElement.addEventListener('pointerdown', handlePointerDown);
boardElement.addEventListener('pointermove', handlePointerMove);
boardElement.addEventListener('pointerup', finishSelection);
boardElement.addEventListener('pointercancel', finishSelection);
window.addEventListener('pointerup', finishSelection);
restartButton.addEventListener('click', resetGame);

resetGame();
