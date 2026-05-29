import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../context/authStore';
import { useAzureAuth } from './swaAuth';

/** SWA production uses same-origin `/api`; local dev uses Vite proxy. */
const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? '/api' : '/api');

type AuthRequestConfig = InternalAxiosRequestConfig & {
  /** If true, a 401 will not clear storage or sign the user out. */
  skipAuthRedirect?: boolean;
};

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
    });

    this.client.interceptors.request.use((config) => {
      if (!useAzureAuth) {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
          // SWA can drop Authorization; duplicate on a custom header.
          config.headers['X-Access-Token'] = token;
        }
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        const config = error.config as AuthRequestConfig | undefined;
        const hadToken = Boolean(
          config?.headers?.Authorization || config?.headers?.['X-Access-Token']
        );
        const skipRedirect = config?.skipAuthRedirect === true;
        const url = String(config?.url ?? '');

        if (error.response?.status === 401 && !skipRedirect && !url.includes('/auth/google')) {
          if (hadToken) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            useAuthStore.setState({
              token: null,
              user: null,
              isLoggedIn: false,
              authReady: true,
            });
          }
        }
        return Promise.reject(error);
      }
    );
  }

  register(data: Record<string, unknown>) {
    return this.client.post('/auth/register', data);
  }

  googleLogin(credential: string) {
    return this.client.post('/auth/google', { credential });
  }

  logout() {
    return this.client.post('/auth/logout');
  }

  getProfile() {
    return this.client.get('/auth/profile', { skipAuthRedirect: true } as AuthRequestConfig);
  }

  updateProfile(data: Record<string, unknown>) {
    return this.client.put('/auth/profile', data);
  }

  getAllMatches(status?: string, page?: number, limit?: number) {
    return this.client.get('/matches', {
      params: { status, page, limit },
    });
  }

  getMatch(matchId: string) {
    return this.client.get(`/matches/${matchId}`);
  }

  getTeams() {
    return this.client.get('/matches/teams');
  }

  getTournamentPrediction() {
    return this.client.get('/tournament-predictions');
  }

  submitTournamentPrediction(data: {
    champion: string;
    finalists: [string, string];
    semifinalists: [string, string, string, string];
    groupChampions?: Record<string, string>;
  }) {
    return this.client.post('/tournament-predictions', data);
  }

  submitPrediction(data: Record<string, unknown>) {
    return this.client.post('/predictions', data);
  }

  getUserPredictions(page?: number, limit?: number) {
    return this.client.get('/predictions', {
      params: { page, limit },
    });
  }

  getUserPredictionsFromResults(page?: number, limit?: number) {
    return this.client.get('/predictions/results/list', {
      params: { page, limit },
    });
  }

  updatePrediction(predictionId: string, data: Record<string, unknown>) {
    return this.client.put(`/predictions/${predictionId}`, data);
  }

  deletePrediction(predictionId: string) {
    return this.client.delete(`/predictions/${predictionId}`);
  }

  getTopLeaderboard(limit?: number) {
    return this.client.get('/leaderboard/top', { params: { limit } });
  }

  getUserStats() {
    return this.client.get('/leaderboard/stats');
  }
}

export const apiService = new ApiService();
