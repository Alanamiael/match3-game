import "./style.scss";

const CONFIG = {
  gridSize: 8,
  cellSize: 50,
  animationDuration: 500,
  disappearDelay: 300,
  fillDelay: 300,
  counterAnimationDuration: 200,
  imagePaths: [
    "/images/blue-bird.avif",
    "/images/green-clover.avif",
    "/images/purple-flower.png",
    "/images/red-heart.avif",
    "/images/yellow-star.jpg",
  ],
};

interface Cell {
  type: number;
  fallingY: number;
}

interface Position {
  row: number;
  col: number;
}

type GameState = "Idle" | "Selecting" | "Swapping";

class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private board: Cell[][];
  private images: HTMLImageElement[];
  private state: GameState = "Idle";
  private selectedCell: Position | null = null;
  private isAnimating: boolean = false;
  private matchCounters: Record<number, number>;
  private counterOpacities: Record<number, number>;
  private counterAnimationStart: Record<number, number>;

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d")!;
    this.canvas.width = CONFIG.gridSize * CONFIG.cellSize + 200;
    this.canvas.height = CONFIG.gridSize * CONFIG.cellSize;
    this.board = [];
    this.images = CONFIG.imagePaths.map((src) => {
      const img = new Image();
      img.src = src;
      return img;
    });
    this.matchCounters = Object.fromEntries(
      CONFIG.imagePaths.map((_, i) => [i, 0])
    );
    this.counterOpacities = Object.fromEntries(
      CONFIG.imagePaths.map((_, i) => [i, 1])
    );
    this.counterAnimationStart = Object.fromEntries(
      CONFIG.imagePaths.map((_, i) => [i, 0])
    );

    Promise.all(
      this.images.map(
        (img) =>
          new Promise((resolve) => {
            img.onload = resolve;
          })
      )
    )
      .then(() => {
        this.initBoard();
        this.animateFall(() => {
          this.isAnimating = false;
          this.drawBoard();
        });
      })
      .catch((err) => console.error("Image load error:", err));

    this.canvas.addEventListener("click", this.handleClick.bind(this));
  }

  private saveCounters(): void {
    localStorage.setItem("matchCounters", JSON.stringify(this.matchCounters));
  }

  private getRandomType(): number {
    return Math.floor(Math.random() * CONFIG.imagePaths.length);
  }

  private initBoard(): void {
    this.board = Array.from({ length: CONFIG.gridSize }, () =>
      Array.from({ length: CONFIG.gridSize }, () => ({
        type: this.getRandomType(),
        fallingY: 0,
      }))
    );
    for (let row = 0; row < CONFIG.gridSize; row++) {
      for (let col = 0; col < CONFIG.gridSize; col++) {
        while (this.hasMatchAt(row, col)) {
          this.board[row][col].type = this.getRandomType();
        }
      }
    }
  }

  private getCellFromClick(event: MouseEvent): Position | null {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const col = Math.floor(x / CONFIG.cellSize);
    const row = Math.floor(y / CONFIG.cellSize);
    if (
      row >= 0 &&
      row < CONFIG.gridSize &&
      col >= 0 &&
      col < CONFIG.gridSize &&
      this.board[row][col].type !== -1
    ) {
      return { row, col };
    }
    return null;
  }

  private isAdjacent(a: Position, b: Position): boolean {
    const rowDiff = Math.abs(a.row - b.row);
    const colDiff = Math.abs(a.col - b.col);
    return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
  }

  private swapCells(a: Position, b: Position): void {
    const temp = this.board[a.row][a.col].type;
    this.board[a.row][a.col].type = this.board[b.row][b.col].type;
    this.board[b.row][b.col].type = temp;
  }

  private countMatching(
    row: number,
    col: number,
    dx: number,
    dy: number
  ): number {
    const type = this.board[row][col].type;
    let count = 1;
    for (let dir = -1; dir <= 1; dir += 2) {
      let r = row + dir * dy;
      let c = col + dir * dx;
      while (
        r >= 0 &&
        r < CONFIG.gridSize &&
        c >= 0 &&
        c < CONFIG.gridSize &&
        this.board[r][c].type === type
      ) {
        count++;
        r += dir * dy;
        c += dir * dx;
      }
    }
    return count;
  }

  private hasMatchAt(row: number, col: number): boolean {
    if (this.board[row][col].type === -1) return false;
    return (
      this.countMatching(row, col, 1, 0) >= 3 ||
      this.countMatching(row, col, 0, 1) >= 3
    );
  }

  private getMatchedCells(): Position[] {
    const matched: Set<string> = new Set();
    for (let row = 0; row < CONFIG.gridSize; row++) {
      let count = 1;
      let startCol = 0;
      for (let col = 1; col <= CONFIG.gridSize; col++) {
        if (
          col < CONFIG.gridSize &&
          this.board[row][col].type === this.board[row][col - 1].type &&
          this.board[row][col].type !== -1
        ) {
          count++;
        } else {
          if (count >= 3) {
            for (let k = 0; k < count; k++) {
              matched.add(`${row},${startCol + k}`);
            }
          }
          count = 1;
          startCol = col;
        }
      }
    }

    for (let col = 0; col < CONFIG.gridSize; col++) {
      let count = 1;
      let startRow = 0;
      for (let row = 1; row <= CONFIG.gridSize; row++) {
        if (
          row < CONFIG.gridSize &&
          this.board[row][col].type === this.board[row - 1][col].type &&
          this.board[row][col].type !== -1
        ) {
          count++;
        } else {
          if (count >= 3) {
            for (let k = 0; k < count; k++) {
              matched.add(`${startRow + k},${col}`);
            }
          }
          count = 1;
          startRow = row;
        }
      }
    }
    return Array.from(matched).map((str) => {
      const [row, col] = str.split(",").map(Number);
      return { row, col };
    });
  }

  private fillEmptyCells(): void {
    for (let col = 0; col < CONFIG.gridSize; col++) {
      let pointer = CONFIG.gridSize - 1;
      for (let row = CONFIG.gridSize - 1; row >= 0; row--) {
        if (this.board[row][col].type !== -1) {
          this.board[pointer][col].type = this.board[row][col].type;
          this.board[pointer][col].fallingY = pointer;
          pointer--;
        }
      }
      for (let row = pointer; row >= 0; row--) {
        this.board[row][col].type = this.getRandomType();
        this.board[row][col].fallingY = -1;
      }
    }
  }

  private processMatches(): void {
    this.isAnimating = true;
    const matched = this.getMatchedCells();
    if (matched.length === 0) {
      this.isAnimating = false;
      this.drawBoard();
      return;
    }

    matched.forEach(({ row, col }) => {
      const type = this.board[row][col].type;
      if (type !== -1) {
        this.matchCounters[type]++;
        this.counterAnimationStart[type] = performance.now();
        this.counterOpacities[type] = 0;
        this.board[row][col].type = -1;
      }
    });
    this.saveCounters();
    this.drawBoard();

    setTimeout(() => {
      this.fillEmptyCells();
      this.animateFall(() => {
        this.drawBoard();
        setTimeout(() => this.processMatches(), CONFIG.fillDelay);
      });
    }, CONFIG.disappearDelay);
  }

  private animateFall(done: () => void): void {
    const start = performance.now();
    const animate = (time: number) => {
      const progress = Math.min((time - start) / CONFIG.animationDuration, 1);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      for (let row = 0; row < CONFIG.gridSize; row++) {
        for (let col = 0; col < CONFIG.gridSize; col++) {
          const type = this.board[row][col].type;
          const fallingY = this.board[row][col].fallingY;
          if (type !== -1) {
            const y =
              fallingY >= 0
                ? fallingY * CONFIG.cellSize +
                  (row - fallingY) * CONFIG.cellSize * progress
                : -CONFIG.cellSize + CONFIG.cellSize * row * progress;
            this.ctx.drawImage(
              this.images[type],
              col * CONFIG.cellSize,
              y,
              CONFIG.cellSize,
              CONFIG.cellSize
            );
          }
        }
      }
      this.drawCounters();
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        done();
      }
    };
    requestAnimationFrame(animate);
  }

  private animateSwap(
    a: Position,
    b: Position,
    forward: boolean,
    done: () => void
  ): void {
    const start = performance.now();
    const x1 = a.col * CONFIG.cellSize;
    const y1 = a.row * CONFIG.cellSize;
    const x2 = b.col * CONFIG.cellSize;
    const y2 = b.row * CONFIG.cellSize;
    const t1 = this.board[a.row][a.col].type;
    const t2 = this.board[b.row][b.col].type;

    const animate = (time: number) => {
      if (!this.isAnimating) return;
      const progress = Math.min((time - start) / CONFIG.animationDuration, 1);
      const t = forward ? progress : 1 - progress;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.drawBoard();
      if (t1 !== -1) {
        this.ctx.drawImage(
          this.images[t1],
          x1 + (x2 - x1) * t,
          y1 + (y2 - y1) * t,
          CONFIG.cellSize,
          CONFIG.cellSize
        );
      }
      if (t2 !== -1) {
        this.ctx.drawImage(
          this.images[t2],
          x2 + (x1 - x2) * t,
          y2 + (y1 - y2) * t,
          CONFIG.cellSize,
          CONFIG.cellSize
        );
      }
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.isAnimating = false;
        done();
      }
    };
    this.isAnimating = true;
    requestAnimationFrame(animate);
  }

  private drawCounters(): void {
    this.ctx.fillStyle = "black";
    this.ctx.font = "16px Arial";
    this.ctx.textAlign = "left";
    this.ctx.textBaseline = "top";

    CONFIG.imagePaths.forEach((_, index) => {
      const x = CONFIG.gridSize * CONFIG.cellSize + 10;
      const y = index * (CONFIG.cellSize + 10);
      this.ctx.drawImage(
        this.images[index],
        x,
        y,
        CONFIG.cellSize,
        CONFIG.cellSize
      );
      const time = performance.now();
      const progress = Math.min(
        (time - this.counterAnimationStart[index]) /
          CONFIG.counterAnimationDuration,
        1
      );
      this.counterOpacities[index] = progress;
      this.ctx.globalAlpha = this.counterOpacities[index];
      this.ctx.fillText(
        this.matchCounters[index].toString(),
        x + CONFIG.cellSize + 10,
        y + 10
      );
      this.ctx.globalAlpha = 1;
    });
  }

  private drawBoard(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (let row = 0; row < CONFIG.gridSize; row++) {
      for (let col = 0; col < CONFIG.gridSize; col++) {
        const type = this.board[row][col].type;
        if (type !== -1) {
          this.ctx.drawImage(
            this.images[type],
            col * CONFIG.cellSize,
            row * CONFIG.cellSize,
            CONFIG.cellSize,
            CONFIG.cellSize
          );
        }
      }
    }
    if (this.state === "Selecting" && this.selectedCell) {
      this.ctx.strokeStyle = "yellow";
      this.ctx.lineWidth = 4;
      this.ctx.strokeRect(
        this.selectedCell.col * CONFIG.cellSize,
        this.selectedCell.row * CONFIG.cellSize,
        CONFIG.cellSize,
        CONFIG.cellSize
      );
    }
    this.drawCounters();
  }

  private handleClick(event: MouseEvent): void {
    if (this.isAnimating) return;
    const cell = this.getCellFromClick(event);
    if (!cell) return;

    if (!this.selectedCell) {
      this.selectedCell = cell;
      this.state = "Selecting";
      this.drawBoard();
      return;
    }

    switch (true) {
      case this.selectedCell.row === cell.row &&
        this.selectedCell.col === cell.col:
        this.selectedCell = null;
        this.state = "Idle";
        this.drawBoard();
        break;
      case this.isAdjacent(this.selectedCell, cell):
        const first = this.selectedCell;
        this.state = "Swapping";
        this.animateSwap(first, cell, true, () => {
          this.swapCells(first, cell);
          if (!this.getMatchedCells().length) {
            this.animateSwap(first, cell, false, () => {
              this.swapCells(first, cell);
              this.drawBoard();
              this.selectedCell = null;
              this.state = "Idle";
            });
          } else {
            this.processMatches();
            this.selectedCell = null;
            this.state = "Idle";
          }
        });
        break;
      default:
        this.selectedCell = cell;
        this.state = "Selecting";
        this.drawBoard();
        break;
    }
  }
}

new Game("gameCanvas");
