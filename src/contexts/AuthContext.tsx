import {
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";

import { getSupabaseClient } from "../lib/supabase";
import {
  ensureAccountRecords,
  signInWithEmail,
  signOutFromSupabase,
  signUpWithEmail,
  type SignUpResult,
} from "../services/authService";
import { AuthContext } from "./authContextDefinition";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Não foi possível inicializar a autenticação.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [initializationError, setInitializationError] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    void Promise.resolve()
      .then(async () => {
        if (!active) return;

        const client = await getSupabaseClient();
        if (!active) return;

        const { data } = client.auth.onAuthStateChange(
          (event, session) => {
            if (!active) return;

            if (event === "SIGNED_OUT" || !session) {
              setUser(null);
              setInitializationError(null);
              setIsLoading(false);
              return;
            }

            setUser(session.user);

            if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
              setIsLoading(true);
              void Promise.resolve()
                .then(() => ensureAccountRecords(session.user))
                .then(() => {
                  if (active) setInitializationError(null);
                })
                .catch((error: unknown) => {
                  if (active) setInitializationError(getErrorMessage(error));
                })
                .finally(() => {
                  if (active) setIsLoading(false);
                });
            } else {
              setIsLoading(false);
            }
          },
        );

        unsubscribe = () => data.subscription.unsubscribe();
      })
      .catch((error: unknown) => {
        if (!active) return;
        setInitializationError(getErrorMessage(error));
        setIsLoading(false);
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  async function signIn(email: string, password: string): Promise<void> {
    const signedInUser = await signInWithEmail(email, password);
    setUser(signedInUser);
    setInitializationError(null);
  }

  async function signUp(
    username: string,
    email: string,
    password: string,
  ): Promise<SignUpResult> {
    const result = await signUpWithEmail(username, email, password);
    setInitializationError(null);
    return result;
  }

  async function signOut(): Promise<void> {
    await signOutFromSupabase();
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        isLoading,
        initializationError,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
