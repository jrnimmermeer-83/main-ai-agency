import { describe, expect, it } from "vitest";
import { classifyEasyWielLeadIntent, easyWielFallbackAnswer, validateEasyWielSourceUrl } from "./easywielBot";

describe("EasyWiel Assistent", () => {
  it("classificeert aankoop-, fleet-, service- en algemene vragen", () => {
    expect(classifyEasyWielLeadIntent("Ik wil de Alpha kopen")).toBe("purchase");
    expect(classifyEasyWielLeadIntent("Wij zoeken 15 steps voor ons bedrijf")).toBe("fleet");
    expect(classifyEasyWielLeadIntent("Mijn step werkt niet meer")).toBe("service");
    expect(classifyEasyWielLeadIntent("Hoe werkt de garantie?")).toBe("general");
  });

  it("accepteert alleen een exacte toegestane widgetherkomst", () => {
    expect(validateEasyWielSourceUrl("https://easywiel.nl/products/alpha", ["https://easywiel.nl"])).toBe(true);
    expect(validateEasyWielSourceUrl("https://www.easywiel.nl", ["https://easywiel.nl"])).toBe(false);
    expect(validateEasyWielSourceUrl("https://other.example/?source=https://easywiel.nl", ["https://easywiel.nl"])).toBe(false);
    expect(validateEasyWielSourceUrl("geen-url", ["https://easywiel.nl"])).toBe(false);
  });

  it("geeft bij uitval veilige antwoorden zonder bestelling, betaling of persoonlijke verzekeringstoezegging", () => {
    const answer = easyWielFallbackAnswer("Kan ik een korting krijgen en nu bestellen?");
    expect(answer).toMatch(/Easywiel Alpha|vragen/i);
    expect(answer).not.toMatch(/betaal nu|korting van/i);
  });
});
