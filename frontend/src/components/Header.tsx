import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { apiService } from '../services/apiService';
import { useAzureAuth } from '../services/swaAuth';
import { HERO_BG } from '../theme';

const Header: React.FC = () => {
  const { isLoggedIn, user, logout, setUser } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const didRefreshProfile = useRef(false);

  useEffect(() => {
    if (!isLoggedIn || didRefreshProfile.current) return;

    didRefreshProfile.current = true;
    apiService
      .getProfile()
      .then((res) => setUser(res.data))
      .catch(() => undefined);
  }, [isLoggedIn, setUser]);

  const closeMenu = () => setMenuOpen(false);

  const navLinkClass =
    'block py-3 px-1 text-base font-medium text-white/90 hover:text-emerald-300 transition min-h-[44px] flex items-center';

  const handleLogout = () => {
    closeMenu();
    logout();
    if (!useAzureAuth) {
      window.location.replace('/login?signed_out=1');
    }
  };

  return (
    <header
      className="sticky top-0 z-40 text-white shadow-lg"
      style={{ background: HERO_BG }}
    >
      <nav className="px-4 py-3">
        <div className="flex justify-between items-center gap-2">
          <Link to="/" className="flex items-center gap-2 min-w-0" onClick={closeMenu}>
            <h1 className="font-display text-base font-bold truncate">🏆 FCC Worldcup 26</h1>
          </Link>

          <div className="flex items-center gap-2 shrink-0">
            {!isLoggedIn && (
              <Link
                to="/login"
                className="px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-600 transition min-h-[44px] flex items-center"
              >
                Login
              </Link>
            )}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2.5 rounded-lg hover:bg-white/10 transition min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="mt-3 pt-3 border-t border-white/15">
            <Link to="/" className={navLinkClass} onClick={closeMenu}>
              Home
            </Link>
            <Link to="/leaderboard" className={navLinkClass} onClick={closeMenu}>
              Leaderboard
            </Link>

            {isLoggedIn ? (
              <>
                <Link to="/dashboard" className={navLinkClass} onClick={closeMenu}>
                  Dashboard
                </Link>
                <Link to="/my-predictions" className={navLinkClass} onClick={closeMenu}>
                  My Predictions
                </Link>
                <Link to="/profile" className={navLinkClass} onClick={closeMenu}>
                  My Profile
                </Link>
                <div className="pt-3 mt-2 border-t border-white/15">
                  <p className="text-sm font-bold px-1 mb-2 text-white">Hi, {user?.firstName}</p>
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-3 bg-red-600/90 rounded-xl hover:bg-red-600 transition font-semibold min-h-[44px]"
                  >
                    Logout
                  </button>
                </div>
              </>
            ) : null}
          </div>
        )}
      </nav>
    </header>
  );
};

export default Header;
