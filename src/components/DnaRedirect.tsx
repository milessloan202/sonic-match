import { Navigate, useParams, useLocation } from "react-router-dom";

export default function DnaRedirect() {
  const { slug, slug2 } = useParams<{ slug: string; slug2?: string }>();
  const { search } = useLocation();
  const target = slug2 ? `/sounds/${slug}/${slug2}${search}` : `/sounds/${slug}${search}`;
  return <Navigate to={target} replace />;
}
