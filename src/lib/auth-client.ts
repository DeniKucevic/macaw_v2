import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [usernameClient()],
  // Use the origin the user is actually on (fitnessm.rs or the vercel.app
  // fallback) so auth requests stay same-origin and cookies match. Falls back to
  // the env var / localhost for any non-browser context.
  baseURL:
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
});

export const { signIn, signOut, signUp, useSession } = authClient;
