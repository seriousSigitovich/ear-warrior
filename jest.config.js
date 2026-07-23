// Pure-logic test runner. The React Native / native layer (deferred) will layer in
// the `jest-expo` preset per plan.md; the pure domain logic under src/lib, src/services/grading,
// and src/services/melody has no React Native imports and runs under ts-jest today.
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['src/lib/**/*.ts', 'src/services/grading/**/*.ts', 'src/services/melody/**/*.ts'],
};
