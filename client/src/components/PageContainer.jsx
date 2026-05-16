import { Box } from "@mui/material";
import { pageContainerSx } from "../theme/layout.js";

/** Contenuto app centrato (max 1280px). Sfondi/immagini restano fuori, full width. */
export default function PageContainer({ children, sx, ...rest }) {
  return (
    <Box sx={{ ...pageContainerSx, ...sx }} {...rest}>
      {children}
    </Box>
  );
}
