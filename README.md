# Parquet Editor

View and edit Apache Parquet files in VS Code with a spreadsheet-style interface.

## Features

- Open `.parquet` files directly in VS Code
- Spreadsheet-style data viewing with pagination
- Click-to-edit cells with type-aware validation
- Column filtering (equals, contains, greater than, etc.)
- Schema view showing column names, types, and nullability
- Undo/Redo support (Ctrl+Z / Ctrl+Shift+Z)
- Save changes back to Parquet format (Ctrl+S)
- NULL vs empty string distinction

## Usage

1. Open any `.parquet` file in VS Code
2. The file opens automatically in the Parquet Editor
3. Click any cell to edit its value
4. Use the filter icon in column headers to filter data
5. Switch between Data and Schema tabs
6. Save with Ctrl+S

## Supported Types

BOOLEAN, INT8, INT16, INT32, INT64, UINT8, UINT16, UINT32, UINT64, FLOAT, DOUBLE, UTF8, DATE, TIMESTAMP_MILLIS, TIMESTAMP_MICROS, BYTE_ARRAY
