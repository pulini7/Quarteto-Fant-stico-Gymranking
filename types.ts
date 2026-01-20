export interface Comment {
  id: string;
  userId: string;
  text: string;
  timestamp: string;
}

export interface Notification {
  id: string;
  type: 'OVERTAKE';
  message: string;
  fromUserId: string;
  timestamp: string;
  read: boolean;
}

export interface CheckIn {
  id: string;
  date: string; // YYYY-MM-DD
  timestamp: string; // Full ISO
  photo: string; // Base64 proof
  videos?: string[]; // Array of Base64 strings for videos
  likes: string[]; // Array of User IDs
  comments?: Comment[]; // Array of comments
  caption?: string; // Optional caption/phrase
}

export interface WeeklyPlan {
  [key: string]: string; // "Domingo": "Descanso", "Segunda": "Peito", etc.
}

export interface User {
  id: string;
  name: string;
  avatarSeed: number; // Used for picsum
  customAvatar?: string; // Base64 string for custom or AI generated avatar
  checkIns: CheckIn[]; 
  streak: number;
  score: number; // XP System
  password?: string; // Simple authentication
  notifications?: Notification[]; // For provocations
  isAdmin?: boolean; // Admin privilege flag
  weeklyPlan?: WeeklyPlan; // New field for weekly planning
}

export interface UserStats {
  totalCheckIns: number;
  currentStreak: number;
  lastCheckIn: string | null;
  rank: number;
}

export enum Tab {
  DASHBOARD = 'DASHBOARD',
  FEED = 'FEED',
  LEADERBOARD = 'LEADERBOARD',
  COACH = 'COACH'
}