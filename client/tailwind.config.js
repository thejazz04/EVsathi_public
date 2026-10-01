/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        evsathi: {
          teal: '#659287',      // Primary Deep Teal (Stripe 1)
          mint: '#88BDA4',      // Secondary Mint (Stripe 2)
          soft: '#B1D3B9',      // Soft Green (Stripe 3)
          light: '#E6F2DD',     // Light Background / Soft Cream (Stripe 4)
          dark: '#1b2a26',      // Slate Teal Dark
          slate: '#2d433e',     // Slate Surface Dark
          muted: '#415e57',     // Muted Text/Border
          surface: '#FFFFFF',   // Pure White Card Surface
        },
      },
      boxShadow: {
        'evsathi': '0 4px 20px -2px rgba(101, 146, 135, 0.12), 0 2px 6px -1px rgba(101, 146, 135, 0.08)',
        'evsathi-hover': '0 12px 28px -4px rgba(101, 146, 135, 0.20), 0 4px 12px -2px rgba(101, 146, 135, 0.12)',
        'glow-teal': '0 0 20px rgba(101, 146, 135, 0.3)',
      },
    },
  },
  plugins: [],
}
