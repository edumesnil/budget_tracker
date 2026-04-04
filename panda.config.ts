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

  theme: {
    extend: {
      recipes,
      slotRecipes,
      tokens: {
        colors: {
          income: {
            DEFAULT: { value: 'hsl(174, 60%, 35%)' },
            muted: { value: 'hsl(174, 60%, 35% / 0.12)' },
          },
          expense: {
            DEFAULT: { value: 'hsl(3, 72%, 54%)' },
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
      },
    },
  },

  outdir: 'styled-system',
})
