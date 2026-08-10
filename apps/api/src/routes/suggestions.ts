import type { App } from '../app.js';
import { errorSchema } from '../domain/common.js';
import { suggestionsQuerySchema, suggestionsSchema } from '../domain/stats.js';
import type { BrewService } from '../services/brew.service.js';

interface SuggestionRouteDeps {
  brewService: BrewService;
}

/** Feeds the autocomplete on the new-brew form: values the owner has already typed once. */
export function registerSuggestionRoutes(app: App, { brewService }: SuggestionRouteDeps): void {
  app.get(
    '/suggestions/beans',
    {
      schema: {
        tags: ['suggestions'],
        summary: 'Previously used bean names',
        querystring: suggestionsQuerySchema,
        response: { 200: suggestionsSchema, 401: errorSchema, 422: errorSchema },
      },
    },
    (request) =>
      brewService.suggestBeans(request.currentUser.id, request.query.q, request.query.limit),
  );

  app.get(
    '/suggestions/roasters',
    {
      schema: {
        tags: ['suggestions'],
        summary: 'Previously used roasters',
        querystring: suggestionsQuerySchema,
        response: { 200: suggestionsSchema, 401: errorSchema, 422: errorSchema },
      },
    },
    (request) =>
      brewService.suggestRoasters(request.currentUser.id, request.query.q, request.query.limit),
  );
}
