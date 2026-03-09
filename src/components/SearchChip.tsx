// NOTE: This component is intentionally unused for now.
// It is kept for Lovable compatibility and future use as a quick-search chip on the homepage.

interface SearchChipProps {
  label: string;
  onClick: () => void;
}

const SearchChip = ({ label, onClick }: SearchChipProps) => {
  return (
    <button
      onClick={onClick}
      className="px-4 py-1.5 text-sm rounded-full border border-border bg-secondary/50 text-muted-foreground hover:text-foreground hover:border-primary/40 hover:glow-primary transition-all duration-200"
    >
      {label}
    </button>
  );
};

export default SearchChip;
