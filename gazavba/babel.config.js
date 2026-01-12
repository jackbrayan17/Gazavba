module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      require.resolve('expo-router/babel'),
      // Keep reanimated last so its transforms run after all others
      'react-native-reanimated/plugin',
    ],
  };
};
