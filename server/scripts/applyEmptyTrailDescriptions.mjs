/**
 * Descrizioni scheda uniforme (3 paragrafi) — solo percorsi con fonti reali.
 * Esclusi senza scheda pubblica: Giro Di Peppe, Tour Centocelle, Giro Di Aprilia.
 *
 *   node scripts/applyEmptyTrailDescriptions.mjs
 *   node scripts/applyEmptyTrailDescriptions.mjs --dry
 */
import "dotenv/config";
import { pool } from "../src/db/pool.js";

const dry = process.argv.includes("--dry");

/** Formato: Identità / Sviluppo+punti / Difficoltà+avvisi. Fonti in commento. */
const descriptionsById = {
  // parchilazio / alltrails / wikiloc / trekkingedivertimento
  "76422881-1428-4044-9fd5-b4bb41885815": `Anello tra il Parco Urbano di Monte Orlando e il tessuto medievale di Gaeta: un giro costiero di ambiente mediterraneo, con leccete, pinete e terrazze sul golfo. Il tracciato in app misura circa 9,9 km con poco meno di 500 m di dislivello, in linea con le varianti più complete pubblicate sul promontorio.

Si snoda tra santuario della SS. Trinità e Montagna Spaccata, Grotta del Turco, polveriere borboniche e il mausoleo di Lucio Munazio Planco in vetta. Molte relazioni chiudono l’anello scendendo verso Gaeta medioevale, castello angioino-aragonese e lungomare, oppure rientrando dal lato di Serapo.

Difficoltà da turistica a T/E secondo le fonti del Parco e delle guide: fondo misto (sentiero, sterrato, asfalto). Attenzione agli affacci sulle falesie se si soffre di vertigini; i tratti sotterranei, dove presenti, sono spesso facoltativi. Meglio evitare le ore più calde d’estate: buona parte del percorso è poco ombreggiata.`,

  // planetmountain / outdooractive / parco Maiella
  "78d8adc9-76a1-4422-a5ba-c661639ed764": `Escursione breve nella Valle di Santo Spirito (Parco Nazionale della Maiella) per raggiungere l’Eremo di San Bartolomeo in Legio, uno degli eremi legati a Pietro da Morrone. La traccia in app è di circa 4,5 km con circa 200 m di dislivello: compatibile con andata e ritorno dal piazzale di Macchie di Coco a Roccamorice.

Dal parcheggio si segue la segnaletica del Parco (sentiero S): prima carrareccia e campi, poi discesa sul versante del vallone fino alla scalinata scavata nella roccia e al buco che apre sulla terrazza dell’eremo. L’edificio, visitabile, è incastonato nella parete; sotto si trovano il torrente e la fonte detta Catenacce.

Non è una passeggiata banale: Planetmountain e Outdooractive segnalano gradoni, ciottoli e tratti esposti. Servono scarpe da trekking con grip; con fondo bagnato la discesa è scivolosa. Zona A di riserva integrale: i cani non sono ammessi sul sentiero secondo le indicazioni del Parco.`,

  // parcomajella.it F2
  "334c1b59-a0db-44a0-a569-ba616c8ab1f1": `Anello ufficiale F2 del Parco Nazionale della Maiella, noto come Anello della Cascata di San Giovanni. Parte e torna a Bocca di Valle (Guardiagrele) e attraversa la valle del Torrente Vesola, tipica valle fluviale inciso del versante orientale. In app risultano circa 7,5 km e circa 575 m di dislivello, allineati alla scheda del Parco (circa 7 km / 500–550 m).

Si sale nella faggeta lungo la valle fino al bivio per il salto principale della cascata, tra le più alte visitabili della Maiella. Si rientra al bivio, si prende a mezza costa verso il crinale e si scende verso le radure della Piana della Civita, da cui in giornate terse si vede l’Adriatico, prima di richiudere a valle. Nei pressi della partenza c’è il sacrario di Andrea Bafile.

Difficoltà E (escursionistica): il Parco avverte di tratti ripidi, seppur brevi, in salita e discesa. Acqua a Bocca di Valle; portare comunque borraccia. Controllare eventuali chiusure itinerari sul sito del Parco prima di partire.`,

  // umbriatourism / proloco monteluco
  "529b5cb9-9951-4afa-8bcf-56b9bde9bcad": `Salita da Spoleto al Bosco Sacro di Monteluco lungo il classico sentiero “la corta” (CAI n.1): un’escursione lineare in lecceto, densa di storia eremitica e romana. La traccia in app è di circa 4,4 km con circa 450 m di dislivello, coerente con la scheda di Umbria Tourism (4,44 km / 420 m).

Si lascia la città verso il Fortilizio dei Mulini e si entra nel lucus protetto già in età romana dalla Lex Spoletina. Lungo il percorso si incontrano eremi (tra cui San Paolo Protoeremita e zone legate a San Michele), poi il Convento di San Francesco e il Belvedere sulla valle. Il bosco è noto anche per l’interesse ornitologico (picchi e rampichini).

Difficoltà media: salita continua su fondo asfalto/sterrato/sentiero. Servono scarpe da trekking e acqua; Umbria Tourism indica circa due ore di percorrenza per la sola salita. Alcuni eremi o tratti possono essere privati o chiusi: restare sul sentiero segnalato.`,

  // parks.it Appia Antica / natureofsal / parco acquedotti
  "9e6a3479-8862-41db-a5f4-8b52a4e0e16c": `Anello urbano tra Pigneto, Mandrione, Tor Fiscale e Parco degli Acquedotti, nel Parco Regionale dell’Appia Antica. Circa 9,3 km in app, quasi pianeggiante: un trekking di città tra quartieri e archi millenari, classificato T.

Si segue il corridoio dell’Acquedotto Felice verso Mandrione, poi Porta Furba e il Parco di Tor Fiscale (torre medievale, incrocio tra Claudio e Marcio, memoria del Campo Barbarico). Si chiude nel Parco degli Acquedotti, con i tratti meglio conservati dell’Aqua Claudia e lo sfondo dei Colli Albani nelle giornate terse.

Difficoltà facile: fondo urbano e sterrato di parco, scarpe comode bastano. Attenzione ad attraversamenti e traffico nei tratti stradali; in estate poca ombra tra gli archi. Acqua e servizi si trovano nei quartieri e agli accessi metro (Furba / Giulio Agricola).`,

  // viapostumia.eu — macro-tratti GPX ufficiali
  "ade135c5-73d5-4d82-9c4b-4437589a15c8": `Primo macro-tratto della Via Postumia moderna: da Aquileia a Treviso lungo l’antica consolare del 148 a.C. che univa i porti di Aquileia e Genova. La traccia in app è un’unica linea lunga (oltre 200 km), da spezzare nelle tappe giornaliere indicate dalla guida ufficiale (Aquileia–Aiello, Aiello–San Giorgio di Nogaro, fino a Casale sul Sile–Treviso).

Si cammina soprattutto in pianura friulana e veneta su secondarie, argini e ciclabili, toccando luoghi legati alla storia romana e alle città d’acqua del Nord-Est. Il sito viapostumia.eu pubblica GPX e guida online per questo segmento.

Impegno di cammino di più giorni, non di una singola uscita: pianeggiante ma lungo. Prenotare le accoglienze in anticipo come raccomandato dalla guida; in estate il caldo di pianura è il vero fattore critico. Usare la suddivisione ufficiale delle tappe, non affrontare l’intera traccia in un colpo solo.`,

  "e3dfcd47-7622-42ba-b2ce-8cd93c9754a2": `Secondo macro-tratto della Via Postumia: da Treviso a Vicenza, ancora in pianura veneta. La traccia in app supera i 100 km e corrisponde al pacchetto GPX ufficiale Treviso/Vicenza del sito del cammino.

Il percorso collega città d’arte e campagne lungo strade secondarie e ciclabili, con dislivello minimo. È un tratto pensato per essere spezzato in più giornate (nella guida: Treviso–Badoere, Badoere–San Martino di Lupari, fino a Quinto Vicentino–Vicenza).

Difficoltà bassa sul piano tecnico, alta sulla distanza giornaliera. Acqua e rifornimenti nei paesi attraversati; attenzione al traffico sui tratti non dedicati. Scaricare la guida e il GPX aggiornati da viapostumia.eu prima di partire.`,

  "918c1e1d-27a1-47f0-a62e-118bd6e8c07d": `Terzo macro-tratto della Via Postumia: da Vicenza a Peschiera del Garda. In app circa 124 km con qualche centinaio di metri di dislivello cumulato: ancora pianura e collina bassa verso il Garda, secondo il GPX ufficiale Vicenza/Peschiera.

Si lasciano i Colli Berici/pianura vicentina per avvicinare Verona e l’imbocco del lago. Il cammino resta su secondarie e percorsi condivisi; le città d’arte lungo la consolare storica restano il filo conduttore.

Non è un’escursione giornaliera: suddividere come da guida. In estate preferire partenze presto; verificare varianti ciclabili/pedonali dove segnalate dal sito ufficiale.`,

  "da10e2b5-1e8b-4279-8756-a29ac16b3b16": `Quarto macro-tratto: da Peschiera del Garda a Sabbioneta. Circa 122 km in app, quasi pianeggianti, lungo il segmento ufficiale che entra in Lombardia verso Mantova e Sabbioneta, città ideale del Rinascimento.

Il paesaggio è di argini, campagne e centri storici padani. La guida regionale e viapostumia.eu descrivono questo tratto come tipico della Postumia “di pianura”: poco spettacolare in quota, ricco di storia urbana.

Impegno logistico più che tecnico. Pianificare tappe corte e alloggi; in caso di piena o lavori sugli argini controllare aggiornamenti locali. GPX e guida: sito ufficiale Via Postumia.`,

  "05cc9d6d-936a-4be4-9aa3-ee9e960c02ff": `Quinto macro-tratto: da Sabbioneta a Cremona. Circa 66 km in app, il più corto dei pacchetti GPX di questo cammino in archivio, ancora in pianura padana lombarda.

Si procede tra campagne e centri minori fino a Cremona, nodo storico sulla consolare. Fondo prevalentemente stradale/ciclabile secondario, dislivello trascurabile.

Adatto a una o due giornate di cammino a ritmo sostenuto. Attenzione al traffico agricolo e alle ore di caldo; rifornirsi nei paesi. Riferimento: GPX Sabbioneta/Cremona su viapostumia.eu.`,

  "7bf2e2c5-3c1a-4afa-a9c1-9965a76109c0": `Sesto macro-tratto: da Cremona a Monteguzzo. Circa 104 km in app, con i primi dislivelli più sensibili rispetto alla pura pianura iniziale (centinaia di metri cumulati).

Si lascia Cremona verso l’Emilia e le colline verso Monteguzzo, come da pacchetto GPX ufficiale Cremona/BB Monteguzzo. Il carattere del cammino inizia a cambiare: meno rettilineo padano, più movimento altimetrico.

Spezzare in tappe; portare acqua e verificare la guida per accoglienze. Dove il sito segnala divergenze pedonale/ciclabile, seguire la traccia a piedi aggiornata.`,

  "1d6d499a-f07a-47ed-bc4e-d11ed2463688": `Settimo macro-tratto: da Monteguzzo a Tortona. Circa 70 km in app e oltre 1.300 m di dislivello cumulato: qui la Postumia entra in territorio più mosso tra Emilia e Piemonte.

Il GPX ufficiale Monteguzzo/Tortona è il riferimento; le fonti del cammino sottolineano che da Albareto/Monteguzzo verso Genova il profilo si fa più impegnativo rispetto alla pianura aquileiese-veneta.

Non sottovalutare fatica e tempo: tappe più corte, scarpe adeguate, meteo collinare. Consultare guida e alloggi su viapostumia.eu.`,

  "25f5c07c-60cd-4d88-a8c3-6fec6899a90c": `Ottavo e ultimo macro-tratto GPX: da Tortona a Genova. Circa 103 km in app con i dislivelli più alti del set (oltre 2.000 m in salita): Appennino ligure e arrivo al mare, chiusura storica della consolare sui due porti.

Il sito ufficiale avverte che verso Genova esistono tratti tecnici (anche per MTB) e che la traccia a piedi va seguita con cura; sono citati settori tra Pietralavezzara, Isoverde e i forti genovesi.

Difficoltà nettamente superiore alle tappe di pianura. Partire allenati, con GPX aggiornato, frontale e margine di luce. In caso di maltempo appenninico valutare soste: non è un tratto da improvvisare.`,
};

const ids = Object.keys(descriptionsById);
console.log(`Descrizioni da applicare: ${ids.length} (dry=${dry})`);

let ok = 0;
for (const id of ids) {
  const description = descriptionsById[id];
  if (dry) {
    const trail = await pool.query(`SELECT name FROM trails WHERE id = $1`, [id]);
    console.log(`DRY ${trail.rows[0]?.name || id}: ${description.length} chars`);
    ok += 1;
    continue;
  }
  const r = await pool.query(
    `UPDATE trails
     SET description = $2
     WHERE id = $1
       AND (description IS NULL OR TRIM(description) = '')
     RETURNING name`,
    [id, description]
  );
  if (r.rowCount) {
    ok += 1;
    console.log(`OK ${r.rows[0].name} (${description.length} chars)`);
  } else {
    console.log(`SKIP ${id} (già piena o assente)`);
  }
}

console.log(`Fine. applicate=${ok}`);
await pool.end();
