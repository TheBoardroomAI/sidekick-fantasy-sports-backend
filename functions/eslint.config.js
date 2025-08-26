module.exports = [
  {
    ignores: [
      "**/lib/**/*",
      "**/generated/**/*", 
      "**/*.js",
      "**/node_modules/**/*",
    ],
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: require("@typescript-eslint/parser"),
      ecmaVersion: 2020,
      sourceType: "module",
    },
    plugins: {
      "@typescript-eslint": require("@typescript-eslint/eslint-plugin"),
    },
    rules: {
      "quotes": ["error", "double"],
      "indent": ["error", 2],
      "no-unused-vars": "off",
      "no-undef": "off",
    },
  },
];

