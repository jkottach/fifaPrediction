import { ObjectId } from 'mongodb';

export interface EmbeddedPrediction {
  matchId: string;
  matchTag: string;
  team1Score: number;
  team2Score: number;
  points: number;
  comment?: string | null;
  submittedTime: Date;
}

/** Group letter → winning nation `teamId` (e.g. `{ A: "MEX", B: "CAN" }`). */
export type GroupChampionsPicks = Record<string, string>;

/** Knockout bracket + group-stage picks stored on the user document. */
export interface TournamentBracketPrediction {
  champion: string;
  finalists: [string, string];
  semifinalists: [string, string, string, string];
  groupChampions?: GroupChampionsPicks;
  points?: number;
  submittedTime: Date;
  updatedAt: Date;
}

export interface GroupStageGroup {
  group: string;
  teamIds: string[];
}

/** Stored in the `users` collection (profile + embedded predictions + totalPoints). */
export interface UserDocument {
  _id: ObjectId;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string | null;
  city: string;
  state: string;
  country: string;
  comment?: string | null;
  googleId?: string | null;
  instagramId?: string | null;
  profileImage?: string | null;
  role: 'user' | 'admin';
  status: string;
  isActive: boolean;
  totalPoints: number;
  predictions: EmbeddedPrediction[];
  tournamentPrediction?: TournamentBracketPrediction | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Stored in the `teams` collection. */
export interface TeamDocument {
  _id: ObjectId;
  teamId: string;
  teamName: string;
  country: string;
  countryLogo?: string | null;
  coach?: string | null;
  foundedYear?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamInfoEmbed {
  teamName: string;
  countryLogo?: string | null;
}

/** Stored in the `matches` collection. */
export interface MatchDocument {
  _id: ObjectId;
  sequence: number;
  team1: string;
  team2: string;
  team1Info?: TeamInfoEmbed | null;
  team2Info?: TeamInfoEmbed | null;
  team1Score?: number | null;
  team2Score?: number | null;
  matchTime: Date;
  predictionsEndingTime: Date;
  round: string;
  group?: string | null;
  comment?: string | null;
  matchTag: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}
