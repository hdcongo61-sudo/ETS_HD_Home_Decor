/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      /* Apple HIG: system font stack for clarity and native feel */
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"SF Pro Display"',
          'system-ui',
          'Segoe UI',
          'Roboto',
          '"Helvetica Neue"',
          'sans-serif',
        ],
      },
      /* Apple-style radius: 10–14px for controls, 12–16px for cards/sheets */
      borderRadius: {
        'apple': '12px',
        'apple-lg': '16px',
        'apple-xl': '20px',
        'apple-2xl': '24px',
      },
      /* Subtle elevation (deference): content first, UI supports */
      boxShadow: {
        'apple-sm': '0 1px 2px rgba(0,0,0,0.04), 0 1px 4px rgba(0,0,0,0.04)',
        'apple': '0 2px 8px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
        'apple-md': '0 4px 12px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.04)',
        'apple-lg': '0 8px 24px rgba(0,0,0,0.08), 0 16px 48px rgba(0,0,0,0.06)',
        'apple-inner': 'inset 0 1px 2px rgba(0,0,0,0.04)',
      },
      /* Semantic blue (HIG: primary actions) */
      colors: {
        primary: {
          DEFAULT: '#007AFF',
          hover: '#0056CC',
          light: '#E8F0FE',
          border: 'rgba(0, 122, 255, 0.3)',
        },
      },
      /* Motion: purposeful, smooth (ease-out / spring-like) */
      transitionTimingFunction: {
        'apple': 'cubic-bezier(0.25, 0.1, 0.25, 1)',
        'apple-in': 'cubic-bezier(0.42, 0, 1, 1)',
        'apple-out': 'cubic-bezier(0, 0, 0.58, 1)',
      },
      transitionDuration: {
        'apple': '250ms',
        'apple-slow': '350ms',
      },
    },
  },
  plugins: [],
};
