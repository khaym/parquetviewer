import type { ParquetSchema } from "@shared/types";

interface SchemaViewProps {
  schema: ParquetSchema;
}

export function SchemaView({ schema }: SchemaViewProps) {
  if (schema.length === 0) {
    return <div className="schema-view-empty">No columns</div>;
  }

  return (
    <div className="schema-view">
      <div className="schema-summary">{schema.length} columns</div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Nullable</th>
            </tr>
          </thead>
          <tbody>
            {schema.map((col) => (
              <tr key={col.name}>
                <td>{col.name}</td>
                <td>{col.type}</td>
                <td>{col.nullable ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
