/**
 * The one path that must never break: unlock the journal, log a brew, see it in the history.
 *
 * Needs both apps running and the password whose hash is in the API's environment:
 *
 *   npm run dev
 *   CYPRESS_BREWLOG_PASSWORD='…' npm run test:e2e
 */
import { loginOnce } from '../support/session';

describe('the login screen', () => {
  it('turns away a visitor without the password', () => {
    // The only deliberate failed attempt in the suite. The API allows five per quarter hour,
    // so spending them on repeated logins is what makes an e2e run fail with 429.
    cy.visit('/login');
    cy.get('input[type="password"]').type('definitely not the password');
    cy.contains('button', 'Open the journal').click();

    cy.contains('That is not the password.').should('be.visible');
    cy.location('pathname').should('eq', '/login');
  });
});

describe('critical path', () => {
  beforeEach(() => {
    loginOnce();
  });

  it('logs a brew and shows it at the top of the history', () => {
    const bean = `Cypress Bean ${String(Date.now())}`;

    cy.visit('/brews/new');
    cy.contains('h1', 'Log a brew').should('be.visible');

    cy.contains('label', 'Bean').parent().find('input').type(bean);
    cy.contains('label', 'Grind').parent().find('input').type('medium-fine');
    cy.contains('label', 'Water (ml)').parent().find('input').clear().type('300');
    cy.contains('label', 'Brew time, min').parent().find('input').clear().type('3');
    cy.contains('label', 'Brew time, sec').parent().find('input').clear().type('15');

    // The ratio is computed as the user types; 300 ml over the default 15 g.
    cy.contains('1:20.0').should('be.visible');

    cy.contains('button', 'Save this brew').click();

    // Landed on the details screen of the new brew.
    cy.location('pathname').should('match', /^\/brews\/[0-9a-f-]+$/);
    cy.contains('h1', bean).should('be.visible');

    cy.visit('/');
    cy.contains('h2', bean).should('be.visible');
  });

  it('computes extraction from a TDS reading', () => {
    cy.visit('/brews/new');
    cy.contains('label', 'Bean')
      .parent()
      .find('input')
      .type(`TDS ${String(Date.now())}`);
    cy.contains('label', 'Grind').parent().find('input').type('medium');
    cy.contains('label', 'TDS (%)').parent().find('input').type('1.35');

    // Defaults are 15 g and 250 ml: 1.35% × 220 / 15 = 19.8%
    cy.contains('19.8%').should('be.visible');
    cy.contains('18–22% band').should('be.visible');
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
