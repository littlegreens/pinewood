import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

function km(v) {
  if (v == null) return "n.d.";
  return `${Number(v).toFixed(1).replace(".", ",")} km`;
}

function meters(v) {
  if (v == null) return "n.d.";
  return `${Math.round(Number(v))} m`;
}

function timeLabel(mins) {
  if (!Number.isFinite(Number(mins))) return "n.d.";
  const m = Math.round(Number(mins));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r} min`;
  return `${h} h${r ? ` ${r} min` : ""}`;
}

const customByName = [
  {
    test: (n) => n.includes("via degli dei da bologna"),
    poi: "Partenza urbana da Bologna e uscita graduale verso i colli: è una tappa bella proprio perché senti il passaggio dalla città al cammino vero. Nei tratti alti iniziano i primi panorami aperti sull'Appennino.",
    close: "È la tappa giusta per entrare nel ritmo: niente fretta, passo regolare e arrivi a fine giornata con buone gambe per il giorno dopo.",
  },
  {
    test: (n) => n.includes("madonna dei fornelli") || n.includes("passo della futa"),
    poi: "Qui si respira l'atmosfera più classica della Via degli Dei: boschi, strade bianche e il tratto verso il Passo della Futa, zona molto nota anche per il contesto storico.",
    close: "Se il meteo tiene, è una giornata super appagante: lunga, ma con quella continuità che ti fa macinare chilometri senza strappi.",
  },
  {
    test: (n) => n.includes("firenze"),
    poi: "Nel finale il paesaggio cambia di nuovo: si passa da ambiente più naturale a tratti che anticipano l'arrivo su Firenze. È una chiusura di cammino che dà soddisfazione.",
    close: "Tappa da fare con testa: gestisci bene la discesa e ti godi davvero l'arrivo, senza arrivare cotto.",
  },
  {
    test: (n) => n.includes("redentore"),
    poi: "Sul Redentore il punto forte è il panorama: quando la visibilità è buona lo sguardo spazia tra costa e interno, con quel colpo d'occhio tipico degli Aurunci che vale già la salita.",
    close: "Porta acqua sufficiente e parti presto: è una traccia che ripaga tanto, ma va rispettata.",
  },
  {
    test: (n) => n.includes("campo imperatore") || n.includes("monte aquila"),
    poi: "Ambiente spettacolare del Gran Sasso, con Campo Imperatore che resta uno dei posti più iconici da cui partire. Salendo verso Monte Aquila la vista si allarga e diventa sempre più ampia.",
    close: "In quota vento e temperatura cambiano in fretta: antivento nello zaino e giornata risolta.",
  },
  {
    test: (n) => n.includes("banditaccia") || n.includes("cerveteri"),
    poi: "Il giro è interessante perché mette insieme natura e storia: zona Banditaccia e forre creano un percorso molto vario, non la solita camminata lineare.",
    close: "Con terreno umido alcuni passaggi chiedono più attenzione, ma il contesto è davvero bello e particolare.",
  },
  {
    test: (n) => n.includes("pellecchia") || n.includes("gennaro"),
    poi: "Nei Lucretili il bello è l'alternanza tra bosco e aperture panoramiche: la salita è continua ma mai monotona, e in più punti viene voglia di fermarsi due minuti a guardare.",
    close: "È una di quelle uscite che funzionano bene per allenarsi senza rinunciare al paesaggio.",
  },
];

function pickCustom(name) {
  const normalized = String(name || "").toLowerCase();
  return customByName.find((item) => item.test(normalized)) || null;
}

function buildDescription(trail) {
  const d = km(trail.distance_km);
  const gain = meters(trail.elevation_gain_m);
  const loss = meters(trail.elevation_loss_m);
  const min = meters(trail.min_elevation_m);
  const max = meters(trail.max_elevation_m);
  const eta = timeLabel(trail.estimated_time_minutes);
  const custom = pickCustom(trail.name);

  const p1 = `${trail.name}: percorso da ${d}, con ${gain} di salita e ${loss} di discesa. A livello di impegno è una traccia da gestire con passo costante, soprattutto se vuoi godertela senza arrivare tirato nel finale. Il tempo medio è intorno a ${eta}, quindi conviene partire con un minimo di margine.`;
  const p2 = `Il terreno è misto e cambia durante la giornata: tratti più scorrevoli alternati ad altri dove è meglio curare appoggio e ritmo. La fascia altimetrica (${min} - ${max}) dà già un'idea di come può variare la percezione della fatica tra inizio e parte centrale.`;
  const p3 =
    custom?.poi ||
    "Lungo il percorso ci sono diversi punti in cui il paesaggio cambia e rende il cammino più interessante: non è una traccia piatta o ripetitiva, e questo aiuta anche mentalmente sui chilometri.";
  const p4 =
    custom?.close ||
    "Con scarpe con buona aderenza, acqua sufficiente e una gestione tranquilla delle pause, è un giro che si porta a casa bene e lascia una bella sensazione di uscita completa.";

  return `${p1}\n\n${p2}\n\n${p3}\n\n${p4}`;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

try {
  const res = await pool.query(`
    SELECT id, name, distance_km, elevation_gain_m, elevation_loss_m, min_elevation_m, max_elevation_m, estimated_time_minutes
    FROM trails
    WHERE source = 'user'
    ORDER BY created_at ASC
  `);

  for (const trail of res.rows) {
    const description = buildDescription(trail);
    await pool.query("UPDATE trails SET description = $2 WHERE id = $1", [trail.id, description]);
  }

  const check = await pool.query(`
    SELECT name, char_length(description) AS len
    FROM trails
    WHERE source = 'user'
    ORDER BY name ASC
  `);
  console.log(JSON.stringify(check.rows, null, 2));
} finally {
  await pool.end();
}
