import { useParams, Navigate } from "react-router-dom";

export default function Lobby() {
  const { code } = useParams();

  if (!code || !/^[A-Za-z]{4}$/.test(code)) {
    return <Navigate to="/" replace state={{ notFound: true }} />;
  }

  const normalizedCode = code.toUpperCase();

  if (code !== normalizedCode) {
    return <Navigate to={`/${normalizedCode}`} replace />;
  }

  return <div>Lobby: {normalizedCode}</div>;
}
