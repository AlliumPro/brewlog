/**
 * The one path that must never break: unlock the journal, log a brew, see it in the history.
 *
 * Needs both apps running and BREWLOG_PASSWORD set to the password whose hash is in the API's
 * environment:
 *
 *   npm run dev
 *   CYPRESS_BREWLOG_PASSWORD='…' npm run test:e2e
 */
const password = Cypress.env('BREWLOG_PASSWORD') as string | undefined;

describe('critical path', () => {
  before(() => {
    if (password === undefined || password === '') {
      throw new Error('CYPRESS_BREWLOG_PASSWORD is required to run the end-to-end suite');
    }
  });

  it('turns away a visitor without the password', () => {
    cy.visit('/login');
    cy.get('input[type="password"]').type('definitely not the password');
    cy.contains('button', 'Open the journal').click();

    cy.contains('That is not the password.').should('be.visible');
    cy.location('pathname').should('eq', '/login');
  });

  it('logs a brew and shows it at the top of the history', () => {
    const bean = `Cypress Bean ${String(Date.now())}`;

    cy.visit('/login');
    cy.get('input[type="password"]').type(password ?? '', { log: false });
    cy.contains('button', 'Open the journal').click();

    cy.location('pathname').should('eq', '/');
    cy.contains('h1', 'History').should('be.visible');

    cy.contains('a', 'Log a brew').click();
    cy.location('pathname').should('eq', '/brews/new');

    cy.contains('label', 'Bean').parent().find('input').type(bean);
    cy.contains('label', 'Grind').parent().find('input').type('medium-fine');
    cy.contains('label', 'Water (ml)').parent().find('input').clear().type('300');

    // The ratio is computed as the user types; 300 ml over the default 15 g.
    cy.contains('1:20.0').should('be.visible');

    cy.contains('button', 'Save this brew').click();

    // Landed on the details screen of the new brew.
    cy.location('pathname').should('match', /^\/brews\/[0-9a-f-]+$/);
    cy.contains('h1', bean).should('be.visible');

    cy.visit('/');
    cy.contains('h2', bean).should('be.visible');
  });

  it('deletes a brew only after the confirmation is accepted', () => {
    cy.visit('/');
    cy.get('article a').first().click();

    cy.contains('button', 'Delete').click();
    cy.contains('Keep it').click();

    // Still there: cancelling must not delete anything.
    cy.location('pathname').should('match', /^\/brews\/[0-9a-f-]+$/);

    cy.contains('button', 'Delete').click();
    cy.contains('button', 'Delete it').click();

    cy.location('pathname').should('eq', '/');
  });
});
