import { Button } from "./Button.js";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  disabled = false,
  className = "",
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const canGoPrevious = currentPage > 1 && !disabled;
  const canGoNext = currentPage < totalPages && !disabled;

  return (
    <nav
      className={`pagination ${className}`.trim()}
      aria-label="Pagination Navigation"
    >
      <div className="pagination__info" aria-current="page">
        Page {currentPage} of {totalPages}
      </div>

      <div className="pagination__controls">
        <Button
          variant="outline"
          size="sm"
          className="pagination__prev"
          onClick={() => canGoPrevious && onPageChange(currentPage - 1)}
          disabled={!canGoPrevious}
          aria-label="Go to previous page"
        >
          Previous
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="pagination__next"
          onClick={() => canGoNext && onPageChange(currentPage + 1)}
          disabled={!canGoNext}
          aria-label="Go to next page"
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
