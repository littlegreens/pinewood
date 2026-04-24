import { Box, Container, Stack, Typography } from "@mui/material";

export default function LegalTerms() {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", py: 3 }}>
      <Container maxWidth="md">
        <Stack spacing={1.2}>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            Termini di Servizio
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Versione 2026-04-21
          </Typography>
          <Typography>
            L’uso di Pinewood è consentito per finalità personali e nel rispetto della normativa locale. L’utente è
            responsabile dei contenuti caricati e dell’uso del servizio durante attività outdoor.
          </Typography>
          <Typography>
            Pinewood non sostituisce strumenti di sicurezza, mappe ufficiali o valutazioni professionali dei rischi
            in montagna. L’utente deve verificare condizioni meteo, stato sentieri e idoneità dell’itinerario.
          </Typography>
          <Typography>
            I contenuti caricati (inclusi file GPX/KML) restano sotto la piena responsabilità dell’utente che li
            pubblica. L’utente garantisce di poterli usare, condividere e caricare sulla piattaforma, e si assume ogni
            responsabilità per eventuali violazioni di diritti di terzi.
          </Typography>
          <Typography>
            Quando previsto dalle funzionalità del servizio, l’utente può scaricare i propri contenuti. La disponibilità
            del download può dipendere da limiti tecnici o da attività di manutenzione.
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
