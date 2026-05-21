export interface User {
  id: number | string;
  name: string;
}

export interface QuizItem {
  id: number | string;
  question: string;
  answer: string;
  winner: string | null | "";
  datetime: string | null | "";
  enable?: boolean | string;
  encryptionkey?: string;
}

export enum AppScreen {
  LOADING_USERS = "LOADING_USERS",
  LOGIN = "LOGIN",
  DASHBOARD = "DASHBOARD",
  LOADING_QUIZ = "LOADING_QUIZ",
  QUIZ = "QUIZ",
  RESULT = "RESULT",
}

export interface SubmitResult {
  isCorrect: boolean;
  isWinner: boolean; // Truly got response from Google sheets that we won
  hasBeenWon: boolean; // Already won by someone else
  errorMessage?: string;
}
