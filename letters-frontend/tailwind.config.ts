import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // 水墨风格主题色
        primary: {
          DEFAULT: "#C8504D", // 朱砂红
          light: "#C8504D",
          dark: "#C8504D",
        },
        background: {
          DEFAULT: "#F5F1E8", // 米白色
          light: "#F5F1E8",
          dark: "#1C1C1C", // 深墨色
        },
        surface: {
          DEFAULT: "#FDFCF8", // 浅米色
          light: "#FDFCF8",
          dark: "#2C2C2C", // 墨灰色
        },
        foreground: {
          DEFAULT: "#2C2C2C", // 墨黑色
          light: "#2C2C2C",
          dark: "#E8E5DC", // 米白文字
        },
        muted: {
          DEFAULT: "#8B8680", // 灰色调
          light: "#8B8680",
          dark: "#A8A39A",
        },
        border: {
          DEFAULT: "#D9D4C8", // 浅灰边框
          light: "#D9D4C8",
          dark: "#4A4A4A",
        },
        success: {
          DEFAULT: "#6B8E23", // 竹青色
          light: "#6B8E23",
          dark: "#9ACD32",
        },
        warning: {
          DEFAULT: "#D4A574", // 土黄色
          light: "#D4A574",
          dark: "#E6C79C",
        },
        error: {
          DEFAULT: "#C8504D", // 朱砂红
          light: "#C8504D",
          dark: "#E67373",
        },
      },
      fontFamily: {
        serif: [
          "Noto Serif SC",
          "Source Han Serif SC",
          "Georgia",
          "Times New Roman",
          "serif",
        ],
        sans: [
          "Noto Sans SC",
          "Source Han Sans SC",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
      },
      backgroundImage: {
        "ink-texture": "url('/textures/ink-paper.png')",
      },
    },
  },
  plugins: [],
};

export default config;
