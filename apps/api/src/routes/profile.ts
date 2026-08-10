import type { App } from '../app.js';
import { errorSchema } from '../domain/common.js';
import { profileSchema, profileUpdateSchema } from '../domain/profile.js';
import type { UserRepository } from '../repositories/user.repository.js';

interface ProfileRouteDeps {
  userRepository: UserRepository;
}

/**
 * The display name now belongs to the account rather than to a single-row table, so both
 * routes read and write the row of whoever is signed in.
 */
export function registerProfileRoutes(app: App, { userRepository }: ProfileRouteDeps): void {
  app.get(
    '/profile',
    {
      schema: {
        tags: ['profile'],
        summary: 'Read the signed-in account profile',
        response: { 200: profileSchema, 401: errorSchema },
      },
    },
    (request) => ({ displayName: request.currentUser.displayName }),
  );

  app.patch(
    '/profile',
    {
      schema: {
        tags: ['profile'],
        summary: 'Update the signed-in account profile',
        body: profileUpdateSchema,
        response: { 200: profileSchema, 401: errorSchema, 422: errorSchema },
      },
    },
    async (request) => {
      // A blank field means "no name", not a name made of spaces.
      const displayName =
        request.body.displayName === null || request.body.displayName === ''
          ? null
          : request.body.displayName;

      const updated = await userRepository.updateDisplayName(request.currentUser.id, displayName);

      return { displayName: updated?.displayName ?? null };
    },
  );
}
