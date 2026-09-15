# EasyWiel websitebot — veilige technische opzet

## Eerste versie

De bot bestaat uit twee delen:

1. Een **kleine openbare chatwidget** die in EasyWiel Shopify wordt geplaatst.
2. Een **tenantgebonden serverlaag in Main AI Agency** die AI-antwoorden maakt, gesprekshistorie beheert en toestemming-gebaseerde leads opslaat.

De widget heeft geen toegang tot providersecrets, beheerdersfuncties of andere organisaties.

## Verzoekstroom

```text
Bezoeker op easywiel.nl
  -> openbare chatwidget
  -> rate-limited publieke chatprocedure
  -> EasyWiel-kennisbasis + server-side OpenAI
  -> antwoord met duidelijke begrenzing
  -> optionele toestemming voor lead
  -> tenantgebonden leadrecord in Main AI Agency
  -> beheerder volgt lead op in Main AI Agency
```

## OpenAI-grens

De `OPENAI_API_KEY` komt alleen in de beveiligde serverconfiguratie. Main AI Agency stuurt deze sleutel nooit naar de browser, slaat hem niet in de database op en toont uitsluitend de status **“servertoegang beschikbaar”** in het beheerscherm.

Voor versie 1 gebruikt de bot een vaste, goedgekeurde systeeminstructie met de EasyWiel-kennisbasis. Iedere wijziging in die instructie of in toegestane antwoordonderwerpen loopt via de bestaande governanceflow en audittrail.

## Publieke veiligheid

De publieke procedure moet per sessie/IP een limiet toepassen, invoer op maximale lengte begrenzen en geen interne fouten teruggeven. De bot mag alleen publieke EasyWiel-informatie verwerken. Contactgegevens worden pas geaccepteerd na een expliciete toestemmingsactie.

## Leadrecord

Een lead krijgt minimaal deze velden:

| Veld | Doel |
|---|---|
| Organisatie | Isolatie: de lead behoort uitsluitend aan EasyWiel. |
| Type | Aankoop, fleet, service of algemene vraag. |
| Naam en e-mail | Alleen na toestemming voor menselijke opvolging. |
| Telefoonnummer | Optioneel. |
| Vraag en samenvatting | Context voor de medewerker. |
| Toestemmingstijdstip | Bewijs dat de bezoeker toestemming gaf voor opvolging. |
| Status | Nieuw, in behandeling, opgevolgd of gesloten. |

## Shopify-plaatsing

Na implementatie leveren we één klein widgetscript met een publieke widget-ID. Dit wordt via Shopify onder **Online Store → Themes → Customize → App embeds** of via een gecontroleerd theme-snippet geplaatst. De exacte plaatsing gebeurt pas na functionele acceptatietest in Main AI Agency.

## Bewuste grenzen voor versie 1

De bot verstuurt geen e-mail, plaatst geen bestelling, verwerkt geen betaling, doet geen individuele wettelijke of verzekeringsuitspraken en neemt geen autonome commerciële beslissingen. Leadopvolging blijft bij een medewerker.
