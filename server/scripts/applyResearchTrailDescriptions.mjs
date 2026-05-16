import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

/** Descrizioni da fonti online (report, siti ufficiali, escursionismo). Esclusi: Giro Di Peppe, Tour di Centocelle. */
const descriptionsById = {
  "4e6f75d3-c196-4f36-8101-6e1d02774d5e": `A Roma ci sono percorsi che non cercano il verde assoluto ma la memoria, e questo anello tra Pigneto, Mandrione e Quadraro funziona proprio cosi: sotto le arcate dell’Acquedotto Felice la citta cambia voce, diventa piu ruvida, quasi pasoliniana. Il Mandrione, raccontano gli itinerari storici della zona, fu luogo di baracche, transiti, mandrie e vite marginali; oggi resta una lama urbana dove acquedotti, ferrovia e borgata si toccano a pochi metri di distanza.

Il tracciato cuce insieme ambienti molto diversi. Si parte dal Pigneto, dove via Fanfulla da Lodi conserva lo storico Bar Necci e vari omaggi murali a Pier Paolo Pasolini, da Maupal a Mr. Klevra fino a Omino71. Poi si entra nel Quadraro e nell’area dell’Acquedotto Felice, dove guide locali e associazioni ricordano la Scuola 725 di don Roberto Sardelli e la storia dei baraccati raccontata anche da Franco Ferrarotti. Il tratto piu suggestivo resta via del Mandrione: un corridoio di case basse, archi monumentali e piccoli giardini ricavati sotto l’acquedotto, con il traffico che resta vicino ma non domina mai del tutto la scena.

Gli avvisi pratici qui non sono “da montagna” ma sono reali: alcuni passaggi verso Tuscolana e sotto la ferrovia vengono segnalati come i piu critici per auto e incroci, e via del Mandrione, pur con limite ridotto, resta usata come scorciatoia. Conviene evitarlo nelle ore di punta, portare acqua nei mesi caldi e viverlo come un trekking urbano di osservazione, non come una passeggiata distratta.`,

  "0de533eb-5a04-4afa-9003-be421c239e45": `Con i suoi 1369 metri, il Monte Pellecchia e la cima piu alta dei Monti Lucretili, ma quello che colpisce davvero e il modo in cui questo anello costruisce l’ascesa: all’inizio quasi accompagna, poi stringe il sentiero nel bosco e infine apre tutto, all’improvviso, su creste nude e panorami larghissimi. E il classico giro che sembra docile alla partenza e poi cambia tono quota dopo quota.

Si parte da Monteflavio seguendo i segni bianco-rossi del 312 lungo strade bianche e margini recintati, finche la salita entra nella faggeta verso Sella Valle S. Rico. Qui il bosco si fa piu fitto, il fondo piu irregolare e il ritmo si assesta su quello di una vera escursione. In alto il paesaggio si apre sui crinali dei Lucretili e la vetta regala, nelle giornate terse, una vista che le relazioni danno costantemente come vastissima: Terminillo, Velino, Simbruini, Monte Gennaro, Soratte e perfino il Tirreno. Ma il dettaglio piu memorabile non e il panorama: lungo la discesa si incontrano i resti dell’aereo precipitato, con motore, coda e frammenti tra faggi coperti di muschio, un incontro che cambia il passo e l’umore della giornata.

Va presa sul serio. Piu fonti avvertono di tracce evidenti ma fuorvianti in prossimita di staccionate e del Pizzo: il sentiero corretto non sempre coincide con la traccia piu battuta. Acqua da portare tutta da casa, perche le fonti non sono affidabili, e in inverno neve e ghiaccio rendono necessari scarponi seri e attrezzatura adeguata.`,

  "7d294c13-109d-4fe4-8def-9d9fa46f60dd": `Il Cammino dei Tre Villaggi e corto solo sulla carta. Venti chilometri possono sembrare pochi, ma in questa porzione di Tuscia diventano un concentrato di forre, necropoli, vie cave e borghi di tufo che non lasciano mai camminare in modo distratto. Il C3V parte e torna a Villa San Giovanni in Tuscia, tocca Barbarano Romano e Blera e attraversa un pezzo di Lazio etrusco che ha qualcosa di sorprendentemente selvatico.

La traccia entra presto nel Parco Marturanum, tra ruscelli, bosco e antiche strade scavate nel tufo. Le fonti ufficiali e i diari di viaggio insistono su alcuni punti fermi: l’accesso scenografico a Barbarano dalla Porta Romana, le vie cave etrusche, i panorami sulle forre del Biedano, i passaggi verso Blera e le sue gole, e il carattere archeologico del percorso, che non e un semplice anello naturalistico ma un cammino tra necropoli, ponti, mulini e piccoli musei territoriali. Proprio qui sta il suo fascino: non c’e un unico “colpo di scena”, ce ne sono molti, distribuiti lungo tutta la giornata.

Anche gli avvisi sono specifici e ricorrenti. Il sito del cammino consiglia di evitare i giorni immediatamente successivi a piogge forti per via di terreno impervio e scivoloso, e in estate suggerisce di non camminare tra le 11 e le 16. La segnaletica combina simboli CAI e segni bianco-azzurri del C3V, ma nel Parco Marturanum puo essere meno evidente: traccia GPX, almeno un litro e mezzo d’acqua e un minimo di senso dell’orientamento non sono opzionali.`,

  "a90e0e77-b83a-4394-8bc8-c9aef821086e": `Nei Simbruini il Monte Autore ha un pregio raro: non chiede una grande quota per farsi ricordare. Da Campo dell’Osso l’anello e una progressione elegantissima tra faggete, valloni ombrosi e balconi naturali che si aprono di colpo sulle montagne del Lazio e dell’Abruzzo. Le relazioni lo descrivono spesso come uno dei giri piu panoramici e completi della zona, e non e difficile capire il motivo gia dopo il primo tratto a mezza costa.

La partenza avviene dal piazzale di Campo dell’Osso, intorno ai 1550 metri, poi il sentiero entra tra sottobosco e faggi, sfiora la Valle Maiura, raggiunge le Vedute e punta alla vetta finale. Alcune descrizioni citano la Fonte degli Scifi o Fossaiola, altre ricordano un acero secolare nel bosco: dettagli diversi, ma concordi nel raccontare un percorso che alterna ombra, aperture sulla Valle del Simbrivio e una salita finale piu ripida ma breve. In cima lo sguardo corre lontano: Terminillo, Velino, Gran Sasso, Monte Viglio e le catene abruzzesi tornano in quasi tutte le testimonianze.

Dal punto di vista pratico e un’escursione di difficolta E, ben segnata ma non da prendere alla leggera se il fondo e umido. Dopo pioggia alcune pietraie possono essere scivolose, e in inverno neve e ghiaccio cambiano completamente il carattere del giro. In giornate affollate Campo dell’Osso si riempie presto: meglio arrivare presto, portare acqua e sfruttare autunno o tarda primavera, che sono i periodi piu lodati per colori e visibilita.`,

  "5d66d24a-bda3-4798-bf54-5494ee6c57b1": `Sul Gran Sasso ci sono cime che intimoriscono gia dal nome, e poi c’e Monte Aquila, che sembra quasi una salita introduttiva ma regala un ambiente di alta montagna autentico fin dai primi minuti. Da Campo Imperatore il sentiero parte accanto all’osservatorio e all’albergo rosso, piega verso il Duca degli Abruzzi e poi taglia il versante fino alla Sella di Monte Aquila: da li in avanti il paesaggio si fa tutto cielo, detrito e pareti immense.

Le fonti concordano su una cosa: e una gita semplice rispetto ad altri itinerari del massiccio, ma mai banale. Il percorso attraversa la sella a circa 2335 metri, guarda da vicino Campo Pericoli, Pizzo Cefalone e la bastionata del Corno Grande, poi risale la cresta finale fino alla vetta, segnata da una croce rossa. Il panorama e il vero premio: altopiano di Campo Imperatore sotto i piedi, pareti del Corno Grande davanti, e nelle giornate piu nitide persino l’Adriatico all’orizzonte. L’albergo stesso aggiunge una nota storica forte, per il ruolo avuto nel 1943 durante la prigionia di Mussolini.

Va pero scelta la giornata giusta. D’estate molti escursionisti segnalano affollamento gia dalla sella e limiti all’accesso in auto fino all’albergo, con sbarra o parcheggi piu bassi: conviene informarsi prima e partire presto. In inverno la traccia estiva entra in terreno da neve e rischio valanghe, quindi non va affrontata come se fosse una passeggiata. Anche a luglio, vento, freddo e quota chiedono giacca, acqua e scarpe serie.`,

  "cc206e4b-1b6f-4a55-a155-a62a0f12365f": `A Cerveteri succede una cosa insolita: un percorso che potrebbe vivere di sola archeologia decide invece di infilarsi nelle forre, seguire l’acqua e diventare quasi un canyon etrusco. L’anello delle cascate e della Banditaccia e uno di quei giri che all’inizio sembrano facili da classificare, poi accumulano dettagli: tombe monumentali, vie cave, ruderi industriali, guadi e cinque salti d’acqua nello stesso giorno.

Le relazioni piu complete fanno partire il giro dal parcheggio della Necropoli della Banditaccia o dal cimitero nuovo, con discesa verso il Fosso Vaccina e una sequenza di tappe molto concrete: le antiche Ferriere, la cascata del Vaccinello, quella dell’Arenile, Braccio di Mare con la sua pozza chiarissima, l’Ospedaletto e la Mola o Castel Giuliano. Il rientro passa in alcuni casi per il Ponte degli Austriaci, per tratti basolati e soprattutto per la Via degli Inferi, il corridoio scavato nel tufo che riconduce alla necropoli UNESCO. Il contrasto tra il silenzio delle tombe etrusche e l’umidita delle forre e la parte piu bella del giro.

Gli avvisi pratici qui contano davvero. Piu fonti insistono sui guadi, facili con acqua bassa ma molto meno simpatici dopo piogge recenti, e sul fondo che alterna sterrato, roccia, fango e foglie. In estate il caldo resta addosso nelle gole; dopo i temporali possono esserci detriti e portata maggiore del torrente. Scarpe impermeabili o almeno un cambio, e tempo sufficiente per visitare anche la Banditaccia, fanno la differenza.`,

  "23113f24-ba2b-4bc2-8cf4-329b29487616": `Ci sono montagne che danno il meglio guardando altre montagne; il Monte Redentore, invece, guarda il mare. Ed e questo il suo colpo di scena: sali su roccia bianca, macchia mediterranea e pendii assolati degli Aurunci, e a ogni curva il Golfo di Gaeta si allarga di piu, fino a diventare il vero sfondo della giornata. Non sorprende che venga raccontato spesso come uno dei trekking piu spettacolari del Lazio meridionale.

Dal Rifugio Pornito si segue la celebre “strada della statua”, il tracciato costruito per portare in cima il Cristo bronzeo posto sul Redentore nel 1900. Il sentiero CAI 960 attraversa pietraie aperte, passa sotto la Roccia Laolatra, dove vengono segnalati gheppi e falchi pellegrini, e raggiunge l’Eremo di San Michele Arcangelo, incastonato nella roccia e noto anche per la piccola sorgente interna. Poi si sale verso Sella Sola e alla cupola sommitale, da cui le fonti parlano sempre dello stesso orizzonte: Capri, Ischia, Ponza, Ventotene, il Circeo, il Vesuvio e la costa da Gaeta a Scauri. Persino la storia della statua e curiosa: un fulmine, poco dopo l’inaugurazione, ne danneggio la testa.

Il tratto meridionale e quasi senza ombra, e questo e il primo vero avviso pratico: in estate va affrontato molto presto e con acqua abbondante. Se si chiude l’anello dalla faggeta, la discesa finale puo essere ripida, rocciosa e un po insidiosa se umida. Con neve o gelate gli Aurunci cambiano faccia: non e piu il giro panoramico “facile” che sembra dalle foto.`,

  "2cacb1f6-da35-4386-858e-ef45dcea5406": `Il Pratone del Monte Gennaro ha qualcosa di inatteso per chi arriva dai boschi dei Lucretili: dopo il sottobosco chiuso, il sentiero sbuca in un enorme pianoro carsico dove cavalli e mucche al pascolo fanno sembrare la montagna molto piu lontana da Roma di quanto sia davvero. E questo il cuore del percorso: non tanto la fatica, che nel tuo anello resta moderata, ma il passaggio da una faggeta severa a uno spazio aperto e quasi pastorale.

Le descrizioni piu affidabili fanno partire il giro da Prato Favale, seguendo il 303 e altri sentieri locali dentro la Valle Cavalera. Si cammina su greti sassosi, tratti di faggeta e radure che precedono il Pratone, spesso raccontato come un prato lungo quasi un chilometro, usato da secoli per la transumanza. Alcune fonti citano anche Fonte Campitello e, per chi prosegue oltre, il sentiero verso la cima del Gennaro; ma gia senza la vetta il giro ha due o tre immagini che restano: il bosco di faggi, i cordoli di pietra che aiutano a ritrovare la prosecuzione del sentiero oltre il prato e la vista lontana verso il Soratte, Roma e l’Appennino centrale.

I punti critici sono piu di orientamento che tecnici. Vari escursionisti segnalano che l’uscita dal pratone e il successivo imbocco non sempre sono immediati, soprattutto se la traccia e poco battuta. Il fondo e spesso sassoso e sconnesso, quindi scarpe da trekking vere aiutano piu del previsto. Acqua da portare, rispetto per il bestiame al pascolo e attenzione al fango dopo pioggia.`,

  "ab98c239-ae5b-4643-8247-2ff6275213f6": `La Via degli Dei inizia in centro a Bologna, ma non parte davvero finche non si arriva all’Arco del Meloncello e il portico di San Luca comincia a tirare su, gradino dopo gradino, fuori dalla citta. E una partenza bellissima perche racconta subito il senso del cammino: non una fuga improvvisa nel bosco, ma una transizione lenta, quasi teatrale, dall’urbanita ai primi rilievi appenninici.

La tappa tocca luoghi molto riconoscibili. Da Piazza Maggiore si passa per via d’Azeglio, davanti alla casa di Lucio Dalla, poi su via Saragozza fino al portico piu lungo del mondo e al Santuario della Beata Vergine di San Luca. Dopo la discesa verso Casalecchio, il tracciato ufficiale e stato in parte adattato negli ultimi anni per frane e piogge, con varianti consigliate in zona Bregoli e Parco Talon. Più avanti si segue il Reno, si sfiora l’Oasi di San Gherardo con fontanella e birdwatching, si passa nei pressi di Palazzo de’ Rossi e delle Ganzole, poi si sale verso Prati di Mugnano e Badolo, con l’ultimo tratto che fa gia capire che la Via degli Dei non sara mai una semplice passeggiata.

Il consiglio pratico e semplice ma importante: rifornirsi a Bologna, perche gli ultimi negozi comodi sono proprio prima di imboccare via Saragozza. In caso di pioggia alcuni tratti su sentiero diventano fangosi e il sito ufficiale raccomanda varianti precise; conviene partire informati e con GPX aggiornata. Anche se e la “prima”, supera i venti chilometri e non va presa con leggerezza.`,

  "bcd47247-a577-4317-b850-d70e87409901": `Se la prima tappa della Via degli Dei ti accompagna dentro il cammino, la seconda ti chiede se fai sul serio. Badolo-Madonna dei Fornelli e lunga, discontinua e molto piu montana di quanto facciano immaginare i nomi dei paesi: sale, scende, riparte e poi ti rimette subito al lavoro. Tra i camminatori e considerata una delle giornate decisive dell’intero itinerario.

Si esce da Badolo tra boschi di querce e roverelle, si gira attorno a Monte del Frate e si passa vicino al Centro Tutela e Ricerca Fauna Esotica e Selvatica di Monte Adone, dove diverse descrizioni ricordano persino il ruggito dei leoni provenire dall’area faunistica. Poco dopo una fontanella segna il bivio che porta alla salita di Monte Adone, breve ma intensa, con uno dei panorami piu celebrati di tutta la Via degli Dei e un libro di vetta citato in piu racconti. La discesa porta a Brento, comodo per una sosta, poi il cammino riparte verso Monterumici e Monzuno. Da li la giornata non e ancora chiusa: tra castagneti, cancelletti, il ripetitore Telecom e il piccolo parco eolico di Monte Galletto, si arriva finalmente a Madonna dei Fornelli.

Gli avvisi pratici qui sono concreti. Il sito ufficiale segnala periodicamente sistemazioni o piccole varianti tra Monterumici e Monzuno, quindi la traccia va controllata prima di partire. Acqua, bar e servizi esistono ma non ovunque: Brento e Monzuno sono i punti chiave. Con caldo forte e zaino pesante e facile partire troppo allegri e pagarlo nel finale.`,

  "a1670985-bb76-4ff2-800e-e496fe512c41": `La terza tappa della Via degli Dei e quella in cui il cammino smette di essere solo appenninico e diventa anche storico. Da Madonna dei Fornelli al Passo della Futa si cammina infatti sopra e accanto alla Flaminia Militare, la strada romana del 187 a.C. che qui affiora in piu punti come un basolato sorprendentemente vivo, quasi fosse rimasto in attesa dei camminatori giusti.

Il tracciato segue il CAI 019 verso Pian di Balestra, entra nel bosco dopo piccoli cancelli da richiudere e tocca luoghi che ritornano in quasi tutte le descrizioni: la Piana degli Ossi con i resti di sei antiche fornaci, il laghetto artificiale, la radura delle Banditacce e il Poggiaccio, considerato simbolicamente a meta strada tra Bologna e Firenze. Poi arrivano altri tratti di basolato romano, Poggio Castelluccio con la possibile deviazione al castelliere ligure, e infine la discesa verso la SS65. Il finale passa per il grande Cimitero Germanico della Futa, uno dei luoghi piu carichi di memoria dell’intero cammino.

E una tappa bellissima ma richiede attenzione ai dettagli: in alcuni punti il sito ufficiale segnala bivi non intuitivi, soprattutto dopo stradelli e cancelli nel bosco. Nei fine settimana il passo e rumoroso per moto e auto, quindi l’arrivo non e sempre contemplativo come si vorrebbe. Acqua nello zaino, occhi sui segni CAI e, se il fondo e umido, un po di prudenza in piu sui lastricati antichi che possono diventare scivolosi.`,

  "ffef4196-97fc-48a1-a4cf-ac53440bd497": `Dal Passo della Futa a San Piero a Sieve la Via degli Dei cambia tono ancora una volta. Dopo i boschi alti e la memoria della Futa, il cammino si distende sul crinale, si allarga sui panorami del Mugello e poi comincia a perdere quota in una discesa lunga che, a tratti, si sente tutta nelle gambe. Non e la tappa piu dura in salita, ma e una di quelle che insegnano a dosare bene il passo.

I punti forti sono molto precisi. Si raggiunge il crinale di Monte Gazzaro lungo il CAI 00, in un tratto che coincide anche con il Sentiero Italia, e si arriva alla Croce di Monte Gazzaro, recentemente ripristinata e illuminata, con tavoli in pietra e un piccolo “portale” sul confine tra comuni. Poco oltre c’e il Passo dell’Osteria Bruciata, che la tradizione locale lega a una locanda sinistra e cannibalesca, una di quelle storie che fanno subito rallentare. La discesa prosegue verso Riarsiccio, Sant’Agata del Mugello con la sua pieve antica e, per chi sceglie la variante, il Convento di Bosco ai Frati dove e custodito un Cristo ligneo attribuito a Donatello, prima di chiudere verso San Piero.

Le fonti ufficiali mettono in guardia su un punto preciso: il tratto di crinale verso Monte Gazzaro e sconsigliato con maltempo, e la discesa puo essere stretta e molto scivolosa. Gli ultimi chilometri vanno scelti con criterio, perche esistono deviazioni e varianti; seguire la traccia ufficiale e meglio che improvvisare su strade piu veloci ma meno sicure.`,

  "bc6f6e5d-14be-48eb-b8cf-1c646bd793c1": `La quinta tappa della Via degli Dei ha un sapore diverso dalle precedenti: meno aspra, piu toscana, quasi già proiettata verso Firenze. Ma attenzione a non sottovalutarla, perche i saliscendi del Mugello sanno essere subdoli e, quando il sole picchia sugli ulivi e sulle strade bianche, la giornata si allunga piu del previsto. E una tappa elegante, fatta di ville, santuari e orizzonti che si aprono lentamente.

Da San Piero a Sieve si passa accanto alla Fortezza Medicea di San Martino, enorme anche se non sempre visitabile, poi si sale verso il Castello del Trebbio, uno dei luoghi simbolo del paesaggio mediceo. Lungo il percorso compaiono tabernacoli seicenteschi, campi, case coloniche e panorami continui sul Mugello. Dopo Tagliaferro il sentiero rientra nel bosco e punta verso Camporomano, la Badia del Buonsollazzo e soprattutto Monte Senario, dove il convento dei Servi di Maria e tappa classica di sosta e ristoro. L’ultima parte verso Vetta le Croci corre in una distesa aperta di campi: molte guide lo segnalano come il punto in cui, se l’aria e limpida, si intravedono gia Fiesole e Firenze.

Qui gli avvisi pratici riguardano soprattutto esposizione e logistica. Nei tratti aperti c’e poca ombra, quindi acqua e protezione solare servono davvero. Se si pernotta a Bivigliano o Olmo, bisogna leggere bene le varianti ufficiali per gli ultimi chilometri: non e una tappa da fare “a memoria”. Dopo piogge abbondanti, alcuni segmenti di bosco possono essere fangosi.`,

  "3eedf593-5c51-4c95-b223-ebff4107696e": `L’ultima giornata della Via degli Dei ha il sapore strano degli arrivi riusciti: non e ancora citta, ma non e piu pieno Appennino. Da Vetta le Croci si sale appena verso Poggio Pratone e poi si comincia a scendere, sapendo che da qualche parte davanti c’e gia Firenze. E una tappa piu breve e piu leggera altimetricamente, ma emotivamente ha dentro tutto il cammino.

Il percorso segue il CAI 2 verso Poggio Pratone, poi scende su sterrata fino a Monte Fanna e alla frazione di Borgunto, entrando infine a Fiesole da Piazza Mino. E qui che molti rallentano davvero: Fiesole merita una sosta per la zona archeologica etrusco-romana, per la pieve, per il panorama sulla conca fiorentina. Da quel punto, le fonti ufficiali propongono tre chiusure: autobus 7 fino a Firenze, itinerario escursionistico via Monte Ceceri, cave di Maiano, Settignano e Coverciano, oppure la panoramica Via Vecchia Fiesolana. In piu c’e la variante del Sentiero di Stilicone, legata alla battaglia del 405 d.C. contro gli Ostrogoti e al toponimo di Vetta le Croci.

Il consiglio piu utile e non avere fretta di “finire”. Gli ultimi chilometri possono diventare confusi se si improvvisa tra mezzi pubblici e discesa a piedi, quindi conviene decidere prima come entrare a Firenze. Se si sceglie l’asfalto, con caldo forte la discesa puo risultare piu pesante del previsto. Un po di acqua da tenere fino a Fiesole resta una buona idea, anche nell’ultimo giorno.`,

  "cc642248-4e82-4607-9a22-a5f2034b007a": `Nel Cammino dei Briganti questa e la tappa del ritorno, ma non ha nulla di malinconico: da Casale Le Crete a Sante Marie si rientra attraverso paesi minuscoli, sterrate panoramiche e ruderi che sembrano usciti da una storia di frontiera. E il tratto finale di un anello nato sulle tracce della banda di Cartore e di un Appennino di confine, dove Abruzzo e Cicolano si guardano ancora da vicino.

Le fonti del cammino e le schede escursionistiche convergono sugli stessi passaggi. Dalla localita Le Crete, che non e un vero paese ma un casale isolato, si cammina su stradelli panoramici fino a San Donato; da li si sale ai ruderi di un antico castello, uno dei punti piu caratteristici della giornata. Poi si scende verso Scanzano, si prosegue per Tubione e si rientra a Sante Marie, dove il cammino chiude idealmente il cerchio e si puo ritirare l’attestato. Il paesaggio e quello delle quote medie del cammino dei Briganti, tra gli 800 e i 1300 metri: campagna alta, paesi appesi e continui scorci sulla Marsica.

Non e una tappa tecnica, ma non va banalizzata. La lunghezza supera i venti chilometri e diverse fonti parlano di saliscendi costanti, con tratti assolati in cui l’acqua va gestita bene. In caso di nebbia o meteo chiuso, i panorami aiutano meno a orientarsi e la GPX diventa preziosa. Dopo piogge forti alcune sterrate possono appesantirsi; meglio partire con scarpe da trekking vere e non aspettare l’ultimo momento per cercare ristoro nei borghi piu piccoli.`,
};

function assertLength(id, text) {
  const n = [...text].length;
  if (n < 1000 || n > 1500) {
    console.warn(`ID ${id}: lunghezza ${n} (atteso 1000–1500)`);
  }
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

try {
  for (const [id, description] of Object.entries(descriptionsById)) {
    assertLength(id, description);
    await pool.query("UPDATE trails SET description = $2 WHERE id = $1", [id, description]);
  }

  const check = await pool.query(
    `SELECT name, char_length(description) AS len
     FROM trails
     WHERE id = ANY($1::uuid[])
     ORDER BY name`,
    [Object.keys(descriptionsById)]
  );
  console.log(JSON.stringify(check.rows, null, 2));
} finally {
  await pool.end();
}
