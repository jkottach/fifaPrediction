import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiService } from '../services/apiService';
import { useAuth } from '../hooks/useAuth';
import { GoogleLogin } from '@react-oauth/google';
import {
  consumePreventGoogleAutoselect,
  disableGoogleAutoSelect,
} from '../services/googleAuth';
import {
  fetchClientPrincipal,
  loginWithGoogle,
  needsProfileSetup,
  useAzureAuth,
} from '../services/swaAuth';
import AuthCard from '../components/AuthCard';
import { alertError, spinner } from '../theme';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, authReady, isLoggedIn, user } = useAuth();
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

  const [error, setError] = useState('');
  const [checkingSession, setCheckingSession] = useState(useAzureAuth);

  useEffect(() => {
    if (searchParams.get('signed_out') === '1' || consumePreventGoogleAutoselect()) {
      disableGoogleAutoSelect();
    }
  }, [searchParams]);

  useEffect(() => {
    if (!authReady) return;

    if (isLoggedIn && user) {
      navigate(needsProfileSetup(user) ? '/profile-setup' : '/dashboard', { replace: true });
      return;
    }

    if (!useAzureAuth) {
      setCheckingSession(false);
      return;
    }

    void (async () => {
      const principal = await fetchClientPrincipal();
      if (!principal) {
        setCheckingSession(false);
        return;
      }
      try {
        const response = await apiService.getProfile();
        login(response.data);
        navigate(
          needsProfileSetup(response.data) ? '/profile-setup' : '/dashboard',
          { replace: true }
        );
      } catch {
        setCheckingSession(false);
      }
    })();
  }, [authReady, isLoggedIn, user, login, navigate]);

  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) return;
    setError('');

    try {
      const response = await apiService.googleLogin(credentialResponse.credential);
      const token = response.data?.token;
      const profileUser = response.data?.user;

      if (!token || !profileUser) {
        setError('Sign-in succeeded but the server returned an invalid response.');
        return;
      }

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(profileUser));
      login(token, profileUser);

      navigate(needsProfileSetup(profileUser) ? '/profile-setup' : '/dashboard', {
        replace: true,
      });

      // Refresh full profile in background (non-blocking; avoids stale-cookie 401 on Azure).
      void apiService
        .getProfile()
        .then((profileCheck) => login(token, profileCheck.data))
        .catch(() => undefined);
    } catch (err: unknown) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      const data =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string; hint?: string } } }).response?.data
          : undefined;
      setError(
        [data?.error, data?.hint].filter(Boolean).join(' — ') || 'Google sign-in failed. Please try again.'
      );
    }
  };

  const handleAzureSignIn = () => {
    loginWithGoogle('/dashboard');
  };

  if (useAzureAuth && checkingSession) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className={spinner} />
        <p className="mt-4 text-sm font-medium text-slate-600">Checking sign-in…</p>
      </div>
    );
  }

  return (
    <AuthCard title="Sign in" subtitle="Use Google to join the prediction league">
      {error && <div className={alertError}>{error}</div>}

      <div className="flex flex-col items-center gap-4">
        {useAzureAuth ? (
          <button
            type="button"
            onClick={handleAzureSignIn}
            className="w-full flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-3 text-slate-800 font-semibold hover:bg-slate-50 transition min-h-[48px]"
          >
            <span className="text-lg" aria-hidden>
              G
            </span>
            Continue with Google
          </button>
        ) : googleClientId ? (
          <div className="w-full flex justify-center" aria-label="Google login button">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Google sign-in was unsuccessful. Please try again.')}
              theme="outline"
              text="continue_with"
              size="large"
              shape="pill"
              width="320"
              auto_select={false}
            />
          </div>
        ) : (
          <div className="w-full rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-sm text-amber-800">
            Google login is not configured. Set VITE_GOOGLE_CLIENT_ID in frontend env, or
            VITE_USE_AZURE_AUTH=true for Azure sign-in.
          </div>
        )}
      </div>
    </AuthCard>
  );
};

export default Login;
