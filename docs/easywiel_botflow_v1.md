# EasyWiel websitebot — eerste werkbare flow

## Doel

De eerste bot helpt websitebezoekers snel met **betrouwbare product- en bestelvragen** en herkent wanneer een bezoeker een aankoop, zakelijke fleet-aanvraag of serviceverzoek wil opvolgen. De bot vervangt geen medewerker, juridische bron of verzekeringsadviseur.

## Startbericht

> Welkom bij EasyWiel. Ik help je graag met vragen over de Alpha, bestellen, levering, wetgeving of service. Waar wil je meer over weten?

De bot toont daarnaast drie korte keuzes: **“Is de Alpha legaal?”**, **“Ik wil kopen”** en **“Zakelijk / fleet”**.

## Gespreksroutes

| Bezoekersintentie | Eerste antwoord van de bot | Vervolgactie |
|---|---|---|
| Product- of wettelijke vraag | Antwoord uitsluitend vanuit de goedgekeurde EasyWiel-kennisbasis, met een link naar relevante pagina bij een belangrijke claim. | Vraag of de bezoeker nog hulp nodig heeft. |
| Aankoopinteresse | Benoem de Alpha en verwijs naar product of winkelmand. Geen persoonlijke lever- of prijsbelofte. | Bied aan om een vraag door te geven aan het team. |
| Zakelijk of fleet | Leg uit dat EasyWiel volgens de FAQ fleet-pricing vanaf 10 steps behandelt. | Vraag met toestemming om naam, zakelijk e-mailadres, aantal steps en toelichting. |
| Service of storing | Vraag niet om gevoelige gegevens; verwijs naar support@easywiel.nl en vraag om foto/video via de bestaande supportroute. | Maak optioneel een servicelead met korte samenvatting. |
| Onbekend, medisch, juridisch of verzekering | Zeg duidelijk dat de bot dit niet betrouwbaar kan beoordelen. | Verwijs naar een medewerker of officiële voorwaarden/verzekeraar. |

## Leadopvang met toestemming

De bot mag pas contactgegevens vragen nadat de bezoeker uitdrukkelijk heeft gekozen voor opvolging. De tekst voor die keuze is:

> Wil je dat een EasyWiel-medewerker hierover contact met je opneemt? Met jouw toestemming slaan we je naam, e-mailadres en je vraag op om dit verzoek op te volgen.

De minimale gegevens zijn naam, e-mailadres, type vraag en gesprekssamenvatting. Een telefoonnummer is optioneel. De bot vermeldt dat gegevens alleen voor dit verzoek worden gebruikt en toont na verzending een bevestiging.

## Niet doen in versie 1

De bot mag geen bestelling plaatsen, betaling verwerken, korting toezeggen, individuele verzekeringsadviezen geven, juridische conclusies trekken, actuele voorraad beloven, wijzigingen uitvoeren of zelf contact opnemen met een bezoeker. Hij registreert alleen een toestemming-gebaseerde lead voor menselijke opvolging.

## Voorbeeld: zakelijke lead

> **Bezoeker:** Wij zoeken 15 steps voor ons bedrijf.
>
> **Bot:** Voor zakelijke fleet-aanvragen vanaf 10 steps kan EasyWiel een offerte bespreken. Wil je dat het team contact met je opneemt? Met jouw toestemming sla ik je naam, zakelijke e-mailadres, gewenste aantal en vraag op.
>
> **Bezoeker:** Ja.
>
> **Bot:** Dank je. Wat is je naam, zakelijke e-mailadres en voor hoeveel steps wil je een voorstel?
