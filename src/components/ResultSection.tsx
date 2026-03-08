import ResultCard from "./ResultCard";

interface ResultSectionProps {
  title: string;
  items: { title: string; subtitle?: string; tag?: string }[];
}

const ResultSection = ({ title, items }: ResultSectionProps) => {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {title}
      </h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((item, i) => (
          <ResultCard key={item.title} {...item} index={i} />
        ))}
      </div>
    </section>
  );
};

export default ResultSection;
