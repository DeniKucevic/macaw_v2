import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { username } from "better-auth/plugins";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  // Origins allowed to make authenticated (CSRF-checked) requests. Includes the
  // production domain, the www + vercel.app fallbacks, and localhost for dev.
  trustedOrigins: [
    "http://localhost:3000",
    "https://macaw-v2.vercel.app",
    "https://fitnessm.rs",
    "https://www.fitnessm.rs",
  ],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    // Staff set simple starter passwords (e.g. "12345"); members change them.
    minPasswordLength: 4,
    password: {
      hash: (password) => bcrypt.hash(password, 12),
      verify: ({ password, hash }) => bcrypt.compare(password, hash),
    },
  },
  // Allows members without an email to sign in with a username. The plugin adds
  // the `username`/`displayUsername` columns and a `signIn.username` endpoint;
  // it normalizes usernames to lowercase, so we store them lowercased too.
  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 30,
    }),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh session if older than 1 day
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "MEMBER",
        input: false, // not settable during signup
      },
      gymId: {
        type: "string",
        required: false,
        input: false,
      },
      phone: {
        type: "string",
        required: false,
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
