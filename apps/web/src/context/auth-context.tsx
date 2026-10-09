"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { apiClient, ApiClientError } from "../lib/api-client";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  status: string;
}

export interface AuthContextValue {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: ApiClientError | Error | null;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export interface AuthProviderProps {
  children: ReactNode;
  initialUser?: UserProfile | null;
}

export function AuthProvider({
  children,
  initialUser = null,
}: AuthProviderProps) {
  const [user, setUser] = useState<UserProfile | null>(initialUser);
  const [isLoading, setIsLoading] = useState<boolean>(!initialUser);
  const [error, setError] = useState<ApiClientError | Error | null>(null);

  const refreshUser = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<{ user: UserProfile }>("/api/v1/auth/me");
      setUser(response.user);
    } catch (err: unknown) {
      if (err instanceof ApiClientError && (err.isUnauthorized || err.status === 401)) {
        setUser(null);
      } else {
        setError(err instanceof Error ? err : new Error("Failed to load user session"));
      }
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await apiClient.post("/api/v1/auth/logout");
    } catch {
      // Ignore logout failure, still clear local session
    } finally {
      setUser(null);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialUser === null) {
      refreshUser();
    }
  }, [initialUser, refreshUser]);

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: Boolean(user),
    error,
    refreshUser,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
