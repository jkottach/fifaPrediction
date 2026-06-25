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
  penaltyWinner?: string | null;
  cumulativeTotalPoints?: number;
  totalPoints?: number;
  overallRank?: number | null;
  previousOverallRank?: number | null;
  historicRank?: {
    finalRank: number;
    dailyRank: number;
  } | null;
}

export interface LeaderboardEntry {
  rank: number;
  rankTrend?: 'up' | 'down' | 'unchanged' | null;
  totalPoints: number;
  name: string;
  state: string;
  userId: string;
  email: string;
}

export interface MatchEarnerEntry {
  rank: number;
  userId: string;
  name: string;
  points: number;
  team1Score: number;
  team2Score: number;
}

export interface MatchSlotEarners {
  match: Match;
  earners: MatchEarnerEntry[];
}

export interface LiveMatchPredictionEntry {
  userId: string;
  name: string;
  team1Score: number;
  team2Score: number;
  submittedTime: string;
  comment?: string | null;
  penaltyWinner?: string | null;
}

export interface LiveMatchPredictionsGroup {
  match: Match;
  predictions: LiveMatchPredictionEntry[];
}

export interface CommunityTeamCount {
  teamId: string;
  teamName: string;
  countryLogo?: string | null;
  count: number;
  pct?: number;
}

export interface CommunityTournamentConsensus {
  champion: CommunityTeamCount[];
  groupChampions: Record<string, CommunityTeamCount[]>;
  semifinalists: CommunityTeamCount[];
  finalists: CommunityTeamCount[];
}

export interface CommunityTournamentPick {
  userId: string;
  name: string;
  champion: TournamentTeamPick;
  finalists: TournamentTeamPick[];
  semifinalists: TournamentTeamPick[];
  groupChampions?: GroupChampionPick[];
  points: number;
  submittedTime: string;
}

export interface CommunityTournamentPredictionsResponse {
  unlocksAt: string;
  submittedCount: number;
  officialGroupChampions: Record<string, string>;
  consensus: CommunityTournamentConsensus;
  picks: CommunityTournamentPick[];
}

export interface CommunityTournamentLockedResponse {
  error: string;
  unlocksAt: string;
  submittedCount: number;
  officialGroupChampions: Record<string, string>;
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
