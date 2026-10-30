import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, setAuthToken, getAuthToken } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('quantex_user') || localStorage.getItem('QuantEX_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return Boolean(localStorage.getItem('quantex_auth_token') || localStorage.getItem('QuantEX_auth_token'));
  });

  const [isVerifying, setIsVerifying] = useState(true);

  const [backendStatus, setBackendStatus] = useState({
    checked: false,
    connected: false,
    url: 'http://localhost:8000',
  });

  // Verify backend connectivity and session token on mount
  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      // 1. Check health
      try {
        const health = await api.health.check();
        if (isMounted) {
          setBackendStatus({
            checked: true,
            connected: health.connected,
            url: health.url,
            status: health.status,
          });
        }
      } catch (err) {
        if (isMounted) {
          setBackendStatus({ checked: true, connected: false, url: 'http://localhost:8000', error: err.message });
        }
      }

      // 2. Verify stored session token with /api/v1/auth/me
      const token = getAuthToken();
      if (!token) {
        if (isMounted) {
          setUser(null);
          setIsAuthenticated(false);
          setIsVerifying(false);
          localStorage.removeItem('quantex_user');
          localStorage.removeItem('QuantEX_user');
        }
        return;
      }

      try {
        const meRes = await api.auth.me();
        if (isMounted) {
          if (meRes && meRes.user_id && !meRes.error) {
            setUser(meRes);
            setIsAuthenticated(true);
            localStorage.setItem('quantex_user', JSON.stringify(meRes));
          } else if (meRes && meRes.status === 401) {
            // Invalid or expired token — clear auth
            setAuthToken(null);
            setUser(null);
            setIsAuthenticated(false);
            localStorage.removeItem('quantex_user');
            localStorage.removeItem('QuantEX_user');
          } else if (meRes && meRes.isDisconnected) {
            // Backend connection is offline; maintain cached user for offline inspection if present
            const cached = localStorage.getItem('quantex_user') || localStorage.getItem('QuantEX_user');
            if (cached) {
              try {
                setUser(JSON.parse(cached));
                setIsAuthenticated(true);
              } catch {
                setUser(null);
                setIsAuthenticated(false);
              }
            }
          } else {
            setAuthToken(null);
            setUser(null);
            setIsAuthenticated(false);
            localStorage.removeItem('quantex_user');
            localStorage.removeItem('QuantEX_user');
          }
          setIsVerifying(false);
        }
      } catch {
        if (isMounted) {
          setIsVerifying(false);
        }
      }
    };

    checkSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (usernameOrEmail, password) => {
    const res = await api.auth.login({ username: usernameOrEmail, password });
    if (res && (res.token || res.access_token) && res.user) {
      const token = res.token || res.access_token;
      setAuthToken(token);
      const authUser = res.user;
      setUser(authUser);
      setIsAuthenticated(true);
      localStorage.setItem('quantex_user', JSON.stringify(authUser));
      return { success: true, user: authUser };
    }

    const errorMsg = res?.error || 'Invalid username or password.';
    throw new Error(errorMsg);
  }, []);

  const signup = useCallback(async (username, email, password) => {
    const res = await api.auth.signup({ username, email, password });
    if (res && (res.token || res.access_token) && res.user) {
      const token = res.token || res.access_token;
      setAuthToken(token);
      const authUser = res.user;
      setUser(authUser);
      setIsAuthenticated(true);
      localStorage.setItem('quantex_user', JSON.stringify(authUser));
      return { success: true, user: authUser };
    }

    const errorMsg = res?.error || 'Registration failed. Username or email may already be in use.';
    throw new Error(errorMsg);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      // Safe ignore
    }
    setAuthToken(null);
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('quantex_user');
    localStorage.removeItem('quantex_auth_token');
    localStorage.removeItem('QuantEX_user');
    localStorage.removeItem('QuantEX_auth_token');
  }, []);

  const checkBackendNow = useCallback(async () => {
    const res = await api.health.check();
    setBackendStatus({
      checked: true,
      connected: res.connected,
      url: res.url,
      status: res.status,
    });
    return res;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isVerifying,
        backendStatus,
        login,
        signup,
        logout,
        checkBackendNow,
      }}
    >
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

export default AuthContext;
