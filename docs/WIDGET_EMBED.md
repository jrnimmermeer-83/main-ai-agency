# EasyWiel-widget inbedden

## Veilige identificatie

De browser krijgt **alleen een publieke widget-ID**. Een browserzichtbare organisatie-ID is bewust niet onderdeel van de embedcode: een bezoeker kan die waarde veranderen, maar mag daarmee nooit een andere tenant kunnen kiezen. De server zoekt de widget op via zijn unieke publieke ID, valideert de herkomstpagina tegen de opgeslagen origin-allowlist, en leidt daarna de organisatie uitsluitend **server-side** af uit de gevonden widget.

> Een widget-ID is een publieke locator, geen toegangssleutel. Het geeft geen toegang tot beheerfuncties, providercredentials, organisatiegegevens of andere widgets.

## Inbedcode

Na het aanmaken van een widget verschijnt in Main AI Agency een specifieke iframe-code. Plaats die in Shopify via een **Custom Liquid**-sectie of een gecontroleerd theme-snippet. De code heeft deze vorm:

```html
<iframe
  title="EasyWiel Assistent"
  src="https://JOUW-MAIN-AI-AGENCY-DOMEIN/widget/ew_PUBLIEKE_WIDGET_ID?sourceUrl=https%3A%2F%2Feasywiel.nl"
  style="position:fixed;right:20px;bottom:20px;width:380px;height:620px;border:0;z-index:9999"
  loading="lazy">
</iframe>
```

De `sourceUrl` wordt door de server gevalideerd op zijn origin (`https://easywiel.nl`). Een embed op een ander domein wordt geweigerd. De widget doet maximaal 20 chatverzoeken per sessie per uur en kan contactgegevens uitsluitend opslaan wanneer de bezoeker zelf een toestemming-vakje aanvinkt.

## Controle vóór live plaatsing

1. Maak de widget in Main AI Agency aan.
2. Open de testlink in een browser en controleer de startvragen, fouttoestand en toestemmingsformulier.
3. Dien één testlead met toestemming in en verifieer dat die alleen in de juiste lead-inbox zichtbaar is.
4. Plaats de code in een niet-gepubliceerd Shopify-thema en test op desktop en mobiel.
5. Publiceer pas na een positieve functionele test op easywiel.nl.
