import { defineConfig } from "@pandacss/dev";
import { createPreset } from "@park-ui/panda-preset";
import tealColor from "@park-ui/panda-preset/colors/teal";
import slateColor from "@park-ui/panda-preset/colors/slate";
import { recipes, slotRecipes } from "./src/theme/recipes";
import { conditions } from "./src/theme/conditions";
import { layerStyles } from "./src/theme/layer-styles";
import { globalCss } from "./src/theme/global-css";
import { keyframes } from "./src/theme/keyframes";
import { textStyles } from "./src/theme/text-styles";
import { animationStyles } from "./src/theme/animation-styles";
import { shadows } from "./src/theme/tokens/shadows";
import { zIndex } from "./src/theme/tokens/z-index";
import { colors } from "./src/theme/tokens/colors";
import { slate } from "./src/theme/colors/slate";
import { teal } from "./src/theme/colors/teal";
import { red } from "./src/theme/colors/red";

export default defineConfig({
  jsxFramework: "react",
  preflight: true,
  include: ["./src/**/*.{js,jsx,ts,tsx}"],
  exclude: [],

  presets: [
    "@pandacss/preset-base",
    createPreset({
      accentColor: tealColor,
      grayColor: slateColor,
      radius: "md",
    }),
  ],

  conditions,

  theme: {
    extend: {
      recipes,
      slotRecipes,
      keyframes,
      textStyles,
      animationStyles,
      layerStyles,
      tokens: {
        colors,
        zIndex,
        shadows: {},
      },
      semanticTokens: {
        shadows,
        colors: {
          gray: slate,
          teal,
          red,
          income: {
            DEFAULT: { value: "hsl(174, 60%, 35%)" },
            muted: { value: "hsl(174, 60%, 35% / 0.12)" },
          },
          expense: {
            DEFAULT: { value: "hsl(3, 72%, 54%)" },
            muted: { value: "hsl(3, 72%, 54% / 0.12)" },
          },
          chart: {
            1: { value: "hsl(174, 60%, 35%)" },
            2: { value: "hsl(3, 72%, 54%)" },
            3: { value: "hsl(210, 70%, 55%)" },
            4: { value: "hsl(45, 85%, 55%)" },
            5: { value: "hsl(280, 60%, 55%)" },
          },
        },
      },
    },
  },

  globalCss,

  outdir: "styled-system",
});
