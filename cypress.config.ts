import { defineConfig } from 'cypress';

export default defineConfig({
  // Values reach the specs through cy.env(), which keeps them out of browser-visible code.
  // Cypress.env() would expose the site password to anything running on the page.
  allowCypressEnv: false,

  e2e: {
    baseUrl: 'http://localhost:5173',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    video: false,
    screenshotOnRunFailure: true,
    viewportWidth: 390,
    // A phone at the bar is the primary context, so that is the default viewport.
    viewportHeight: 844,
  },
});
