import { motion } from "framer-motion";

const PageSkeleton = ({ generating }: { generating?: boolean }) => (
  <div className="min-h-screen px-4 py-12 max-w-3xl mx-auto space-y-10">
    <div className="space-y-4">
      <div className="h-4 w-16 rounded bg-secondary animate-pulse" />
      <div className="h-10 w-3/4 rounded bg-secondary animate-pulse" />
      <div className="h-5 w-1/2 rounded bg-secondary animate-pulse" />
    </div>
    {generating && (
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-muted-foreground text-sm"
      >
        ✨ Generating recommendations with AI...
      </motion.p>
    )}
    {[1, 2, 3].map((i) => (
      <div key={i} className="space-y-3">
        <div className="h-6 w-48 rounded bg-secondary animate-pulse" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-24 rounded-lg bg-secondary animate-pulse" />
          <div className="h-24 rounded-lg bg-secondary animate-pulse" />
        </div>
      </div>
    ))}
  </div>
);

export default PageSkeleton;
