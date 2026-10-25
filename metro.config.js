// Metro config with Sentry's debug-id support so release builds can be symbolicated.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);
