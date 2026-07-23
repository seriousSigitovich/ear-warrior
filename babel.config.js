// Expo + expo-router Babel config (used by the Metro bundler for the app build).
module.exports = function (api) {
  api.cache(true);
  // babel-preset-expo (SDK 50+) already includes expo-router support; no extra plugin needed.
  return {
    presets: ['babel-preset-expo'],
  };
};
