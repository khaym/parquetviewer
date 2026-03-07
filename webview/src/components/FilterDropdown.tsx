import { useState, useRef, useEffect } from "react";
import type { ParquetPrimitiveType, FilterOperator } from "@shared/types";

interface OperatorOption {
  value: FilterOperator;
  label: string;
}

const STRING_OPERATORS: OperatorOption[] = [
  { value: "equals", label: "Equals" },
  { value: "notEquals", label: "Not Equals" },
  { value: "contains", label: "Contains" },
  { value: "startsWith", label: "Starts With" },
];

const NUMBER_OPERATORS: OperatorOption[] = [
  { value: "equals", label: "=" },
  { value: "notEquals", label: "≠" },
  { value: "gt", label: ">" },
  { value: "lt", label: "<" },
  { value: "gte", label: "≥" },
  { value: "lte", label: "≤" },
];

const BOOLEAN_OPERATORS: OperatorOption[] = [
  { value: "isTrue", label: "Is True" },
  { value: "isFalse", label: "Is False" },
];

const DATE_OPERATORS: OperatorOption[] = [
  { value: "equals", label: "Equals" },
  { value: "notEquals", label: "Not Equals" },
  { value: "before", label: "Before" },
  { value: "after", label: "After" },
];

const STRING_TYPES: ReadonlySet<ParquetPrimitiveType> = new Set(["UTF8", "BYTE_ARRAY"]);
const NUMERIC_TYPES: ReadonlySet<ParquetPrimitiveType> = new Set([
  "INT8", "INT16", "INT32", "INT64", "UINT8", "UINT16", "UINT32", "UINT64", "FLOAT", "DOUBLE",
]);
const DATE_TYPES: ReadonlySet<ParquetPrimitiveType> = new Set(["DATE", "TIMESTAMP_MILLIS", "TIMESTAMP_MICROS"]);

export function getOperatorsForType(type: ParquetPrimitiveType): OperatorOption[] {
  if (type === "BOOLEAN") return BOOLEAN_OPERATORS;
  if (STRING_TYPES.has(type)) return STRING_OPERATORS;
  if (NUMERIC_TYPES.has(type)) return NUMBER_OPERATORS;
  if (DATE_TYPES.has(type)) return DATE_OPERATORS;
  return STRING_OPERATORS;
}

interface FilterDropdownProps {
  columnName: string;
  columnType: ParquetPrimitiveType;
  currentOperator?: FilterOperator;
  currentValue?: string;
  onApply: (operator: FilterOperator, value: string) => void;
  onClear: () => void;
  onClose: () => void;
}

export function FilterDropdown({
  columnName,
  columnType,
  currentOperator,
  currentValue,
  onApply,
  onClear,
  onClose,
}: FilterDropdownProps) {
  const operators = getOperatorsForType(columnType);
  const [operator, setOperator] = useState<FilterOperator>(
    currentOperator ?? operators[0].value,
  );
  const [value, setValue] = useState(currentValue ?? "");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isBoolean = columnType === "BOOLEAN";

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose]);

  const handleApply = () => {
    onApply(operator, value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleApply();
    }
  };

  return (
    <div className="filter-dropdown" ref={dropdownRef} onClick={(e) => e.stopPropagation()}>
      <select
        aria-label="Filter operator"
        value={operator}
        onChange={(e) => setOperator(e.target.value as FilterOperator)}
      >
        {operators.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>
      {!isBoolean && (
        <input
          aria-label="Filter value"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Filter value..."
        />
      )}
      <div className="filter-dropdown-actions">
        <button onClick={handleApply}>Apply</button>
        <button onClick={onClear}>Clear</button>
      </div>
    </div>
  );
}
