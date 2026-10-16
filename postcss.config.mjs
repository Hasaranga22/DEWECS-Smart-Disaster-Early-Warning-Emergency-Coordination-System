import { createRequire } from "module";

const require = createRequire(import.meta.url);
const plugins = {};

try {
  require.resolve("@tailwindcss/postcss");
  plugins["@tailwindcss/postcss"] = {};
} catch {
  // @tailwindcss/postcss is optional/not installed in current environment
}

/** @type {import('postcss').Config} */
const config = {
  plugins,
};

export default config;
