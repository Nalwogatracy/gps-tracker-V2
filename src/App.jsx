import { useEffect, useState } from "react";
import TrackerPage from "./pages/TrackerPage";
import ViewerPage from "./pages/ViewerPage";

export default function App() {
  const [page, setPage] = useState("tracker");
  const [sessionId, setSessionId] = useState(null);

  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/^\/track\/([a-zA-Z0-9]+)$/);
    if (match) {
      setSessionId(match[1]);
      setPage("viewer");
    }
  }, []);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  if (page === "viewer" && sessionId) {
    return <ViewerPage sessionId={sessionId} />;
  }

  return <TrackerPage />;
}
