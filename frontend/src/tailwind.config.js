module.exports = {
  purge: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  darkMode: false,
  theme: {
    extend: {
      colors: {
        // Fluent 2 brand
        brand: {
          DEFAULT:  '#0F6CBD',
          hover:    '#115EA3',
          pressed:  '#0F548C',
          light:    '#EBF3FC',
        },
        // Keep existing primary/secondary aliases
        primary: {
          light:   '#4f46e5',
          DEFAULT: '#4338ca',
          dark:    '#3730a3',
        },
        secondary: {
          light:   '#f97316',
          DEFAULT: '#ea580c',
          dark:    '#c2410c',
        },
        // Fluent 2 neutral scale
        neutral: {
          bg1:     '#FFFFFF',
          bg2:     '#F5F5F5',
          bg3:     '#F0F0F0',
          bg4:     '#EBEBEB',
          bg5:     '#E6E6E6',
          stroke1: '#D1D1D1',
          stroke2: '#E0E0E0',
          fg1:     '#242424',
          fg2:     '#424242',
          fg3:     '#616161',
          fg4:     '#707070',
        },
        // Fluent 2 status
        status: {
          successFg: '#107C10',
          successBg: '#F1FAF1',
          warningFg: '#835B00',
          warningBg: '#FFF8DF',
          dangerFg:  '#C50F1F',
          dangerBg:  '#FDF3F4',
          infoFg:    '#0F6CBD',
          infoBg:    '#EBF3FC',
        },
      },
      boxShadow: {
        'fluent2':  '0 1px 2px rgba(0,0,0,0.14), 0 0 2px rgba(0,0,0,0.12)',
        'fluent4':  '0 2px 4px rgba(0,0,0,0.14), 0 0 2px rgba(0,0,0,0.12)',
        'fluent8':  '0 4px 8px rgba(0,0,0,0.14), 0 0 2px rgba(0,0,0,0.12)',
        'fluent16': '0 8px 16px rgba(0,0,0,0.14), 0 0 2px rgba(0,0,0,0.12)',
        'fluent28': '0 14px 28px rgba(0,0,0,0.24), 0 0 8px rgba(0,0,0,0.2)',
      },
      borderRadius: {
        'fluent-sm': '2px',
        'fluent-md': '4px',
        'fluent-lg': '6px',
        'fluent-xl': '8px',
      },
      maxWidth: {
        'saas': '1600px',
      },
      screens: {
        'touch': { 'raw': '(pointer: coarse)' },
      },
      fontFamily: {
        'fluent': ['"Segoe UI"', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [],
};
