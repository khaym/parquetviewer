import { z } from "zod";
import type { ParquetColumnSchema, ParquetPrimitiveType } from "./types";

/**
 * Regex for integer strings (used for INT64/UINT64 which exceed JS number range).
 */
const INTEGER_STRING_REGEX = /^-?\d+$/;

/**
 * Creates a base (non-nullable) Zod schema for a given Parquet primitive type.
 */
function baseSchemaForType(type: ParquetPrimitiveType): z.ZodTypeAny {
  switch (type) {
    // Boolean
    case "BOOLEAN":
      return z.boolean();

    // Signed integers
    case "INT8":
      return z.number().int().min(-128).max(127);
    case "INT16":
      return z.number().int().min(-32768).max(32767);
    case "INT32":
      return z.number().int().min(-2147483648).max(2147483647);
    case "INT64":
      // INT64 exceeds JS safe integer range; accept string representation
      return z.string().regex(INTEGER_STRING_REGEX, "Expected an integer string");

    // Unsigned integers
    case "UINT8":
      return z.number().int().min(0).max(255);
    case "UINT16":
      return z.number().int().min(0).max(65535);
    case "UINT32":
      return z.number().int().min(0).max(4294967295);
    case "UINT64":
      // UINT64 exceeds JS safe integer range; accept string representation
      return z
        .string()
        .regex(INTEGER_STRING_REGEX, "Expected an unsigned integer string")
        .refine(
          (val) => {
            try {
              return BigInt(val) >= 0n;
            } catch {
              return false;
            }
          },
          { message: "Expected a non-negative integer string" },
        );

    // Floating point
    case "FLOAT":
    case "DOUBLE":
      return z.number();

    // String / binary
    case "UTF8":
    case "BYTE_ARRAY":
      return z.string();

    // Date / timestamp — uses Zod built-in validators for calendar-aware checks
    case "DATE":
      return z.string().date("Expected a valid date (YYYY-MM-DD)");
    case "TIMESTAMP_MILLIS":
    case "TIMESTAMP_MICROS":
      return z.string().datetime({
        message: "Expected a valid ISO 8601 datetime (e.g. 2024-01-15T10:30:00Z)",
      });

    default: {
      const _exhaustive: never = type;
      throw new Error(`Unsupported Parquet type: ${_exhaustive}`);
    }
  }
}

/**
 * Creates a Zod validator for a single Parquet column.
 * Handles nullable columns by wrapping the base schema with `.nullable()`.
 */
export function createColumnValidator(column: ParquetColumnSchema): z.ZodTypeAny {
  const base = baseSchemaForType(column.type);
  return column.nullable ? base.nullable() : base;
}

/**
 * Result of a cell value validation.
 */
export type ValidationResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Validates a cell value against a column schema.
 * Returns a simple success/error result for UI consumption.
 */
export function validateCellValue(
  column: ParquetColumnSchema,
  value: unknown,
): ValidationResult {
  const validator = createColumnValidator(column);
  const result = validator.safeParse(value);

  if (result.success) {
    return { success: true };
  }

  const firstIssue = result.error.issues[0];
  return {
    success: false,
    error: firstIssue?.message ?? "Invalid value",
  };
}
