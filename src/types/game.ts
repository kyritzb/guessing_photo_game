export enum GameState {
  LOBBY = "LOBBY",
  PLAYING = "PLAYING",
  RESULTS = "RESULTS",
  GAME_OVER = "GAME_OVER",
}

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  imageCount: number;
  score: number;
}

export interface Room {
  id: string;
  players: Player[];
  gameState: GameState;
  currentImageIndex: number;
  syncComplete: boolean;
}

export interface SyncProgress {
  progress: number;
  playerProgress: Array<{
    id: string;
    name: string;
    synced: number;
    total: number;
  }>;
}

export interface RoundResult {
  playerId: string;
  name: string;
  score: number;
  guessedCorrectly: boolean;
}

export interface GameOverData {
  winner: {
    id: string;
    name: string;
    score: number;
  };
  finalScores: Array<{
    id: string;
    name: string;
    score: number;
  }>;
}

