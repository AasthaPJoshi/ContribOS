import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from "react";

import {
  ApiError,
  contribOSApi
} from "../api/client.js";
import type {
  CurrentUser
} from "../api/types.js";

export type AuthStatus =
  | "LOADING"
  | "AUTHENTICATED"
  | "ANONYMOUS"
  | "ERROR";

export interface AuthContextValue {
  status: AuthStatus;
  user: CurrentUser | null;
  signIn(): void;
  signOut(): Promise<void>;
  refresh(): Promise<void>;
}

const AuthContext =
  createContext<
    AuthContextValue | null
  >(null);

export function AuthProvider({
  children
}: PropsWithChildren) {
  const [status, setStatus] =
    useState<AuthStatus>(
      "LOADING"
    );

  const [user, setUser] =
    useState<
      CurrentUser | null
    >(null);

  async function refresh():
    Promise<void> {
    setStatus("LOADING");

    try {
      const result =
        await contribOSApi
          .currentUser();

      setUser(result);
      setStatus(
        "AUTHENTICATED"
      );
    } catch (error) {
      setUser(null);

      if (
        error instanceof
          ApiError &&
        error.statusCode === 401
      ) {
        setStatus(
          "ANONYMOUS"
        );
        return;
      }

      setStatus("ERROR");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function signIn(): void {
    window.location.assign(
      "/auth/github/login"
    );
  }

  async function signOut():
    Promise<void> {
    await contribOSApi
      .signOut();

    setUser(null);
    setStatus(
      "ANONYMOUS"
    );
  }

  const value =
    useMemo<AuthContextValue>(
      () => ({
        status,
        user,
        signIn,
        signOut,
        refresh
      }),
      [status, user]
    );

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth():
  AuthContextValue {
  const value =
    useContext(AuthContext);

  if (!value) {
    throw new Error(
      "useAuth must be used inside AuthProvider."
    );
  }

  return value;
}
