module.exports = {
  testEnvironment: 'node',
  // Seuls les tests d'intégration Supertest ; les suites `node:test`
  // (tests/*.test.js) tournent via `npm run test:isolation`.
  testMatch: ['**/tests/**/*.integration.js'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'controllers/**/*.js',
    'middlewares/**/*.js',
    'models/**/*.js',
    'utils/**/*.js',
  ],
  coveragePathIgnorePatterns: ['/node_modules/'],
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
