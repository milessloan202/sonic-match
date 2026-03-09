import { Helmet } from "react-helmet-async";

// TODO: Replace with your permanent custom domain when it's ready.
// Only needs to change in this one place — all pages derive canonical URLs from here.
const SITE_URL = "https://sonic-match-six.vercel.app";

interface SEOHeadProps {
  title: string;
  description?: string;
  path?: string;
}

const SEOHead = ({ title, description, path }: SEOHeadProps) => {
  const url = path ? `${SITE_URL}${path}` : undefined;

  return (
    <Helmet>
      <title>{title}</title>
      {description && <meta name="description" content={description} />}
      <meta property="og:title" content={title} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:type" content="website" />
      {url && <meta property="og:url" content={url} />}
      {url && <link rel="canonical" href={url} />}
    </Helmet>
  );
};

export default SEOHead;
