/**
 * Layout checks that only a browser can make. jsdom has no layout engine, so a component test
 * cannot tell that a field runs off the screen — every overflow reported so far was found by
 * opening the app, which is exactly the gap this closes.
 *
 *   npm run dev
 *   CYPRESS_BREWLOG_PASSWORD='…' npm run test:e2e
 */
import { loginOnce } from '../support/session';

/** The narrowest phone still in circulation. If it fits here it fits everywhere. */
const NARROW = { width: 320, height: 640 };

function expectNoHorizontalOverflow() {
  cy.document().then((doc) => {
    const { scrollWidth, clientWidth } = doc.documentElement;

    // One pixel of slack for sub-pixel rounding; anything more is a real overflow.
    expect(
      scrollWidth,
      `page is ${String(scrollWidth - clientWidth)}px wider than the viewport`,
    ).to.be.at.most(clientWidth + 1);
  });
}

describe('layout on a narrow screen', () => {
  beforeEach(() => {
    cy.viewport(NARROW.width, NARROW.height);
    loginOnce();
  });

  for (const [name, path] of [
    ['journal', '/'],
    ['log a brew', '/brews/new'],
    ['recipes', '/recipes'],
    ['stats', '/stats'],
    ['account', '/profile'],
  ] as const) {
    it(`${name} fits the viewport`, () => {
      cy.visit(path);
      cy.get('main').should('be.visible');
      expectNoHorizontalOverflow();
    });
  }

  it('keeps the form inside the viewport while a select is open', () => {
    // Radix locks scrolling when the list opens, which removes the scrollbar. Without a
    // reserved gutter every centred block jumps sideways at that moment.
    cy.visit('/brews/new');
    cy.contains('label', 'Method').parent().find('button').click();
    cy.contains('French press').should('be.visible');
    expectNoHorizontalOverflow();
  });

  it('fits the whole navigation bar on screen', () => {
    cy.visit('/');
    cy.get('nav[aria-label="Sections"]').then(($bar) => {
      const left = $bar.offset()?.left ?? 0;
      const width = $bar.outerWidth() ?? 0;

      expect(left, 'bar starts inside the screen').to.be.at.least(0);
      expect(left + width, 'bar ends inside the screen').to.be.at.most(NARROW.width);
    });

    // All five destinations are reachable, not clipped away
    for (const label of ['Journal', 'Log', 'Recipes', 'Stats', 'You']) {
      cy.contains('nav[aria-label="Sections"] a', label).should('be.visible');
    }
  });

  it('keeps the active segment readable on a brew page', () => {
    // Regression: the pill was placed by one calculation while the styling came from another,
    // so on this route the label stayed muted grey on the bright gradient.
    cy.visit('/');
    cy.get('body').then(($body) => {
      if ($body.find('article a').length === 0) {
        return;
      }

      cy.get('article a').first().click();
      cy.location('pathname').should('match', /^\/brews\/[0-9a-f-]+$/);
      cy.contains('nav[aria-label="Sections"] a', 'Journal').should(
        'have.attr',
        'aria-current',
        'page',
      );
    });
  });

  it('does not hide the last card behind the navigation bar', () => {
    cy.visit('/');
    cy.get('body').then(($body) => {
      if ($body.find('article').length === 0) {
        // Empty journal: nothing to be covered.
        return;
      }

      cy.scrollTo('bottom');
      cy.get('article')
        .last()
        .then(($card) => {
          cy.get('nav[aria-label="Sections"]').then(($bar) => {
            const card = $card.get(0);
            const bar = $bar.get(0);

            if (card === undefined || bar === undefined) {
              throw new Error('expected both the last card and the navigation bar');
            }

            // Both are viewport coordinates, so they are comparable once scrolled to the end.
            expect(
              card.getBoundingClientRect().bottom,
              'last card is clear of the bar',
            ).to.be.at.most(bar.getBoundingClientRect().top);
          });
        });
    });
  });
});
