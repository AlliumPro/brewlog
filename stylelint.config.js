/**
 * CSS Modules with a token-only policy: raw colours are an error everywhere except the
 * token file, so a hex value cannot quietly enter a component stylesheet.
 */
export default {
  extends: [
    'stylelint-config-standard',
    'stylelint-config-css-modules',
    'stylelint-config-recess-order',
  ],
  rules: {
    // CSS Modules class names are consumed as JS identifiers, so camelCase, not kebab-case.
    'selector-class-pattern': [
      '^[a-z][a-zA-Z0-9]*$',
      { message: 'Expected class selector to be camelCase (CSS Modules)' },
    ],
    'max-nesting-depth': [1, { ignoreAtRules: ['media', 'supports', 'container'] }],
    // Blank lines group the token file into palette / typography / spacing sections.
    'custom-property-empty-line-before': null,
    'color-no-hex': true,
    'color-named': 'never',
    'declaration-property-value-no-unknown': true,
    // Specificity order is not meaningful when every component owns its own scope.
    'no-descending-specificity': null,
  },
  overrides: [
    {
      files: ['apps/web/src/app/styles/tokens.css'],
      rules: {
        // The single place raw colour values are allowed to exist.
        'color-no-hex': null,
      },
    },
  ],
};
