import { createTheme } from "@mui/material/styles";

const palette = {
  pineGreen: "#2D4F1E",
  orangeDark: "#B35A1F",
  slateGray: "#6E6E6E",
  black: "#111111",
  white: "#FFFFFF",
};

export const appTheme = createTheme({
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1280,
      xl: 1536,
    },
  },
  palette: {
    mode: "light",
    primary: {
      main: palette.pineGreen,
      contrastText: palette.white,
    },
    secondary: {
      main: palette.orangeDark,
      contrastText: palette.white,
    },
    background: {
      default: palette.white,
      paper: palette.white,
    },
    text: {
      primary: palette.black,
      secondary: palette.slateGray,
    },
  },
  shape: {
    borderRadius: 14,
  },
  typography: {
    fontFamily: '"Titillium Web", "Segoe UI", system-ui, sans-serif',
    h4: {
      fontWeight: 700,
      fontSize: "1.5rem",
      "@media (min-width:900px)": {
        fontSize: "2rem",
      },
    },
    h5: {
      fontWeight: 700,
      fontSize: "1.25rem",
      "@media (min-width:900px)": {
        fontSize: "1.6rem",
      },
    },
    h6: {
      fontWeight: 700,
      fontSize: "1.1rem",
      "@media (min-width:900px)": {
        fontSize: "1.35rem",
      },
    },
    body1: {
      fontSize: "1rem",
      "@media (min-width:900px)": {
        fontSize: "1.0625rem",
      },
    },
    button: {
      textTransform: "none",
      fontWeight: 700,
      letterSpacing: 0.2,
      fontSize: "0.95rem",
      "@media (min-width:900px)": {
        fontSize: "1rem",
      },
    },
  },
});
