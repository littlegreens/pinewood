import { Box, Container, Stack, Typography } from "@mui/material";

export default function LegalPrivacy() {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", py: 3 }}>
      <Container maxWidth="md">
        <Stack spacing={1.2}>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            Privacy Policy
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Versione 2026-04-21
          </Typography>
          <Typography>
            Pinewood tratta i dati necessari all’erogazione del servizio: account, sessioni di navigazione, percorsi
            caricati e preferenze utente. I dati sono trattati per finalità di autenticazione, funzionamento app,
            sicurezza e miglioramento del servizio.
          </Typography>
          <Typography>
            I file GPX/KML caricati restano sotto la responsabilità dell’utente che li invia: l’utente dichiara di
            avere i diritti necessari sul contenuto e sulle informazioni presenti nel file. Pinewood non è responsabile
            dei contenuti caricati dagli utenti.
          </Typography>
          <Typography>
            Conservazione: gli account inattivi non vengono cancellati automaticamente e restano presenti finché
            l’utente non richiede la cancellazione del proprio account. In caso di cancellazione account, i dati personali
            e i contenuti associati vengono rimossi secondo i tempi tecnici necessari al completamento dell’operazione.
          </Typography>
          <Typography>
            I file caricati possono essere conservati su infrastruttura server gestita dal titolare del trattamento per
            finalità tecniche di erogazione del servizio, sicurezza e continuità operativa.
          </Typography>
          <Typography>
            L’utente può richiedere accesso, rettifica o cancellazione dei dati personali scrivendo al titolare del
            trattamento indicato nella documentazione di progetto.
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
