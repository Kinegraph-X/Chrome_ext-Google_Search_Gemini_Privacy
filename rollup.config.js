import css from "rollup-plugin-import-css";
import copy from "rollup-plugin-copy";

const commonPlugins = [
  css()
];

export default [
  {
    input: "src/background.js",
    output: {
      file: "dist/background.js",
      format: "iife",
      sourcemap: true
    },
    plugins: commonPlugins
  },

  {
    input: "src/content-script.js",
    output: {
      file: "dist/content-script.js",
      format: "iife",
      sourcemap: true
    },
    plugins: [
      ...commonPlugins,
      copy({
        targets: [
          { src: "src/manifest.json", dest: "dist" },
          { src: "src/rules.json", dest: "dist" },
          { src: "src/popup.*", dest: "dist" },
          { src: ["icons", '!**/*.psd'], dest: "dist"},
          { src: "_locales", dest: "dist"}
        ]
      })
    ]
  }
];