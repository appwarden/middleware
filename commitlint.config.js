// commitlint.config.js
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Add any custom rules here
    'body-max-line-length': [2, 'always', 100],
    'footer-max-line-length': [2, 'always', 100],
    'header-max-length': [2, 'always', 100],
    'subject-case': [
      2,
      'never',
      ['sentence-case', 'start-case', 'pascal-case', 'upper-case'],
    ],
  },
};
