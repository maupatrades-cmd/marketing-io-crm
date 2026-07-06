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
  const [user, setUser] = useState({
    id: 'dev-owner',
    email: 'dev@marketingio.co.za',
    full_name: 'Developer Override',
    role: 'owner',
  });
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [isLoadingPublicSettings] = useState(false);
  const [authError] = useState(null);

  // Ref so the visibility/interval handlers always see the current value
  // without re-binding on every state change.
  const wasAuthenticatedRef = useRef(false);

  useEffect(() => {
    // Auth bypass: user is always authenticated as owner
  }, []);

  // Auth bypass: session re-validation disabled

  const initAuth = async () => {
    // Auth bypass: no-op
  };

  const refreshUser = async () => {
    // Auth bypass: no-op
  };

  const logout = async () => {
    // Auth bypass: no-op
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