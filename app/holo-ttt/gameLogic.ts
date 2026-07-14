export type Cell = "X" | "O" | null;
export type Board = Cell[];
export type Winner = "X" | "O" | "draw" | null;

export const EMPTY_BOARD: Board = Array(9).fill(null);

const LINES: number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function getWinner(board: Board): Winner {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  if (board.every((c) => c != null)) return "draw";
  return null;
}

export function winningLine(board: Board): number[] | null {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return line;
  }
  return null;
}

export function placeMove(board: Board, index: number, mark: "X" | "O"): Board | null {
  if (index < 0 || index > 8 || board[index] != null || getWinner(board)) return null;
  const next = board.slice() as Board;
  next[index] = mark;
  return next;
}

function scoreBoard(board: Board, ai: "X" | "O", depth: number): number {
  const w = getWinner(board);
  const human = ai === "X" ? "O" : "X";
  if (w === ai) return 10 - depth;
  if (w === human) return depth - 10;
  return 0;
}

function minimax(
  board: Board,
  ai: "X" | "O",
  current: "X" | "O",
  depth: number
): { score: number; index: number } {
  const winner = getWinner(board);
  if (winner) return { score: scoreBoard(board, ai, depth), index: -1 };

  let bestIndex = -1;
  let bestScore = current === ai ? -Infinity : Infinity;

  for (let i = 0; i < 9; i++) {
    if (board[i] != null) continue;
    const next = board.slice() as Board;
    next[i] = current;
    const { score } = minimax(next, ai, current === "X" ? "O" : "X", depth + 1);
    if (current === ai) {
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    } else if (score < bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  if (bestIndex < 0) return { score: 0, index: -1 };
  return { score: bestScore, index: bestIndex };
}

/** Best move for the AI mark. Prefers center/corners on empty board. */
export function bestAiMove(board: Board, ai: "X" | "O" = "O"): number {
  if (board.every((c) => c == null)) return 4;
  const { index } = minimax(board, ai, ai, 0);
  if (index >= 0) return index;
  return board.findIndex((c) => c == null);
}
