import { Link } from "react-router-dom";
import { motion } from "framer-motion";

interface RelatedLink {
  name: string;
  slug: string;
}

interface RelatedPagesProps {
  relatedSongs?: RelatedLink[];
  relatedArtists?: RelatedLink[];
  relatedVibes?: RelatedLink[];
}

const Section = ({ title, links, prefix }: { title: string; links: RelatedLink[]; prefix: string }) => {
  if (!links.length) return null;
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <Link
            key={link.slug}
            to={`${prefix}/${link.slug}`}
            className="px-3 py-1.5 rounded-md bg-secondary text-sm text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            {link.name}
          </Link>
        ))}
      </div>
    </div>
  );
};

const RelatedPages = ({ relatedSongs = [], relatedArtists = [], relatedVibes = [] }: RelatedPagesProps) => {
  if (!relatedSongs.length && !relatedArtists.length && !relatedVibes.length) return null;

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
      className="border-t border-border pt-8 space-y-6"
    >
      <h2 className="text-xl font-semibold text-foreground">Discover More</h2>
      <Section title="Related Songs" links={relatedSongs} prefix="/songs-like" />
      <Section title="Related Artists" links={relatedArtists} prefix="/artists-like" />
      <Section title="Related Vibes" links={relatedVibes} prefix="/vibes" />
    </motion.section>
  );
};

export default RelatedPages;
