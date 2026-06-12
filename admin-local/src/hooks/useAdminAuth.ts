import { useCallback, useEffect, useState } from 'react';
import {
  clearAuthToken,
  getAuthToken,
  restoreAuthToken,
  setAuthToken,
  verifySession,
} from '../api';

export function useAdminAuth() {
  const [authReady, setAuthReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    void (async () => {
      restoreAuthToken();
      const token = getAuthToken();
      if (!token) {
        setIsAuthenticated(false);
        setAuthReady(true);
        return;
      }

      try {
        await verifySession();
        setIsAuthenticated(true);
      } catch {
        clearAuthToken();
        setIsAuthenticated(false);
      } finally {
        setAuthReady(true);
      }
    })();
  }, []);

  const login = useCallback((token: string) => {
    setAuthToken(token);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    clearAuthToken();
    setIsAuthenticated(false);
  }, []);

  return { authReady, isAuthenticated, login, logout };
}
