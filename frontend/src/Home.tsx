import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function Home() {
  const location = useLocation();
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (location.state?.notFound) {
      setNotFound(true);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  if (notFound) {
    return <div>NOT FOUND!</div>;
  }
  return <div>New Home</div>;
}
