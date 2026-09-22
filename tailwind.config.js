/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#FBF3E7",
        card: "#FFFFFF",
        border: "#ECDFC8",
        ink: "#221420",
        // Darkened by ~1% from the original #7A6E72 — that shade sat at 4.44:1 against `bg`,
        // just under the WCAG AA 4.5:1 threshold for normal-size text; this clears it (4.57:1
        // against bg, 5.03:1 against card) while staying visually indistinguishable from before.
        muted: "#786C70",
        primary: {
          DEFAULT: "#6E1E4A",
          dark: "#4E1533",
          light: "#8A2E60"
        },
        accent: {
          bg: "#FBEAF0"
        },
        good: { DEFAULT: "#1F7A4D", bg: "#E3F3E9" },
        // Darkened from #9A6B18 (3.92:1 against warn-bg, under the AA 4.5:1 threshold for
        // normal-size text — this is used at 13px, not "large text") to 4.53:1.
        warn: { DEFAULT: "#8D6216", bg: "#F6EAD1" },
        bad: { DEFAULT: "#B23B3B", bg: "#FAE3E3" }
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"]
      },
      boxShadow: {
        card: "0 1px 2px rgba(34,20,32,0.04), 0 1px 12px rgba(34,20,32,0.05)"
      },
      borderRadius: {
        xl2: "20px"
      }
    }
  },
  plugins: []
};
