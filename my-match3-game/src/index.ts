import "./style.scss";

const canvas = document.getElementById("gameCanvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

const CONFIG = {
  gridSize: 8,
  cellSize: 50,
  animationDuration: 500,
  disappearDelay: 300,
  fillDelay: 300,
  imagePaths: [
    "/images/blue-bird.avif",
    "/images/green-clover.avif",
    "/images/purple-flower.png",
    "/images/red-heart.avif",
    "/images/yellow-star.jpg",
  ],
};

const imageObjects: HTMLImageElement[] = CONFIG.imagePaths.map((src) => {
  const img = new Image();
  img.src = src;
  return img;
});

interface Cell {
  type: number;
  fallingY: number;
}

let board: Cell[][] = [];
let selectedCell: { row: number; col: number } | null = null;
let isAnimating = false;

const getRandomType = () =>
  Math.floor(Math.random() * CONFIG.imagePaths.length);

function getCellFromClick(
  event: MouseEvent
): { row: number; col: number } | null {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const col = Math.floor(x / CONFIG.cellSize);
  const row = Math.floor(y / CONFIG.cellSize);
  if (row >= 0 && row < CONFIG.gridSize && col >= 0 && col < CONFIG.gridSize) {
    return { row, col };
  }
  return null;
}

const isAdjacent = (
  a: { row: number; col: number },
  b: { row: number; col: number }
) => {
  const rowDiff = Math.abs(a.row - b.row);
  const colDiff = Math.abs(a.col - b.col);
  return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
};

const swapCells = (
  a: { row: number; col: number },
  b: { row: number; col: number }
) => {
  const temp = board[a.row][a.col].type;
  board[a.row][a.col].type = board[b.row][b.col].type;
  board[b.row][b.col].type = temp;
};

function countMatching(
  row: number,
  col: number,
  dx: number,
  dy: number
): number {
  const type = board[row][col].type;
  let count = 1;
  for (let dir = -1; dir <= 1; dir += 2) {
    let r = row + dir * dy;
    let c = col + dir * dx;
    while (
      r >= 0 &&
      r < CONFIG.gridSize &&
      c >= 0 &&
      c < CONFIG.gridSize &&
      board[r][c].type === type
    ) {
      count++;
      r += dir * dy;
      c += dir * dx;
    }
  }
  return count;
}

function hasMatchAt(row: number, col: number): boolean {
  if (board[row][col].type === -1) return false;
  return (
    countMatching(row, col, 1, 0) >= 3 || countMatching(row, col, 0, 1) >= 3
  );
}

function getMatchedCells(): { row: number; col: number }[] {
  const matched: Set<string> = new Set();

  for (let row = 0; row < CONFIG.gridSize; row++) {
    let count = 1;
    for (let col = 1; col <= CONFIG.gridSize; col++) {
      if (
        col < CONFIG.gridSize &&
        board[row][col].type === board[row][col - 1].type &&
        board[row][col].type !== -1
      ) {
        count++;
      } else {
        if (count >= 3) {
          for (let k = 0; k < count; k++) {
            matched.add(`${row},${col - 1 - k}`);
          }
        }
        count = 1;
      }
    }
  }

  for (let col = 0; col < CONFIG.gridSize; col++) {
    let count = 1;
    for (let row = 1; row <= CONFIG.gridSize; row++) {
      if (
        row < CONFIG.gridSize &&
        board[row][col].type === board[row - 1][col].type &&
        board[row][col].type !== -1
      ) {
        count++;
      } else {
        if (count >= 3) {
          for (let k = 0; k < count; k++) {
            matched.add(`${row - 1 - k},${col}`);
          }
        }
        count = 1;
      }
    }
  }

  return Array.from(matched).map((str) => {
    const [r, c] = str.split(",").map(Number);
    return { row: r, col: c };
  });
}

function fillEmptyCells() {
  for (let col = 0; col < CONFIG.gridSize; col++) {
    let pointer = CONFIG.gridSize - 1;

    for (let row = CONFIG.gridSize - 1; row >= 0; row--) {
      if (board[row][col].type !== -1) {
        board[pointer][col].type = board[row][col].type;
        board[pointer][col].fallingY = pointer;
        pointer--;
      }
    }

    for (let row = pointer; row >= 0; row--) {
      board[row][col].type = getRandomType();
      board[row][col].fallingY = -1;
    }
  }
}

function processMatches() {
  isAnimating = true;
  const matched = getMatchedCells();
  if (matched.length === 0) {
    isAnimating = false;
    drawBoard();
    return;
  }
  matched.forEach(({ row, col }) => (board[row][col].type = -1));
  drawBoard();

  setTimeout(() => {
    fillEmptyCells();
    animateFall(() => {
      drawBoard();
      setTimeout(() => {
        processMatches();
      }, CONFIG.fillDelay);
    });
  }, CONFIG.disappearDelay);
}

function animateFall(done: () => void) {
  const start = performance.now();
  function animate(time: number) {
    const progress = Math.min((time - start) / CONFIG.animationDuration, 1);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let row = 0; row < CONFIG.gridSize; row++) {
      for (let col = 0; col < CONFIG.gridSize; col++) {
        const type = board[row][col].type;
        const fallingY = board[row][col].fallingY;
        if (type !== -1) {
          const y =
            fallingY >= 0
              ? fallingY * CONFIG.cellSize +
                (row - fallingY) * CONFIG.cellSize * progress
              : -CONFIG.cellSize + CONFIG.cellSize * row * progress;
          ctx.drawImage(
            imageObjects[type],
            col * CONFIG.cellSize,
            y,
            CONFIG.cellSize,
            CONFIG.cellSize
          );
        }
      }
    }
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      done();
    }
  }
  requestAnimationFrame(animate);
}

function animateSwap(
  a: { row: number; col: number },
  b: { row: number; col: number },
  forward: boolean,
  done: () => void
) {
  const start = performance.now();
  const x1 = a.col * CONFIG.cellSize;
  const y1 = a.row * CONFIG.cellSize;
  const x2 = b.col * CONFIG.cellSize;
  const y2 = b.row * CONFIG.cellSize;
  const t1 = board[a.row][a.col].type;
  const t2 = board[b.row][b.col].type;

  function animate(time: number) {
    const progress = Math.min((time - start) / CONFIG.animationDuration, 1);
    const t = forward ? progress : 1 - progress;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBoard();
    if (t1 !== -1)
      ctx.drawImage(
        imageObjects[t1],
        x1 + (x2 - x1) * t,
        y1 + (y2 - y1) * t,
        CONFIG.cellSize,
        CONFIG.cellSize
      );
    if (t2 !== -1)
      ctx.drawImage(
        imageObjects[t2],
        x2 + (x1 - x2) * t,
        y2 + (y1 - y2) * t,
        CONFIG.cellSize,
        CONFIG.cellSize
      );
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      isAnimating = false;
      done();
    }
  }

  isAnimating = true;
  requestAnimationFrame(animate);
}

function initBoard() {
  board = Array.from({ length: CONFIG.gridSize }, () =>
    Array.from({ length: CONFIG.gridSize }, () => ({
      type: getRandomType(),
      fallingY: 0,
    }))
  );
  for (let row = 0; row < CONFIG.gridSize; row++) {
    for (let col = 0; col < CONFIG.gridSize; col++) {
      while (hasMatchAt(row, col)) {
        board[row][col].type = getRandomType();
      }
    }
  }
}

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let row = 0; row < CONFIG.gridSize; row++) {
    for (let col = 0; col < CONFIG.gridSize; col++) {
      const type = board[row][col].type;
      if (type !== -1) {
        ctx.drawImage(
          imageObjects[type],
          col * CONFIG.cellSize,
          row * CONFIG.cellSize,
          CONFIG.cellSize,
          CONFIG.cellSize
        );
      }
    }
  }
  if (selectedCell) {
    ctx.strokeStyle = "yellow";
    ctx.lineWidth = 4;
    ctx.strokeRect(
      selectedCell.col * CONFIG.cellSize,
      selectedCell.row * CONFIG.cellSize,
      CONFIG.cellSize,
      CONFIG.cellSize
    );
  }
}

function handleClick(cell: { row: number; col: number }) {
  if (!selectedCell) {
    selectedCell = cell;
    drawBoard();
    return;
  }

  switch (true) {
    case selectedCell.row === cell.row && selectedCell.col === cell.col:
      selectedCell = null;
      drawBoard();
      break;
    case isAdjacent(selectedCell, cell):
      const first = selectedCell;
      animateSwap(first, cell, true, () => {
        swapCells(first, cell);
        if (!getMatchedCells().length) {
          animateSwap(first, cell, false, () => {
            swapCells(first, cell);
            drawBoard();
            selectedCell = null;
          });
        } else {
          processMatches();
          selectedCell = null;
        }
      });
      break;
    default:
      selectedCell = cell;
      drawBoard();
      break;
  }
}

canvas.addEventListener("click", (event) => {
  if (isAnimating) return;
  const cell = getCellFromClick(event);
  if (!cell || board[cell.row][cell.col].type === -1) return;
  handleClick(cell);
});

Promise.all(imageObjects.map((img) => new Promise((res) => (img.onload = res))))
  .then(() => {
    initBoard();
    animateFall(() => {
      isAnimating = false;
      drawBoard();
    });
  })
  .catch((err) => console.error("Image load error:", err));
