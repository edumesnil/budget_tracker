import { describe, it, expect } from "vitest";
import { buildSchemaPrompt, parseSchemaResponse } from "@/lib/parsers/schema-prompt";

describe("buildSchemaPrompt", () => {
  it("produces system + user messages with sanitized sample", () => {
    const sample = [
      "x:56 Date | x:84 Code | x:196 Description | x:388 Retrait | x:461 Dépôt | x:533 Solde",
      "x:55 2 MAR | x:84 ACH | x:108 [TEXT] | x:412 13.71 | x:543 3 086.83",
    ].join("\n");

    const { system, user } = buildSchemaPrompt(sample);

    expect(system).toContain("column structure");
    expect(system).toContain("JSON");
    expect(user).toContain("x:56 Date");
    expect(user).toContain("[TEXT]");
  });
});

describe("parseSchemaResponse", () => {
  it("parses a valid schema JSON response", () => {
    const raw = JSON.stringify({
      bank_name: "Desjardins",
      statement_type: "chequing",
      columns: {
        date: { x: [50, 80], format: "DD MMM" },
        code: { x: [84, 100] },
        description: { x: [108, 380] },
        withdrawal: { x: [388, 450] },
        deposit: { x: [461, 520] },
        balance: { x: [533, 600] },
      },
      amount_format: "french",
      skip_patterns: ["TOTAL", "SOLDE PRÉCÉDENT"],
      year_source: "header",
      year_pattern: "RELEV.*?(20\\d{2})",
      transfer_codes: ["VFF", "VMW", "VWW"],
      internal_transfer_pattern: "Virement entre folios|Virement - AccèsD",
      external_income_pattern: "Virement (Interac )?de|reçu de",
    });

    const schema = parseSchemaResponse(raw);

    expect(schema).not.toBeNull();
    expect(schema!.bank_name).toBe("Desjardins");
    expect(schema!.columns.date.x).toEqual([50, 80]);
    expect(schema!.columns.withdrawal).toBeDefined();
    expect(schema!.amount_format).toBe("french");
    expect(schema!.transfer_codes).toEqual(["VFF", "VMW", "VWW"]);
  });

  it("parses response wrapped in markdown fences", () => {
    const raw =
      "```json\n" +
      JSON.stringify({
        bank_name: "TD",
        statement_type: "chequing",
        columns: {
          date: { x: [10, 60] },
          description: { x: [70, 300] },
          amount: { x: [310, 400] },
        },
        amount_format: "english",
        skip_patterns: [],
        year_source: "header",
      }) +
      "\n```";

    const schema = parseSchemaResponse(raw);
    expect(schema).not.toBeNull();
    expect(schema!.bank_name).toBe("TD");
  });

  it("returns null for garbage input", () => {
    expect(parseSchemaResponse("not json at all")).toBeNull();
  });

  it("returns null when no amount columns present", () => {
    const raw = JSON.stringify({
      bank_name: "Unknown",
      statement_type: "unknown",
      columns: {
        date: { x: [10, 60] },
        description: { x: [70, 300] },
      },
      amount_format: "english",
      skip_patterns: [],
      year_source: "header",
    });
    expect(parseSchemaResponse(raw)).toBeNull();
  });
});
