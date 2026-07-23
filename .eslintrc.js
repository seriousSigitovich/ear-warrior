// ESLint config for the project. The lint toolchain deps (@typescript-eslint, eslint-config-expo)
// are installed with the native/app layer; TypeScript `strict` (tsconfig.json) is the active gate
// for the pure-logic core in this slice.
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2020, sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: { node: true, es2020: true, jest: true },
  ignorePatterns: ['node_modules/', 'dist/', 'build/', 'coverage/', 'ios/', 'android/', '.expo/'],
};
