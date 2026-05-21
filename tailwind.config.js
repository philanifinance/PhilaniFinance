/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Poppins', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#fff4ee',
          100: '#ffe4d0',
          200: '#ffc4a0',
          300: '#ff9c62',
          400: '#fd7235',
          500: '#fc5107',
          600: '#e03d00',
          700: '#b83000',
          800: '#912500',
          900: '#711c00',
        },
        navy: {
          50:  '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          300: '#9fb3c8',
          400: '#829ab1',
          500: '#627d98',
          600: '#486581',
          700: '#334e68',
          800: '#243b53',
          900: '#102a43',
          950: '#0a1929',
        },
      },
      animation: {
        'fade-up':     'fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) both',
        'fade-in':     'fadeIn 0.6s ease-out both',
        'slide-left':  'slideLeft 0.7s cubic-bezier(0.16,1,0.3,1) both',
        'slide-right': 'slideRight 0.7s cubic-bezier(0.16,1,0.3,1) both',
        'scale-in':    'scaleIn 0.5s cubic-bezier(0.16,1,0.3,1) both',
        'glow':        'glow 3s ease-in-out infinite alternate',
        'float':       'float 6s ease-in-out infinite',
        'float-slow':  'float 9s ease-in-out infinite',
        'shimmer':     'shimmer 2.4s linear infinite',
        'pulse-slow':  'pulseSlow 4s ease-in-out infinite',
        'spin-slow':   'spin 12s linear infinite',
        'marquee':     'marquee 28s linear infinite',
      },
      keyframes: {
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideLeft: {
          '0%':   { opacity: '0', transform: 'translateX(40px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideRight: {
          '0%':   { opacity: '0', transform: 'translateX(-40px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%':   { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        glow: {
          '0%':   { boxShadow: '0 0 20px rgba(252,81,7,0.15)' },
          '100%': { boxShadow: '0 0 40px rgba(252,81,7,0.35)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-12px)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
        pulseSlow: {
          '0%, 100%': { opacity: '0.6' },
          '50%':      { opacity: '1' },
        },
        marquee: {
          '0%':   { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
    },
  },
  plugins: [],
};
