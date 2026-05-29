export interface User {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'user' | 'admin';
  city: string;
  state: string;
  country: string;
  phoneNumber?: string;
  status: 'active' | 'inactive' | 'suspended';
  isActive: boolean;
  createdAt?: string;
}

export interface TeamInfo {
  teamName: string;
  countryLogo?: string | null;
}

export interface Team {
  teamId: string;
  teamName: string;
  countryLogo?: string | null;
}

export interface Match {
  _id?: string;
  matchId: string;
  sequence: number;
  team1: string;
  team2: string;
  team1Score?: number;
  team2Score?: number;
  matchTime: string;
  predictionsEndingTime: string;
  round: string;
  group?: string;
  comment?: string;
  matchTag: string;
  status: 'scheduled' | 'ongoing' | 'completed';
  team1Info?: TeamInfo | null;
  team2Info?: TeamInfo | null;
}

export interface TournamentTeamPick {
  teamId: string;
  teamName: string;
  countryLogo?: string | null;
}

export interface GroupStageGroupInfo {
  group: string;
  teams: TournamentTeamPick[];
}

export interface GroupChampionPick {
  group: string;
  teamId: string;
  teamName: string;
  countryLogo?: string | null;
}

export interface TournamentPrediction {
  champion: TournamentTeamPick;
  finalists: TournamentTeamPick[];
  semifinalists: TournamentTeamPick[];
  groupChampions?: GroupChampionPick[];
  points?: number;
  submittedTime?: string;
  updatedAt?: string;
}

export interface Prediction {
  _id?: string;
  userId: string;
  matchId: string | Match;
  matchTag: string;
  team1Score: number;
  team2Score: number;
  submittedTime: string;
  points: number;
  comment?: string;
  historicRank?: {
    finalRank: number;
    dailyRank: number;
  } | null;
}

export interface LeaderboardEntry {
  rank: number;
  totalPoints: number;
  name: string;
  state: string;
  userId: string;
  email: string;
}

export interface AuthState {
  token: string | null;
  user: User | null;
  isLoggedIn: boolean;
  authReady: boolean;
  login: (tokenOrUser: string | User, maybeUser?: User) => void;
  logout: () => void;
  setUser: (user: User) => void;
  initialize: () => Promise<void>;
}
