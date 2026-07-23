// Pure-logic test runner. The React Native / native layer (deferred) uses the app's Expo build; the
// pure domain logic under src/lib, src/services/grading, src/services/melody, and the DI service
// wrappers have no top-level React Native imports and run under ts-jest.
// Uses a dedicated tsconfig.jest.json so `expo start` rewriting tsconfig.json never breaks the tests.
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
  },
  collectCoverageFrom: [
    'src/lib/**/*.ts',
    'src/services/grading/**/*.ts',
    'src/services/melody/**/*.ts',
  ],
};
