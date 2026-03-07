import { describe, it, expect } from "vitest";
import { createColumnValidator, validateCellValue } from "../validation";
import type { ParquetColumnSchema } from "../types";

describe("createColumnValidator", () => {
  // ── String types ──────────────────────────────────────────────

  describe("UTF8", () => {
    const col: ParquetColumnSchema = { name: "name", type: "UTF8", nullable: false };

    it("accepts a valid string", () => {
      const validator = createColumnValidator(col);
      expect(validator.safeParse("hello").success).toBe(true);
    });

    it("rejects a number", () => {
      const validator = createColumnValidator(col);
      expect(validator.safeParse(42).success).toBe(false);
    });

    it("rejects null when not nullable", () => {
      const validator = createColumnValidator(col);
      expect(validator.safeParse(null).success).toBe(false);
    });

    it("accepts null when nullable", () => {
      const nullableCol: ParquetColumnSchema = { ...col, nullable: true };
      const validator = createColumnValidator(nullableCol);
      expect(validator.safeParse(null).success).toBe(true);
    });
  });

  // ── Boolean ───────────────────────────────────────────────────

  describe("BOOLEAN", () => {
    const col: ParquetColumnSchema = { name: "active", type: "BOOLEAN", nullable: false };

    it("accepts true", () => {
      const validator = createColumnValidator(col);
      expect(validator.safeParse(true).success).toBe(true);
    });

    it("accepts false", () => {
      const validator = createColumnValidator(col);
      expect(validator.safeParse(false).success).toBe(true);
    });

    it("rejects a string", () => {
      const validator = createColumnValidator(col);
      expect(validator.safeParse("true").success).toBe(false);
    });
  });

  // ── Integer types ─────────────────────────────────────────────

  describe("INT8", () => {
    const col: ParquetColumnSchema = { name: "val", type: "INT8", nullable: false };

    it("accepts a valid INT8 value", () => {
      const validator = createColumnValidator(col);
      expect(validator.safeParse(0).success).toBe(true);
      expect(validator.safeParse(-128).success).toBe(true);
      expect(validator.safeParse(127).success).toBe(true);
    });

    it("rejects out-of-range values", () => {
      const validator = createColumnValidator(col);
      expect(validator.safeParse(-129).success).toBe(false);
      expect(validator.safeParse(128).success).toBe(false);
    });

    it("rejects floating point", () => {
      const validator = createColumnValidator(col);
      expect(validator.safeParse(1.5).success).toBe(false);
    });
  });

  describe("INT16", () => {
    const col: ParquetColumnSchema = { name: "val", type: "INT16", nullable: false };

    it("accepts valid INT16 range", () => {
      const validator = createColumnValidator(col);
      expect(validator.safeParse(-32768).success).toBe(true);
      expect(validator.safeParse(32767).success).toBe(true);
    });

    it("rejects out-of-range", () => {
      const validator = createColumnValidator(col);
      expect(validator.safeParse(-32769).success).toBe(false);
      expect(validator.safeParse(32768).success).toBe(false);
    });
  });

  describe("INT32", () => {
    const col: ParquetColumnSchema = { name: "val", type: "INT32", nullable: false };

    it("accepts valid INT32 range", () => {
      const validator = createColumnValidator(col);
      expect(validator.safeParse(-2147483648).success).toBe(true);
      expect(validator.safeParse(2147483647).success).toBe(true);
    });

    it("rejects out-of-range", () => {
      const validator = createColumnValidator(col);
      expect(validator.safeParse(-2147483649).success).toBe(false);
      expect(validator.safeParse(2147483648).success).toBe(false);
    });
  });

  describe("INT64", () => {
    const col: ParquetColumnSchema = { name: "val", type: "INT64", nullable: false };

    it("accepts a valid integer as string (for BigInt safety)", () => {
      const validator = createColumnValidator(col);
      expect(validator.safeParse("9223372036854775807").success).toBe(true);
      expect(validator.safeParse("-9223372036854775808").success).toBe(true);
      expect(validator.safeParse("0").success).toBe(true);
    });

    it("rejects non-integer strings", () => {
      const validator = createColumnValidator(col);
      expect(validator.safeParse("abc").success).toBe(false);
      expect(validator.safeParse("1.5").success).toBe(false);
    });
  });

  // ── Unsigned integer types ────────────────────────────────────

  describe("UINT8", () => {
    const col: ParquetColumnSchema = { name: "val", type: "UINT8", nullable: false };

    it("accepts valid UINT8 range", () => {
      const validator = createColumnValidator(col);
      expect(validator.safeParse(0).success).toBe(true);
      expect(validator.safeParse(255).success).toBe(true);
    });

    it("rejects negative values", () => {
      const validator = createColumnValidator(col);
      expect(validator.safeParse(-1).success).toBe(false);
    });

    it("rejects out-of-range", () => {
      const validator = createColumnValidator(col);
      expect(validator.safeParse(256).success).toBe(false);
    });
  });

  describe("UINT16", () => {
    const col: ParquetColumnSchema = { name: "val", type: "UINT16", nullable: false };

    it("accepts valid range", () => {
      const validator = createColumnValidator(col);
      expect(validator.safeParse(0).success).toBe(true);
      expect(validator.safeParse(65535).success).toBe(true);
    });

    it("rejects out-of-range", () => {
      const validator = createColumnValidator(col);
      expect(validator.safeParse(-1).success).toBe(false);
      expect(validator.safeParse(65536).success).toBe(false);
    });
  });

  describe("UINT32", () => {
    const col: ParquetColumnSchema = { name: "val", type: "UINT32", nullable: false };

    it("accepts valid range", () => {
      const validator = createColumnValidator(col);
      expect(validator.safeParse(0).success).toBe(true);
      expect(validator.safeParse(4294967295).success).toBe(true);
    });

    it("rejects out-of-range", () => {
      const validator = createColumnValidator(col);
      expect(validator.safeParse(-1).success).toBe(false);
      expect(validator.safeParse(4294967296).success).toBe(false);
    });
  });

  describe("UINT64", () => {
    const col: ParquetColumnSchema = { name: "val", type: "UINT64", nullable: false };

    it("accepts valid unsigned integer strings", () => {
      const validator = createColumnValidator(col);
      expect(validator.safeParse("0").success).toBe(true);
      expect(validator.safeParse("18446744073709551615").success).toBe(true);
    });

    it("rejects negative strings", () => {
      const validator = createColumnValidator(col);
      expect(validator.safeParse("-1").success).toBe(false);
    });
  });

  // ── Float types ───────────────────────────────────────────────

  describe("FLOAT / DOUBLE", () => {
    const floatCol: ParquetColumnSchema = { name: "val", type: "FLOAT", nullable: false };
    const doubleCol: ParquetColumnSchema = { name: "val", type: "DOUBLE", nullable: false };

    it("accepts integers", () => {
      expect(createColumnValidator(floatCol).safeParse(42).success).toBe(true);
      expect(createColumnValidator(doubleCol).safeParse(42).success).toBe(true);
    });

    it("accepts floating point numbers", () => {
      expect(createColumnValidator(floatCol).safeParse(3.14).success).toBe(true);
      expect(createColumnValidator(doubleCol).safeParse(3.14).success).toBe(true);
    });

    it("rejects strings", () => {
      expect(createColumnValidator(floatCol).safeParse("3.14").success).toBe(false);
      expect(createColumnValidator(doubleCol).safeParse("3.14").success).toBe(false);
    });
  });

  // ── Date / Timestamp types ────────────────────────────────────

  describe("DATE", () => {
    const col: ParquetColumnSchema = { name: "d", type: "DATE", nullable: false };

    it("accepts a valid date string (YYYY-MM-DD)", () => {
      const validator = createColumnValidator(col);
      expect(validator.safeParse("2024-01-15").success).toBe(true);
    });

    it("rejects invalid date format", () => {
      const validator = createColumnValidator(col);
      expect(validator.safeParse("01/15/2024").success).toBe(false);
      expect(validator.safeParse("not-a-date").success).toBe(false);
    });

    it("rejects impossible dates", () => {
      const validator = createColumnValidator(col);
      expect(validator.safeParse("2026-02-30").success).toBe(false);
      expect(validator.safeParse("2026-13-01").success).toBe(false);
      expect(validator.safeParse("2024-04-31").success).toBe(false);
    });

    it("handles leap year correctly", () => {
      const validator = createColumnValidator(col);
      expect(validator.safeParse("2024-02-29").success).toBe(true);  // leap year
      expect(validator.safeParse("2025-02-29").success).toBe(false); // not leap year
    });
  });

  describe("TIMESTAMP_MILLIS", () => {
    const col: ParquetColumnSchema = { name: "ts", type: "TIMESTAMP_MILLIS", nullable: false };

    it("accepts ISO 8601 datetime string", () => {
      const validator = createColumnValidator(col);
      expect(validator.safeParse("2024-01-15T10:30:00Z").success).toBe(true);
      expect(validator.safeParse("2024-01-15T10:30:00.000Z").success).toBe(true);
    });

    it("rejects plain date without time", () => {
      const validator = createColumnValidator(col);
      expect(validator.safeParse("2024-01-15").success).toBe(false);
    });

    it("rejects impossible datetimes", () => {
      const validator = createColumnValidator(col);
      expect(validator.safeParse("2026-02-30T10:00:00Z").success).toBe(false);
      expect(validator.safeParse("2026-13-01T10:00:00Z").success).toBe(false);
    });
  });

  describe("TIMESTAMP_MICROS", () => {
    const col: ParquetColumnSchema = { name: "ts", type: "TIMESTAMP_MICROS", nullable: false };

    it("accepts ISO 8601 datetime string", () => {
      const validator = createColumnValidator(col);
      expect(validator.safeParse("2024-01-15T10:30:00Z").success).toBe(true);
    });
  });

  // ── BYTE_ARRAY ────────────────────────────────────────────────

  describe("BYTE_ARRAY", () => {
    const col: ParquetColumnSchema = { name: "data", type: "BYTE_ARRAY", nullable: false };

    it("accepts a string (displayed as string)", () => {
      const validator = createColumnValidator(col);
      expect(validator.safeParse("binary data").success).toBe(true);
    });
  });

  // ── Nullable ──────────────────────────────────────────────────

  describe("nullable columns", () => {
    it("accepts null for any nullable column type", () => {
      const types: ParquetColumnSchema["type"][] = [
        "BOOLEAN", "INT32", "FLOAT", "UTF8", "DATE",
      ];
      for (const type of types) {
        const col: ParquetColumnSchema = { name: "col", type, nullable: true };
        const validator = createColumnValidator(col);
        expect(validator.safeParse(null).success).toBe(true);
      }
    });

    it("rejects null for any non-nullable column type", () => {
      const types: ParquetColumnSchema["type"][] = [
        "BOOLEAN", "INT32", "FLOAT", "UTF8", "DATE",
      ];
      for (const type of types) {
        const col: ParquetColumnSchema = { name: "col", type, nullable: false };
        const validator = createColumnValidator(col);
        expect(validator.safeParse(null).success).toBe(false);
      }
    });
  });

  // ── Additional gap coverage ──────────────────────────────────

  describe("NaN and Infinity for numeric types", () => {
    it("rejects NaN for integer types", () => {
      const intTypes: ParquetColumnSchema["type"][] = [
        "INT8", "INT16", "INT32", "UINT8", "UINT16", "UINT32",
      ];
      for (const type of intTypes) {
        const col: ParquetColumnSchema = { name: "v", type, nullable: false };
        const validator = createColumnValidator(col);
        expect(validator.safeParse(NaN).success).toBe(false);
      }
    });

    it("rejects NaN for FLOAT", () => {
      const col: ParquetColumnSchema = { name: "v", type: "FLOAT", nullable: false };
      expect(createColumnValidator(col).safeParse(NaN).success).toBe(false);
    });

    it("accepts Infinity for FLOAT (same as DOUBLE)", () => {
      const col: ParquetColumnSchema = { name: "v", type: "FLOAT", nullable: false };
      expect(createColumnValidator(col).safeParse(Infinity).success).toBe(true);
      expect(createColumnValidator(col).safeParse(-Infinity).success).toBe(true);
    });

    it("rejects Infinity for integer types", () => {
      const intTypes: ParquetColumnSchema["type"][] = [
        "INT8", "INT16", "INT32", "UINT8", "UINT16", "UINT32",
      ];
      for (const type of intTypes) {
        const col: ParquetColumnSchema = { name: "v", type, nullable: false };
        const validator = createColumnValidator(col);
        expect(validator.safeParse(Infinity).success).toBe(false);
        expect(validator.safeParse(-Infinity).success).toBe(false);
      }
    });
  });

  describe("undefined value", () => {
    it("rejects undefined for all types", () => {
      const allTypes: ParquetColumnSchema["type"][] = [
        "BOOLEAN", "INT8", "INT16", "INT32", "INT64",
        "UINT8", "UINT16", "UINT32", "UINT64",
        "FLOAT", "DOUBLE", "UTF8", "BYTE_ARRAY",
        "DATE", "TIMESTAMP_MILLIS", "TIMESTAMP_MICROS",
      ];
      for (const type of allTypes) {
        const col: ParquetColumnSchema = { name: "v", type, nullable: false };
        expect(createColumnValidator(col).safeParse(undefined).success).toBe(false);
      }
    });

    it("rejects undefined even for nullable columns (null is ok, undefined is not)", () => {
      const col: ParquetColumnSchema = { name: "v", type: "INT32", nullable: true };
      expect(createColumnValidator(col).safeParse(undefined).success).toBe(false);
    });
  });

  describe("INT64/UINT64 edge cases", () => {
    it("rejects empty string for INT64", () => {
      const col: ParquetColumnSchema = { name: "v", type: "INT64", nullable: false };
      expect(createColumnValidator(col).safeParse("").success).toBe(false);
    });

    it("rejects empty string for UINT64", () => {
      const col: ParquetColumnSchema = { name: "v", type: "UINT64", nullable: false };
      expect(createColumnValidator(col).safeParse("").success).toBe(false);
    });

    it("rejects whitespace string for INT64", () => {
      const col: ParquetColumnSchema = { name: "v", type: "INT64", nullable: false };
      expect(createColumnValidator(col).safeParse(" 123 ").success).toBe(false);
    });

    it("accepts leading-zero integer strings for INT64 (regex allows it)", () => {
      const col: ParquetColumnSchema = { name: "v", type: "INT64", nullable: false };
      expect(createColumnValidator(col).safeParse("007").success).toBe(true);
    });
  });

  describe("DATE/TIMESTAMP type mismatches", () => {
    it("rejects number input for DATE", () => {
      const col: ParquetColumnSchema = { name: "v", type: "DATE", nullable: false };
      expect(createColumnValidator(col).safeParse(12345).success).toBe(false);
    });

    it("rejects boolean input for TIMESTAMP_MILLIS", () => {
      const col: ParquetColumnSchema = { name: "v", type: "TIMESTAMP_MILLIS", nullable: false };
      expect(createColumnValidator(col).safeParse(true).success).toBe(false);
    });

    it("rejects empty string for DATE", () => {
      const col: ParquetColumnSchema = { name: "v", type: "DATE", nullable: false };
      expect(createColumnValidator(col).safeParse("").success).toBe(false);
    });

    it("rejects empty string for TIMESTAMP_MILLIS", () => {
      const col: ParquetColumnSchema = { name: "v", type: "TIMESTAMP_MILLIS", nullable: false };
      expect(createColumnValidator(col).safeParse("").success).toBe(false);
    });

    it("rejects empty string for TIMESTAMP_MICROS", () => {
      const col: ParquetColumnSchema = { name: "v", type: "TIMESTAMP_MICROS", nullable: false };
      expect(createColumnValidator(col).safeParse("").success).toBe(false);
    });

    it("rejects TIMESTAMP with timezone offset (only Z suffix supported by Zod datetime)", () => {
      const col: ParquetColumnSchema = { name: "v", type: "TIMESTAMP_MILLIS", nullable: false };
      expect(createColumnValidator(col).safeParse("2024-01-15T10:30:00+05:30").success).toBe(false);
    });
  });

  describe("FLOAT/DOUBLE edge values", () => {
    it("accepts -0 for FLOAT", () => {
      const col: ParquetColumnSchema = { name: "v", type: "FLOAT", nullable: false };
      expect(createColumnValidator(col).safeParse(-0).success).toBe(true);
    });

    it("accepts Number.MAX_VALUE for DOUBLE", () => {
      const col: ParquetColumnSchema = { name: "v", type: "DOUBLE", nullable: false };
      expect(createColumnValidator(col).safeParse(Number.MAX_VALUE).success).toBe(true);
    });

    it("accepts Number.MIN_VALUE (smallest positive) for DOUBLE", () => {
      const col: ParquetColumnSchema = { name: "v", type: "DOUBLE", nullable: false };
      expect(createColumnValidator(col).safeParse(Number.MIN_VALUE).success).toBe(true);
    });
  });
});

describe("validateCellValue", () => {
  it("returns success for valid value", () => {
    const col: ParquetColumnSchema = { name: "age", type: "INT32", nullable: false };
    const result = validateCellValue(col, 25);
    expect(result.success).toBe(true);
  });

  it("returns error message for invalid value", () => {
    const col: ParquetColumnSchema = { name: "age", type: "INT32", nullable: false };
    const result = validateCellValue(col, "not a number");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe("string");
    }
  });

  it("returns error for null on non-nullable column", () => {
    const col: ParquetColumnSchema = { name: "id", type: "INT32", nullable: false };
    const result = validateCellValue(col, null);
    expect(result.success).toBe(false);
  });

  it("returns success for null on nullable column", () => {
    const col: ParquetColumnSchema = { name: "id", type: "INT32", nullable: true };
    const result = validateCellValue(col, null);
    expect(result.success).toBe(true);
  });
});
