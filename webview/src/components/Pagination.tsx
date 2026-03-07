import { useState } from "react";

const PAGE_SIZE_OPTIONS = [10, 50, 100, 500, 1000];

interface PaginationProps {
  pageIndex: number;
  totalPages: number;
  totalRows: number;
  pageSize: number;
  filteredTotalRows?: number;
  onPrevious: () => void;
  onNext: () => void;
  onPageSizeChange: (pageSize: number) => void;
  onPageJump: (pageIndex: number) => void;
}

export function Pagination({
  pageIndex,
  totalPages,
  totalRows,
  pageSize,
  filteredTotalRows,
  onPrevious,
  onNext,
  onPageSizeChange,
  onPageJump,
}: PaginationProps) {
  const [jumpInput, setJumpInput] = useState("");

  const handleJumpKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      const pageNum = parseInt(jumpInput, 10);
      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
        onPageJump(pageNum - 1);
        setJumpInput("");
      }
    }
  };

  return (
    <div className="pagination">
      <button disabled={pageIndex === 0} onClick={onPrevious}>
        Previous
      </button>
      <span>
        Page {pageIndex + 1} of {totalPages} ({filteredTotalRows != null ? `${filteredTotalRows} of ${totalRows} rows` : `${totalRows} rows`})
      </span>
      <button disabled={pageIndex >= totalPages - 1} onClick={onNext}>
        Next
      </button>
      <input
        className="page-jump-input"
        type="number"
        min={1}
        max={totalPages}
        placeholder="Go to..."
        value={jumpInput}
        onChange={(e) => setJumpInput(e.target.value)}
        onKeyDown={handleJumpKeyDown}
        aria-label="Jump to page"
      />
      <select
        className="page-size-select"
        value={pageSize}
        onChange={(e) => onPageSizeChange(Number(e.target.value))}
        aria-label="Page size"
      >
        {PAGE_SIZE_OPTIONS.map((size) => (
          <option key={size} value={size}>
            {size} rows
          </option>
        ))}
      </select>
    </div>
  );
}
