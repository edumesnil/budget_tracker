import { defineConfig } from '@pandacss/dev'

export default defineConfig({
  jsxFramework: 'react',
  preflight: true,
  include: ['./src/**/*.{js,jsx,ts,tsx}'],
  exclude: [],

  conditions: {
    dark: '.dark &',
    light: '.light &',
  },

  theme: {
    extend: {
      tokens: {
        colors: {
          income: {
            DEFAULT: { value: 'hsl(174, 60%, 35%)' },
            light: { value: 'hsl(174, 60%, 45%)' },
            dark: { value: 'hsl(174, 60%, 40%)' },
            muted: { value: 'hsl(174, 60%, 35% / 0.1)' },
          },
          expense: {
            DEFAULT: { value: 'hsl(355, 70%, 55%)' },
            light: { value: 'hsl(355, 80%, 60%)' },
            dark: { value: 'hsl(355, 70%, 60%)' },
            muted: { value: 'hsl(355, 70%, 55% / 0.1)' },
          },
          chart: {
            1: { value: 'hsl(174, 60%, 35%)' },
            2: { value: 'hsl(355, 80%, 60%)' },
            3: { value: 'hsl(90, 70%, 75%)' },
            4: { value: 'hsl(90, 70%, 65%)' },
          },
        },
        fonts: {
          body: { value: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
          mono: { value: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace' },
        },
      },
      semanticTokens: {
        colors: {
          bg: {
            DEFAULT: { value: { base: 'hsl(60, 10%, 98%)', _dark: 'hsl(196, 30%, 10%)' } },
            card: { value: { base: 'hsl(0, 0%, 100%)', _dark: 'hsl(196, 25%, 15%)' } },
            muted: { value: { base: 'hsl(196, 15%, 92%)', _dark: 'hsl(196, 20%, 20%)' } },
            sidebar: { value: { base: 'hsl(196, 30%, 15%)', _dark: 'hsl(196, 30%, 12%)' } },
          },
          fg: {
            DEFAULT: { value: { base: 'hsl(196, 30%, 15%)', _dark: 'hsl(90, 15%, 90%)' } },
            muted: { value: { base: 'hsl(196, 15%, 40%)', _dark: 'hsl(90, 15%, 70%)' } },
            sidebar: { value: { base: 'hsl(90, 30%, 90%)', _dark: 'hsl(90, 15%, 90%)' } },
          },
          border: {
            DEFAULT: { value: { base: 'hsl(174, 10%, 85%)', _dark: 'hsl(196, 20%, 25%)' } },
            ring: { value: { base: 'hsl(174, 60%, 35%)', _dark: 'hsl(174, 60%, 40%)' } },
          },
          income: { value: { base: 'hsl(174, 60%, 35%)', _dark: 'hsl(174, 60%, 40%)' } },
          expense: { value: { base: 'hsl(355, 80%, 60%)', _dark: 'hsl(355, 70%, 60%)' } },
          destructive: { value: { base: 'hsl(0, 84%, 60%)', _dark: 'hsl(0, 63%, 50%)' } },
        },
      },
    },
  },

  outdir: 'styled-system',
})
