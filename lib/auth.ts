/**
 * Better Auth server (Phoenix WS1).
 *
 * Server-only. Do not import from Edge middleware — use getSessionCookie from
 * `better-auth/cookies` there instead (Mongo driver is Node-only).
 *
 * Lazy init: avoids connecting Mongo until /api/auth or server actions need it.
 */

import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { nextCookies } from 'better-auth/next-js';
import type { Db, MongoClient } from 'mongodb';
import { ResetEmail } from '@/emails/reset';
import { VerifyEmail } from '@/emails/verify';
import { DEFAULT_MANGU_ROLE, normalizeManguRole, type ManguRole } from '@/lib/auth/roles';
import { isEmailConfigured, sendEmail } from '@/lib/email/send';
import { getMongoClientPromise, getMongoDbName } from '@/lib/mongodb';

export type ManguAuth = ReturnType<typeof createAuthInstance>;

function siteUrl(): string {
  const fromAuth = process.env.BETTER_AUTH_URL?.trim().replace(/\/+$/, '');
  if (fromAuth) return fromAuth;
  const fromSite = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '');
  if (fromSite) return fromSite;
  return 'http://localhost:3000';
}

function authSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error(
      'BETTER_AUTH_SECRET must be set to a random string of at least 32 characters for Better Auth'
    );
  }
  return secret;
}

function createAuthInstance(db: Db, client: MongoClient) {
  return betterAuth({
    database: mongodbAdapter(db, { client }),
    secret: authSecret(),
    baseURL: siteUrl(),
    trustedOrigins: [siteUrl()],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 8,
      sendResetPassword: async ({ user, url }) => {
        if (!isEmailConfigured()) {
          console.warn(`[auth] RESEND_API_KEY missing — skipping reset email to ${user.email}`);
          return;
        }
        const legacyWelcome = Boolean(
          process.env.AUTH_LEGACY_RESET_COPY === '1' ||
            process.env.AUTH_LEGACY_RESET_COPY === 'true'
        );
        await sendEmail(
          user.email,
          legacyWelcome
            ? 'Welcome to the new Mangu — set your password'
            : 'Reset your MANGU password',
          ResetEmail({
            userName: user.name ?? undefined,
            resetUrl: url,
            legacyWelcome,
          })
        );
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        if (!isEmailConfigured()) {
          console.warn(
            `[auth] RESEND_API_KEY missing — skipping verification email to ${user.email}`
          );
          return;
        }
        await sendEmail(
          user.email,
          'Verify your MANGU email',
          VerifyEmail({
            userName: user.name ?? undefined,
            verifyUrl: url,
          })
        );
      },
    },
    user: {
      additionalFields: {
        role: {
          type: 'string',
          defaultValue: DEFAULT_MANGU_ROLE,
          input: false,
          required: false,
        },
      },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            const role = normalizeManguRole((user as { role?: unknown }).role) satisfies ManguRole;
            const profiles = db.collection('profiles');
            const now = new Date();
            await profiles.updateOne(
              { auth_user_id: user.id },
              {
                $setOnInsert: {
                  auth_user_id: user.id,
                  display_name: user.name ?? '',
                  role,
                  created_at: now,
                  updated_at: now,
                },
              },
              { upsert: true }
            );
          },
        },
      },
    },
    plugins: [nextCookies()],
  });
}

const globalForAuth = globalThis as typeof globalThis & {
  _manguAuth?: ManguAuth;
  _manguAuthPromise?: Promise<ManguAuth>;
};

export async function getAuth(): Promise<ManguAuth> {
  if (globalForAuth._manguAuth) {
    return globalForAuth._manguAuth;
  }
  if (!globalForAuth._manguAuthPromise) {
    globalForAuth._manguAuthPromise = (async () => {
      const client = await getMongoClientPromise();
      const db = client.db(getMongoDbName());
      const instance = createAuthInstance(db, client);
      globalForAuth._manguAuth = instance;
      return instance;
    })().catch((error) => {
      delete globalForAuth._manguAuthPromise;
      delete globalForAuth._manguAuth;
      throw error;
    });
  }
  return globalForAuth._manguAuthPromise;
}

/** Test-only: clear cached auth instance. */
export function __resetAuthForTests(): void {
  delete globalForAuth._manguAuth;
  delete globalForAuth._manguAuthPromise;
}
