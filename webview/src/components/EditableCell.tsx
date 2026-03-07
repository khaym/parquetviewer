import { useState, useRef, useEffect } from "react";
import type { ParquetColumnSchema, ParquetPrimitiveType } from "@shared/types";

const NUMERIC_TYPES: ReadonlySet<ParquetPrimitiveType> = new Set([
  "INT8", "INT16", "INT32", "UINT8", "UINT16", "UINT32", "FLOAT", "DOUBLE",
]);

const STRING_PASS_THROUGH_TYPES: ReadonlySet<ParquetPrimitiveType> = new Set([
  "INT64", "UINT64", "UTF8", "BYTE_ARRAY", "DATE", "TIMESTAMP_MILLIS", "TIMESTAMP_MICROS",
]);

export function parseInputValue(
  input: string,
  type: ParquetPrimitiveType,
): unknown {
  if (type === "BOOLEAN") {
    return input === "true";
  }
  if (NUMERIC_TYPES.has(type)) {
    return Number(input);
  }
  if (STRING_PASS_THROUGH_TYPES.has(type)) {
    return input;
  }
  return input;
}

interface EditableCellProps {
  value: unknown;
  column: ParquetColumnSchema;
  onCommit: (value: unknown) => void;
  validationError?: string;
}

export function EditableCell({
  value,
  column,
  onCommit,
  validationError,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  const wasNull = useRef(false);

  const handleClick = () => {
    if (column.type === "BOOLEAN") {
      onCommit(!value);
      return;
    }
    wasNull.current = value === null || value === undefined;
    setInputValue(wasNull.current ? "" : String(value));
    setEditing(true);
  };

  const commitEdit = () => {
    // If the value was null and input is still empty, keep it as null
    if (wasNull.current && inputValue === "") {
      setEditing(false);
      return;
    }
    const parsed = parseInputValue(inputValue, column.type);
    setEditing(false);
    onCommit(parsed);
  };

  const commitNull = () => {
    setEditing(false);
    onCommit(null);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    } else if (e.key === "Delete" && e.ctrlKey && column.nullable) {
      e.preventDefault();
      commitNull();
    }
  };

  if (editing) {
    return (
      <div className="cell-edit-container">
        <input
          ref={inputRef}
          className="cell-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={(e) => {
            // Don't commit on blur if clicking the Set NULL button
            if (e.relatedTarget?.closest(".set-null-btn")) return;
            commitEdit();
          }}
        />
        {column.nullable && (
          <button
            className="set-null-btn"
            onClick={commitNull}
            tabIndex={0}
          >
            Set NULL
          </button>
        )}
      </div>
    );
  }

  const isNumeric = NUMERIC_TYPES.has(column.type);
  const cellClassName = [
    "cell-value",
    isNumeric && "cell-numeric",
    validationError && "validation-error",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={cellClassName}
      title={validationError}
      onClick={handleClick}
    >
      {value === null || value === undefined ? (
        <span className="null-value">NULL</span>
      ) : value === "" ? (
        <span className="empty-string-value">&quot;&quot;</span>
      ) : (
        String(value)
      )}
    </div>
  );
}
