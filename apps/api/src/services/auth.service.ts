import { hash, verify } from '@node-rs/argon2';
import { v7 as uuidv7 } from 'uuid';

import type { UserRow } from '../db/schema.js';
import type { ChangePasswordInput, PublicUser, RegisterInput } from '../domain/user.js';
import { conflict, unauthorized, unprocessable } from '../lib/errors.js';
import type { UserRepository } from '../repositories/user.repository.js';

/**
 * Deliberately slow and memory-hard: 19 MiB and two passes is the OWASP baseline for argon2id.
 * Raising it further mainly punishes the one-core server this runs on.
 */
const HASH_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

/**
 * A hash of nothing in particular, verified against when the email is unknown. Without it,
 * "no such account" returns in a millisecond while "wrong password" takes eighty, and that
 * difference tells an attacker which addresses are registered.
 */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHR0aGF0aXNmaW5l$JXo0aWpXcVJIbmw5bFo4M0dLZDdCUQ';

export function toPublicUser(row: UserRow): PublicUser {
  return { id: row.id, email: row.email, displayName: row.displayName };
}

export function createAuthService(users: UserRepository) {
  return {
    async register(input: RegisterInput): Promise<UserRow> {
      const existing = await users.findByEmail(input.email);

      if (existing !== undefined) {
        // Registration cannot hide that an address is taken — the account could not be
        // created otherwise. Login is where the distinction is kept quiet.
        throw conflict('An account with that email already exists');
      }

      const now = new Date().toISOString();

      return users.insert({
        id: uuidv7(),
        email: input.email,
        passwordHash: await hash(input.password, HASH_OPTIONS),
        displayName: input.displayName,
        tokenVersion: 1,
        createdAt: now,
        updatedAt: now,
      });
    },

    /**
     * Returns the account or throws the same error for an unknown address and a wrong
     * password. Telling them apart would turn the login form into a way to enumerate who has
     * an account here.
     */
    async authenticate(email: string, password: string): Promise<UserRow> {
      const user = await users.findByEmail(email);

      if (user === undefined) {
        await verify(DUMMY_HASH, password).catch(() => false);
        throw unauthorized('Wrong email or password');
      }

      const ok = await verify(user.passwordHash, password).catch(() => false);

      if (!ok) {
        throw unauthorized('Wrong email or password');
      }

      return user;
    },

    async changePassword(user: UserRow, input: ChangePasswordInput): Promise<void> {
      const ok = await verify(user.passwordHash, input.currentPassword).catch(() => false);

      if (!ok) {
        throw unauthorized('The current password is not right');
      }

      if (input.newPassword === input.currentPassword) {
        throw unprocessable('The new password is the same as the old one');
      }

      // Bumps tokenVersion, so every token issued before this moment stops working — the
      // point of changing a password on a device you no longer trust.
      await users.setPassword(user.id, await hash(input.newPassword, HASH_OPTIONS));
    },

    async hashPassword(password: string): Promise<string> {
      return hash(password, HASH_OPTIONS);
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
