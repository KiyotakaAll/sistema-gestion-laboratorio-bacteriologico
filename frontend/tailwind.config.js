/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Source Sans 3"', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['"Source Serif 4"', 'ui-serif', 'Georgia', 'Cambria', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      // Escala compacta para tablas y paneles de alta densidad (solo escritorio).
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
        xs: ['0.75rem', { lineHeight: '1.0625rem' }],
        sm: ['0.8125rem', { lineHeight: '1.25rem' }],
        base: ['0.9375rem', { lineHeight: '1.375rem' }],
        lg: ['1.125rem', { lineHeight: '1.5rem' }],
        xl: ['1.375rem', { lineHeight: '1.75rem' }],
      },
      colors: {
        // Fondo de la aplicación: el tono frío de un portaobjetos de vidrio.
        lamina: '#EDF1F5',
        // Violeta de cristal violeta, el colorante de la tinción de Gram: color de marca.
        violeta: {
          50: '#F5F1FB',
          100: '#E8DFF5',
          200: '#D0BEEA',
          300: '#B196DA',
          400: '#8F6CC4',
          500: '#7148A9',
          600: '#5D3792',
          700: '#4A2B76',
          800: '#3A2260',
          900: '#2B1948',
          950: '#1D1031',
        },
      },
      keyframes: {
        aparecer: { from: { opacity: '0' }, to: { opacity: '1' } },
      },
      animation: {
        aparecer: 'aparecer 120ms ease-out',
      },
    },
  },
  plugins: [],
};
