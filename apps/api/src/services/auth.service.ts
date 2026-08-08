import { verify } from '@node-rs/argon2';
import { v7 as uuidv7 } from 'uuid';

import type { SessionRepository } from '../repositories/session.repository.js';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function createAuthService(repository: SessionRepository, passwordHash: string) {
  return {
    /**
     * argon2 verification is deliberately slow and takes the same path whether the password
     * is wrong or right, so timing does not distinguish the two. The hash is always present —
     * env validation refuses to boot without it — so there is no "not configured" shortcut
     * that would leak that fact.
     */
    async verifyPassword(password: string): Promise<boolean> {
      try {
        return await verify(passwordHash, password);
      } catch {
        // A malformed hash in the environment must not read as a successful login.
        return false;
      }
    },

    async createSession(): Promise<{ id: string; expiresAt: Date }> {
      const id = uuidv7();
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

      await repository.pruneExpired(new Date().toISOString());
      await repository.create(id, expiresAt.toISOString());

      return { id, expiresAt };
    },

    /** Returns true when the session is live, refreshing it once it is past halfway. */
    async validateSession(id: string): Promise<boolean> {
      const session = await repository.find(id);

      if (session === undefined) {
        return false;
      }

      const expiresAt = Date.parse(session.expiresAt);
      const now = Date.now();

      if (Number.isNaN(expiresAt) || expiresAt <= now) {
        await repository.remove(id);
        return false;
      }

      // Sliding expiry without a database write on every single request.
      if (expiresAt - now < SESSION_TTL_MS / 2) {
        await repository.touch(id, new Date(now + SESSION_TTL_MS).toISOString());
      }

      return true;
    },

    async destroySession(id: string): Promise<void> {
      await repository.remove(id);
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
