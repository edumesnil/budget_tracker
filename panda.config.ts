import { defineConfig } from '@pandacss/dev'
import { createPreset } from '@park-ui/panda-preset'
import teal from '@park-ui/panda-preset/colors/teal'
import slate from '@park-ui/panda-preset/colors/slate'
import { recipes, slotRecipes } from './src/theme/recipes'

export default defineConfig({
  jsxFramework: 'react',
  preflight: true,
  include: ['./src/**/*.{js,jsx,ts,tsx}'],
  exclude: [],

  presets: [
    '@pandacss/preset-base',
    createPreset({
      accentColor: teal,
      grayColor: slate,
      radius: 'md',
    }),
  ],

  conditions: {
    dark: '.dark &',
    light: '.light &',
  },

  theme: {
    extend: {
      recipes,
      slotRecipes,
      tokens: {
        colors: {
          income: {
            DEFAULT: { value: 'hsl(174, 60%, 35%)' },
            light: { value: 'hsl(174, 60%, 45%)' },
            dark: { value: 'hsl(174, 60%, 40%)' },
            muted: { value: 'hsl(174, 60%, 35% / 0.12)' },
          },
          expense: {
            DEFAULT: { value: 'hsl(3, 72%, 54%)' },
            light: { value: 'hsl(3, 80%, 60%)' },
            dark: { value: 'hsl(3, 70%, 58%)' },
            muted: { value: 'hsl(3, 72%, 54% / 0.12)' },
          },
          chart: {
            1: { value: 'hsl(174, 60%, 35%)' },
            2: { value: 'hsl(3, 72%, 54%)' },
            3: { value: 'hsl(210, 70%, 55%)' },
            4: { value: 'hsl(45, 85%, 55%)' },
            5: { value: 'hsl(280, 60%, 55%)' },
          },
        },
        fonts: {
          sans: { value: '"DM Sans", system-ui, -apple-system, sans-serif' },
          mono: { value: '"JetBrains Mono", "Fira Code", ui-monospace, monospace' },
        },
      },
      semanticTokens: {
        colors: {
          // Sidebar: always dark — hardcoded values, not theme-switching
          sidebar: {
            bg: { value: { base: '{colors.gray.dark.2}', _dark: '{colors.gray.dark.2}' } },
            border: { value: { base: '{colors.gray.dark.4}', _dark: '{colors.gray.dark.4}' } },
            fg: { value: { base: '{colors.gray.dark.12}', _dark: '{colors.gray.dark.12}' } },
            'fg.muted': { value: { base: '{colors.gray.dark.10}', _dark: '{colors.gray.dark.10}' } },
            active: { value: { base: '{colors.gray.dark.4}', _dark: '{colors.gray.dark.4}' } },
            hover: { value: { base: '{colors.gray.dark.3}', _dark: '{colors.gray.dark.3}' } },
          },
          // Financial semantic tokens only
          income: { value: { base: 'hsl(174, 60%, 32%)', _dark: 'hsl(174, 60%, 45%)' } },
          expense: { value: { base: 'hsl(3, 72%, 50%)', _dark: 'hsl(3, 72%, 62%)' } },
          destructive: { value: { base: '{colors.red.default}', _dark: '{colors.red.default}' } },
        },
      },
    },
  },

  outdir: 'styled-system',
})
