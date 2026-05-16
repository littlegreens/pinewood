/** Layout desktop PWA: sfondi full-bleed, contenuto centrato max 1280px. */
export const CONTENT_MAX_PX = 1280;

export const pageContainerSx = {
  width: "100%",
  maxWidth: CONTENT_MAX_PX,
  mx: "auto",
  px: { xs: 2, sm: 2.5, md: 3 },
};

export const cardGridSx = {
  display: "grid",
  gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
  gap: { xs: 1.25, md: 2 },
  alignItems: "stretch",
};

export const hideOnDesktopSx = {
  display: { xs: "flex", md: "none" },
};

export const showOnDesktopSx = {
  display: { xs: "none", md: "flex" },
};
