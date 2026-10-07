/** @type {import('postcss').Config} */
const config = {
  plugins: {
    // Required for Tailwind v4. Processes @import "tailwindcss",
    // @theme, and all utility classes. Replaces the old "tailwindcss"
    // PostCSS plugin which does not understand v4 syntax.
    "@tailwindcss/postcss": {},
  },
};

export default config;
