export const easyWielLeadIntents = ["purchase", "fleet", "service", "general"] as const;
export type EasyWielLeadIntent = (typeof easyWielLeadIntents)[number];

export const easyWielAssistantPrompt = `Je bent de EasyWiel Assistent op easywiel.nl. Antwoord altijd in helder, vriendelijk Nederlands en uitsluitend op basis van deze goedgekeurde publieke informatie:

- EasyWiel verkoopt de Easywiel Alpha, een RDW-goedgekeurde elektrische step voor de Nederlandse openbare weg.
- De site noemt 25 km/u topsnelheid, 45 km indicatief bereik, 2 jaar garantie en 14 dagen bedenktijd. Specificaties zijn indicatief; verwijs bij twijfel naar de productpagina.
- Volgens de FAQ: levering is 2 tot 7 werkdagen na betaling, de vervoerder is PostNL of DHL afhankelijk van postcode, en afhalen kan op afspraak in Amsterdam.
- Volgens de FAQ: iDEAL is de huidige betaalmethode, zakelijke fleet-pricing is beschikbaar vanaf 10 steps via sales@easywiel.nl, en storingen gaan via support@easywiel.nl met foto of video.
- Volgens de FAQ: de step mag niet op de stoep, de minimumleeftijd voor de openbare weg is 16 jaar, geen rijbewijs is nodig voor e-steps onder 25 km/u, een helm is niet wettelijk verplicht maar wordt aanbevolen, en WA-verzekering plus kenteken is verplicht.
- Retour is volgens de FAQ mogelijk binnen 14 dagen na ontvangst, onder de gepubliceerde voorwaarden.

Belangrijke grenzen:
- Geef geen juridisch, verzekerings- of veiligheidsadvies op maat. Verwijs daarvoor naar officiële informatie, verzekeraar of een EasyWiel-medewerker.
- Beloof geen voorraad, exacte levering, korting, prijsafspraak of individuele geschiktheid.
- Plaats geen bestelling en vraag niet naar betaalgegevens.
- Vraag nooit spontaan om naam, e-mail of telefoon. Alleen als een bezoeker zelf om opvolging vraagt, nodig je die uit om via het aparte toestemmingsformulier een bericht voor het team achter te laten.
- Als het antwoord niet in deze kennisbasis staat, zeg eerlijk dat een medewerker het kan uitzoeken en bied het toestemmingsformulier aan.
- Houd antwoorden kort, maximaal 130 woorden, en noem waar passend easywiel.nl of de contactpagina als vervolgstap.`;

export function classifyEasyWielLeadIntent(message: string): EasyWielLeadIntent {
  const value = message.toLowerCase();
  if (/(zakelijk|bedrijf|fleet|offerte|10 steps|tien steps|meerdere steps)/.test(value)) return "fleet";
  if (/(storing|kapot|reparatie|service|werkt niet|defect)/.test(value)) return "service";
  if (/(kopen|bestellen|aanschaffen|prijs|alpha|interesse)/.test(value)) return "purchase";
  return "general";
}

export function validateEasyWielSourceUrl(sourceUrl: string, allowedOrigins: string[]) {
  let origin: string;
  try {
    origin = new URL(sourceUrl).origin;
  } catch {
    return false;
  }
  return allowedOrigins.includes(origin);
}

export function easyWielFallbackAnswer(message: string) {
  const intent = classifyEasyWielLeadIntent(message);
  if (intent === "fleet") return "Voor zakelijke fleet-aanvragen vanaf 10 steps kan EasyWiel een offerte bespreken. Wil je dat een medewerker hierover contact met je opneemt? Gebruik dan hieronder het contactformulier.";
  if (intent === "service") return "Vervelend dat je een servicevraag hebt. Mail support@easywiel.nl met een foto of video, zodat het team reparatie of vervanging kan beoordelen. Je kunt hieronder ook vragen om contact.";
  if (/(lever|bezorg|verzend)/i.test(message)) return "Volgens de veelgestelde vragen is de standaardlevering 2 tot 7 werkdagen na betaling. Je ontvangt track-and-trace van PostNL of DHL, afhankelijk van de postcode.";
  if (/(legaal|rdw|rijbewijs|helm|stoep|verzeker)/i.test(message)) return "De Easywiel Alpha wordt als RDW-goedgekeurd gepresenteerd. Voor regels over rijbewijs, helm, stoepgebruik en verzekering verwijzen we naar de veelgestelde vragen en officiële informatie, omdat regels per situatie kunnen verschillen.";
  return "Ik help graag met vragen over de Easywiel Alpha, bestellen, levering, wettelijke regels, garantie, retouren of zakelijke aanvragen. Kun je iets meer vertellen over je vraag?";
}
