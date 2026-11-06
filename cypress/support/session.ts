/**
 * One login for the whole run.
 *
 * The API allows five login attempts per quarter hour per IP, which is a deliberate security
 * decision and not something to weaken for tests. A suite that signs in per test spends that
 * budget in the first few cases and every later one fails with 429 — which is exactly what
 * happened the first time this suite ran.
 *
 * cy.session caches the cookie; `cacheAcrossSpecs` extends that to the second spec file, so a
 * full run costs one successful login plus the one deliberate failure in the login test.
 *
 * If a run does hit the limit, wait out the quarter hour, or clear the counters:
 * `delete from rate_limits` in the local database. They live in the database now, so
 * restarting the API no longer resets them.
 */
export function loginOnce(): void {
  cy.session(
    'owner',
    () => {
      // cy.env rather than Cypress.env: the password is sensitive and Cypress.env exposes
      // values to any code running in the browser.
      cy.env(['BREWLOG_PASSWORD']).then((values) => {
        const password: unknown = values['BREWLOG_PASSWORD'];

        if (typeof password !== 'string' || password === '') {
          throw new Error(
            'CYPRESS_BREWLOG_PASSWORD is required: CYPRESS_BREWLOG_PASSWORD=… npm run test:e2e',
          );
        }

        cy.visit('/login');
        cy.get('input[type="password"]').type(password, { log: false });
        cy.contains('button', 'Open the journal').click();
        cy.location('pathname').should('eq', '/');
      });
    },
    { cacheAcrossSpecs: true },
  );
}
