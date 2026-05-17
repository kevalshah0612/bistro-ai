module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo", "nativewind/babel"],
    plugins: [
      function inlineExpoRouterEnv({ types: t }) {
        return {
          visitor: {
            MemberExpression(path) {
              const node = path.node;
              if (
                t.isMemberExpression(node.object) &&
                t.isIdentifier(node.object.object, { name: "process" }) &&
                t.isIdentifier(node.object.property, { name: "env" }) &&
                t.isIdentifier(node.property)
              ) {
                if (node.property.name === "EXPO_ROUTER_APP_ROOT") {
                  path.replaceWith(t.stringLiteral("app"));
                }
                if (node.property.name === "EXPO_ROUTER_IMPORT_MODE") {
                  path.replaceWith(t.stringLiteral("sync"));
                }
              }
            },
          },
        };
      },
    ],
  };
};
