import type { App } from '../app.js';
import { errorSchema } from '../domain/common.js';
import { profileSchema, profileUpdateSchema } from '../domain/profile.js';
import type { ProfileRepository } from '../repositories/profile.repository.js';

interface ProfileRouteDeps {
  profileRepository: ProfileRepository;
}

export function registerProfileRoutes(app: App, { profileRepository }: ProfileRouteDeps): void {
  app.get(
    '/profile',
    {
      schema: {
        tags: ['profile'],
        summary: 'Read the owner profile',
        response: { 200: profileSchema, 401: errorSchema },
      },
    },
    () => profileRepository.read(),
  );

  app.patch(
    '/profile',
    {
      schema: {
        tags: ['profile'],
        summary: 'Update the owner profile',
        body: profileUpdateSchema,
        response: { 200: profileSchema, 401: errorSchema, 422: errorSchema },
      },
    },
    (request) => {
      // A blank field means "no name", not a name made of spaces.
      const displayName =
        request.body.displayName === null || request.body.displayName === ''
          ? null
          : request.body.displayName;

      return profileRepository.write(displayName);
    },
  );
}
