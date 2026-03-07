import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { validateCellValue } from "../validation";
import type { ParquetColumnSchema, ParquetPrimitiveType } from "../types";

// ── Helpers ────────────────────────────────────────────────────

function col(type: ParquetPrimitiveType, nullable = false): ParquetColumnSchema {
  return { name: "test", type, nullable };
}

// ── Integer types: valid values always pass ────────────────────

describe("validateCellValue — property-based: integers", () => {
  it("INT8: any integer in [-128, 127] is valid", () => {
    fc.assert(
      fc.property(fc.integer({ min: -128, max: 127 }), (n) => {
        expect(validateCellValue(col("INT8"), n).success).toBe(true);
      }),
    );
  });

  it("INT8: integers outside [-128, 127] are invalid", () => {
    fc.assert(
      fc.property(
        fc.integer().filter((n) => n < -128 || n > 127),
        (n) => {
          expect(validateCellValue(col("INT8"), n).success).toBe(false);
        },
      ),
    );
  });

  it("INT16: any integer in [-32768, 32767] is valid", () => {
    fc.assert(
      fc.property(fc.integer({ min: -32768, max: 32767 }), (n) => {
        expect(validateCellValue(col("INT16"), n).success).toBe(true);
      }),
    );
  });

  it("INT16: integers outside range are invalid", () => {
    fc.assert(
      fc.property(
        fc.integer().filter((n) => n < -32768 || n > 32767),
        (n) => {
          expect(validateCellValue(col("INT16"), n).success).toBe(false);
        },
      ),
    );
  });

  it("UINT8: any integer in [0, 255] is valid", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 255 }), (n) => {
        expect(validateCellValue(col("UINT8"), n).success).toBe(true);
      }),
    );
  });

  it("UINT8: negative integers are invalid", () => {
    fc.assert(
      fc.property(fc.integer({ min: -1000, max: -1 }), (n) => {
        expect(validateCellValue(col("UINT8"), n).success).toBe(false);
      }),
    );
  });

  it("UINT16: any integer in [0, 65535] is valid", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 65535 }), (n) => {
        expect(validateCellValue(col("UINT16"), n).success).toBe(true);
      }),
    );
  });

  it("UINT32: any integer in [0, 4294967295] is valid", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4294967295 }), (n) => {
        expect(validateCellValue(col("UINT32"), n).success).toBe(true);
      }),
    );
  });

  it("INT32: any 32-bit integer is valid", () => {
    fc.assert(
      fc.property(fc.integer({ min: -2147483648, max: 2147483647 }), (n) => {
        expect(validateCellValue(col("INT32"), n).success).toBe(true);
      }),
    );
  });
});

// ── Integer types: wrong types are invalid ─────────────────────

describe("validateCellValue — property-based: type mismatches", () => {
  it("string value is invalid for numeric types", () => {
    const numTypes: ParquetPrimitiveType[] = [
      "INT8", "INT16", "INT32", "UINT8", "UINT16", "UINT32", "FLOAT", "DOUBLE",
    ];
    fc.assert(
      fc.property(
        fc.constantFrom(...numTypes),
        fc.string().filter((s) => s.length > 0),
        (type, s) => {
          expect(validateCellValue(col(type), s).success).toBe(false);
        },
      ),
    );
  });

  it("number value is invalid for string types", () => {
    const strTypes: ParquetPrimitiveType[] = ["UTF8", "BYTE_ARRAY"];
    fc.assert(
      fc.property(
        fc.constantFrom(...strTypes),
        fc.integer(),
        (type, n) => {
          expect(validateCellValue(col(type), n).success).toBe(false);
        },
      ),
    );
  });

  it("non-boolean values are invalid for BOOLEAN", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.integer(), fc.string(), fc.constant(0), fc.constant(1)),
        (v) => {
          expect(validateCellValue(col("BOOLEAN"), v).success).toBe(false);
        },
      ),
    );
  });

  it("FLOAT/DOUBLE reject non-number values", () => {
    fc.assert(
      fc.property(fc.string().filter((s) => s.length > 0), (s) => {
        expect(validateCellValue(col("FLOAT"), s).success).toBe(false);
        expect(validateCellValue(col("DOUBLE"), s).success).toBe(false);
      }),
    );
  });
});

// ── FLOAT/DOUBLE: special values ───────────────────────────────

describe("validateCellValue — property-based: float", () => {
  it("FLOAT: any finite double is valid", () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true, noDefaultInfinity: true }), (n) => {
        expect(validateCellValue(col("FLOAT"), n).success).toBe(true);
      }),
    );
  });

  it("DOUBLE: NaN is rejected by Zod", () => {
    const result = validateCellValue(col("DOUBLE"), NaN);
    expect(result.success).toBe(false);
  });

  it("FLOAT/DOUBLE: Infinity is accepted by Zod", () => {
    // Document current behavior
    const posInf = validateCellValue(col("DOUBLE"), Infinity);
    const negInf = validateCellValue(col("DOUBLE"), -Infinity);
    expect(posInf.success).toBe(true);
    expect(negInf.success).toBe(true);
  });
});

// ── INT64/UINT64: string integers ──────────────────────────────

describe("validateCellValue — property-based: INT64/UINT64", () => {
  it("INT64: any bigint string is valid", () => {
    fc.assert(
      fc.property(fc.bigInt(), (n) => {
        expect(validateCellValue(col("INT64"), String(n)).success).toBe(true);
      }),
    );
  });

  it("UINT64: non-negative bigint strings are valid", () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 0n }), (n) => {
        expect(validateCellValue(col("UINT64"), String(n)).success).toBe(true);
      }),
    );
  });

  it("UINT64: negative bigint strings are invalid", () => {
    fc.assert(
      fc.property(
        fc.bigInt({ max: -1n }),
        (n) => {
          expect(validateCellValue(col("UINT64"), String(n)).success).toBe(false);
        },
      ),
    );
  });

  it("INT64: non-integer strings are invalid", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !/^-?\d+$/.test(s) && s.length > 0),
        (s) => {
          expect(validateCellValue(col("INT64"), s).success).toBe(false);
        },
      ),
    );
  });
});

// ── Nullable ───────────────────────────────────────────────────

describe("validateCellValue — property-based: nullable", () => {
  const allTypes: ParquetPrimitiveType[] = [
    "BOOLEAN", "INT8", "INT16", "INT32", "INT64",
    "UINT8", "UINT16", "UINT32", "UINT64",
    "FLOAT", "DOUBLE", "UTF8", "BYTE_ARRAY",
    "DATE", "TIMESTAMP_MILLIS", "TIMESTAMP_MICROS",
  ];

  it("null is valid for any nullable column", () => {
    fc.assert(
      fc.property(fc.constantFrom(...allTypes), (type) => {
        expect(validateCellValue(col(type, true), null).success).toBe(true);
      }),
    );
  });

  it("null is invalid for any non-nullable column", () => {
    fc.assert(
      fc.property(fc.constantFrom(...allTypes), (type) => {
        expect(validateCellValue(col(type, false), null).success).toBe(false);
      }),
    );
  });
});

// ── DATE/TIMESTAMP format ──────────────────────────────────────

describe("validateCellValue — property-based: date/timestamp", () => {
  it("DATE: valid YYYY-MM-DD strings pass", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("1970-01-01"), max: new Date("2099-12-31"), noInvalidDate: true }),
        (d) => {
          const str = d.toISOString().slice(0, 10);
          expect(validateCellValue(col("DATE"), str).success).toBe(true);
        },
      ),
    );
  });

  it("DATE: random strings are mostly invalid", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !/^\d{4}-\d{2}-\d{2}$/.test(s)),
        (s) => {
          expect(validateCellValue(col("DATE"), s).success).toBe(false);
        },
      ),
    );
  });

  it("TIMESTAMP_MILLIS: valid ISO datetime strings pass", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("1970-01-01"), max: new Date("2099-12-31"), noInvalidDate: true }),
        (d) => {
          const str = d.toISOString();
          expect(validateCellValue(col("TIMESTAMP_MILLIS"), str).success).toBe(true);
        },
      ),
    );
  });

  it("TIMESTAMP_MILLIS: plain date strings (no time) are invalid", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("1970-01-01"), max: new Date("2099-12-31"), noInvalidDate: true }),
        (d) => {
          const str = d.toISOString().slice(0, 10); // "YYYY-MM-DD" only
          expect(validateCellValue(col("TIMESTAMP_MILLIS"), str).success).toBe(false);
        },
      ),
    );
  });
});
