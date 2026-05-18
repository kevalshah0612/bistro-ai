const { expoRouterBabelPlugin } = require("babel-preset-expo/build/expo-router-plugin");

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo", "nativewind/babel"],
    // expo-router lives in apps/mobile/node_modules (not hoisted), so
    // babel-preset-expo's hasModule('expo-router') check fails at the repo root
    // and the router plugin is never registered unless we add it here.
    plugins: [expoRouterBabelPlugin],
  };
};
