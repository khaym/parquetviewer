import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { parseInputValue } from "../../webview/src/components/EditableCell";
import { validateCellValue } from "../validation";
import type { ParquetPrimitiveType } from "../types";

// ── parseInputValue → validateCellValue round-trip ─────────────
// If parseInputValue produces a value, does it pass validation?

describe("parseInputValue — property-based", () => {
  it("empty string on numeric type returns 0 (Number('') === 0)", () => {
    const parsed = parseInputValue("", "INT32");
    expect(parsed).toBe(0);
  });

  it("empty string on string type returns empty string", () => {
    const parsed = parseInputValue("", "UTF8");
    expect(parsed).toBe("");
  });

  it("integer strings parse to valid INT32 values", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -2147483648, max: 2147483647 }),
        (n) => {
          const parsed = parseInputValue(String(n), "INT32");
          expect(typeof parsed).toBe("number");
          const result = validateCellValue(
            { name: "test", type: "INT32", nullable: false },
            parsed,
          );
          expect(result.success).toBe(true);
        },
      ),
    );
  });

  it("decimal strings for INT32 produce non-integer (validation should catch)", () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, noDefaultInfinity: true, min: 0.01, max: 100 }).filter(
          (n) => !Number.isInteger(n),
        ),
        (n) => {
          const parsed = parseInputValue(String(n), "INT32");
          const result = validateCellValue(
            { name: "test", type: "INT32", nullable: false },
            parsed,
          );
          expect(result.success).toBe(false);
        },
      ),
    );
  });

  it("any string passes through for UTF8 and is valid", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const parsed = parseInputValue(s, "UTF8");
        // Empty string on non-nullable: parseInputValue returns "" (not null)
        if (s === "") {
          expect(parsed).toBe("");
        } else {
          expect(typeof parsed).toBe("string");
        }
        const result = validateCellValue(
          { name: "test", type: "UTF8", nullable: false },
          parsed,
        );
        expect(result.success).toBe(true);
      }),
    );
  });

  it("INT64 strings pass through and valid bigint strings are accepted", () => {
    fc.assert(
      fc.property(fc.bigInt(), (n) => {
        const input = String(n);
        const parsed = parseInputValue(input, "INT64");
        expect(parsed).toBe(input); // string pass-through
        const result = validateCellValue(
          { name: "test", type: "INT64", nullable: false },
          parsed,
        );
        expect(result.success).toBe(true);
      }),
    );
  });

  it("non-numeric strings for INT32 produce NaN", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => s.length > 0 && isNaN(Number(s))),
        (s) => {
          const parsed = parseInputValue(s, "INT32");
          expect(Number.isNaN(parsed)).toBe(true);
        },
      ),
    );
  });

  it("FLOAT: numeric strings produce valid numbers", () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, noDefaultInfinity: true }),
        (n) => {
          const parsed = parseInputValue(String(n), "FLOAT");
          expect(typeof parsed).toBe("number");
          const result = validateCellValue(
            { name: "test", type: "FLOAT", nullable: false },
            parsed,
          );
          expect(result.success).toBe(true);
        },
      ),
    );
  });
});
