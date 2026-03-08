interface SearchChipProps {
  label: string;
  onClick: () => void;
}

const SearchChip = ({ label, onClick }: SearchChipProps) => {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1 text-xs rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
    >
      {label}
    </button>
  );
};

export default SearchChip;
