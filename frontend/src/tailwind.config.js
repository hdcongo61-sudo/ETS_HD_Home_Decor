module.exports = {
  purge: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  darkMode: false, // or 'media' or 'class'
  theme: {
    extend: {
      colors: {
        primary: {
          light: '#4f46e5',
          DEFAULT: '#4338ca',
          dark: '#3730a3',
        },
        secondary: {
          light: '#f97316',
          DEFAULT: '#ea580c',
          dark: '#c2410c',
        },
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [],
};
