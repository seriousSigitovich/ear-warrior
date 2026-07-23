// Expo + expo-router Babel config (used by the Metro bundler for the app build).
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['expo-router/babel'],
  };
};
