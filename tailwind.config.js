/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0ffee',
          100: '#e8ffdd',
          200: '#d1ffbb',
          300: '#b8ff99',
          400: '#7fff00',
          500: '#39FF14', // Main neon green
          600: '#2ed500',
          700: '#25aa00',
          800: '#1a7f00',
          900: '#0f5400',
        },
        dark: {
          50: '#000000',
          100: '#0a0a0a',
          200: '#1a1a1a',
          300: '#2a2a2a',
          400: '#3a3a3a',
          500: '#4a4a4a',
          600: '#5a5a5a',
          700: '#6a6a6a',
          800: '#7a7a7a',
          900: '#1f1f23',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-dark': 'linear-gradient(135deg, #000000 0%, #0a0a0a 50%, #000000 100%)',
        'gradient-neon': 'linear-gradient(90deg, rgba(57,255,20,0.1) 0%, rgba(57,255,20,0.05) 100%)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 3s ease-in-out infinite',
        'neon-glow': 'neon-glow 2s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'neon-glow': {
          '0%, 100%': { boxShadow: '0 0 5px #39FF14, 0 0 10px rgba(57,255,20,0.3)' },
          '50%': { boxShadow: '0 0 20px #39FF14, 0 0 30px rgba(57,255,20,0.5)' },
        },
      },
    },
  },
  plugins: [],
};