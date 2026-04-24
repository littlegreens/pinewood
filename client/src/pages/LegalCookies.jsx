import { Box, Container, Stack, Typography } from "@mui/material";

export default function LegalCookies() {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", py: 3 }}>
      <Container maxWidth="md">
        <Stack spacing={1.2}>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            Cookie Policy
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Versione 2026-04-21
          </Typography>
          <Typography>
            Pinewood usa cookie tecnici essenziali per autenticazione sessione (refresh token) e sicurezza. In
            ambiente di test non vengono usati cookie di profilazione di terze parti.
          </Typography>
          <Typography>
            Le preferenze locali possono essere salvate nel browser (es. lingua, stato utente) tramite storage locale
            per migliorare l’esperienza d’uso.
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
