import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { getCurrentUser, destroySession } from '@/lib/customAuth';

const AuthContext = createContext();

// LB-031c Layer 2: how often to silently re-validate the session against the
// server. Bounds the worst-case window between a server-side lockdown
// (sign-out-everywhere or emergency-account-lockdown) and the user actually
// being kicked from an idle tab.
const SESSION_RECHECK_INTERVAL_MS = 60_000;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings] = useState(false);
  const [authError] = useState(null);

  // Ref so the visibility/interval handlers always see the current value
  // without re-binding on every state change.
  const wasAuthenticatedRef = useRef(false);

  useEffect(() => {
    initAuth();
  }, []);

  // LB-031c Layer 2: periodic + visibility-change session re-validation.
  // Idle tabs get a 60s backstop poll. Active tabs re-check the moment the
  // user returns. On any transition authenticated → unauthenticated we hard
  // redirect to /login so the dashboard tears down immediately.
  useEffect(() => {
    let cancelled = false;

    const recheck = async () => {
      if (cancelled) return;
      // Skip if we never had a session — nothing to re-validate.
      if (!localStorage.getItem('mio_session_token')) return;
      try {
        const currentUser = await getCurrentUser();
        if (cancelled) return;
        if (currentUser) {
          setUser(currentUser);
          setIsAuthenticated(true);
          wasAuthenticatedRef.current = true;
        } else {
          setUser(null);
          setIsAuthenticated(false);
          if (wasAuthenticatedRef.current) {
            wasAuthenticatedRef.current = false;
            // Hard redirect — guarantees React tree tears down so the
            // previously-rendered dashboard can't keep using stale data.
            const onPublicRoute = ['/login', '/forgot-password', '/reset-password', '/register', '/account-locked-down']
              .some((p) => window.location.pathname.startsWith(p));
            if (!onPublicRoute) window.location.href = '/login';
          }
        }
      } catch (_) {
        // Network blip — leave existing state in place; next tick will retry.
      }
    };

    const intervalId = setInterval(recheck, SESSION_RECHECK_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') recheck();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const initAuth = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        setIsAuthenticated(true);
        wasAuthenticatedRef.current = true;
      } else {
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error('Auth init error:', err);
      setIsAuthenticated(false);
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const refreshUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        setIsAuthenticated(true);
        wasAuthenticatedRef.current = true;
      } else {
        setUser(null);
        setIsAuthenticated(false);
        wasAuthenticatedRef.current = false;
      }
    } catch (err) {
      setUser(null);
      setIsAuthenticated(false);
      wasAuthenticatedRef.current = false;
    }
  };

  const logout = async () => {
    await destroySession(user?.id);
    setUser(null);
    setIsAuthenticated(false);
    window.location.href = '/login';
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      authChecked: !isLoadingAuth,
      appPublicSettings: null,
      logout,
      refreshUser,
      navigateToLogin,
      checkUserAuth: refreshUser,
      checkAppState: initAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};