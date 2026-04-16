import { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "../supabase";
import "../App.css";

const CATEGORIES = [
  { key: "hospital", label: "Hospitals", icon: "✚", color: "#ef4444", query: `node["amenity"="hospital"]` },
  { key: "police", label: "Police", icon: "⚑", color: "#3b82f6", query: `node["amenity"="police"]` },
  { key: "fire", label: "Fire stations", icon: "▲", color: "#f97316", query: `node["amenity"="fire_station"]` },
  { key: "fuel", label: "Fuel stations", icon: "⬡", color: "#eab308", query: `node["amenity"="fuel"]` },
  { key: "bus_stop", label: "Bus stops", icon: "⬤", color: "#8b5cf6", query: `node["highway"="bus_stop"]` },
  { key: "school", label: "Schools", icon: "◆", color: "#06b6d4", query: `node["amenity"="school"]` },
  { key: "bank", label: "Banks", icon: "▣", color: "#10b981", query: `node["amenity"="bank"]` },
  { key: "market", label: "Markets", icon: "◉", color: "#f59e0b", query: `node["shop"="supermarket"]` },
];

function makeIcon(color, symbol) {
  return L.divIcon({
    html: `<div style="width:28px;height:28px;border-radius:50%;background:${color};border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;box-shadow:0 2px 6px rgba(0,0,0,0.4)">${symbol}</div>`,
    iconSize: [28, 28], iconAnchor: [14, 14], className: "",
  });
}

const myIcon = L.divIcon({
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#22c55e;border:3px solid #fff;box-shadow:0 0 0 2px #22c55e,0 2px 8px rgba(0,0,0,0.3)"></div>`,
  iconSize: [18, 18], iconAnchor: [9, 9], className: "",
});

function MapUpdater({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView(position, Math.max(map.getZoom(), 15));
  }, [position]);
  return null;
}

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

export default function TrackerPage() {
  const [tracking, setTracking] = useState(false);
  const [position, setPosition] = useState(null);
  const [path, setPath] = useState([]);
  const [stats, setStats] = useState({ lat: null, lng: null, speed: null, accuracy: null });
  const [status, setStatus] = useState("idle");
  const [sessionId] = useState(() => generateId());
  const [shareLink, setShareLink] = useState(null);
  const [copied, setCopied] = useState(false);
  const [places, setPlaces] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [tab, setTab] = useState("track");
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const watchId = useRef(null);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const startTracking = () => {
    if (!navigator.geolocation) { setStatus("error"); return; }
    setStatus("acquiring");
    setTracking(true);
    setShareLink(`${window.location.origin}/track/${sessionId}`);

    watchId.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng, speed, accuracy } = pos.coords;
        const latlng = [lat, lng];
        setStatus("active");
        setPosition(latlng);
        setPath((prev) => [...prev, latlng]);
        setStats({
          lat: lat.toFixed(5),
          lng: lng.toFixed(5),
          speed: speed != null ? (speed * 3.6).toFixed(1) : "0.0",
          accuracy: Math.round(accuracy),
        });
        await supabase.from("locations").upsert({
          id: sessionId, lat, lng,
          speed: speed ? speed * 3.6 : 0,
          accuracy,
          updated_at: new Date().toISOString(),
        });
      },
      (err) => {
        setStatus(err.code === 1 ? "denied" : "error");
        setTracking(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  };

  const stopTracking = () => {
    if (watchId.current != null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setTracking(false);
    setStatus("stopped");
  };

  const clearAll = () => {
    stopTracking();
    setPosition(null);
    setPath([]);
    setStats({ lat: null, lng: null, speed: null, accuracy: null });
    setStatus("idle");
    setShareLink(null);
    setPlaces([]);
    setActiveCategory(null);
  };

  const copyLink = () => {
    if (!shareLink) return;
    navigator.clipboard.writeText(shareLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const searchNearby = async (cat) => {
    if (!position) return;
    if (activeCategory === cat.key) { setActiveCategory(null); setPlaces([]); return; }
    setLoadingPlaces(true);
    setActiveCategory(cat.key);
    const [lat, lng] = position;
    const radius = 3000;
    const query = `[out:json][timeout:25];(${cat.query}(around:${radius},${lat},${lng}););out body;`;
    try {
      const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
      const data = await res.json();
      setPlaces(data.elements.slice(0, 20).map(el => ({
        id: el.id,
        name: el.tags?.name || cat.label,
        lat: el.lat, lng: el.lon,
        icon: cat.icon, color: cat.color,
      })));
    } catch {
      setPlaces([]);
    }
    setLoadingPlaces(false);
  };

  const statusInfo = {
    idle: { label: "Idle", color: "#64748b", pulse: false },
    acquiring: { label: "Acquiring...", color: "#f59e0b", pulse: true },
    active: { label: "Live", color: "#22c55e", pulse: true },
    stopped: { label: "Stopped", color: "#64748b", pulse: false },
    denied: { label: "Denied", color: "#ef4444", pulse: false },
    error: { label: "Error", color: "#ef4444", pulse: false },
  }[status];

  const defaultCenter = [0.3476, 32.5825];

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">◎</span>
            <span className="logo-text">GPRS Tracker</span>
          </div>
          <div className="status-pill">
            <span className={`dot${statusInfo.pulse ? " pulse" : ""}`} style={{ background: statusInfo.color }} />
            <span className="status-label">{statusInfo.label}</span>
          </div>
          {/* Theme Toggle Button - FIXED POSITION */}
          <button onClick={toggleTheme} className="theme-toggle" style={{
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '6px 12px',
            cursor: 'pointer',
            color: 'var(--text)',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px'
          }}>
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>
      </header>

      <main className="main">
        <div className="stats-row">
          {[
            { label: "Latitude", value: stats.lat ?? "—", unit: "°" },
            { label: "Longitude", value: stats.lng ?? "—", unit: "°" },
            { label: "Speed", value: stats.speed ?? "—", unit: " km/h" },
            { label: "Accuracy", value: stats.accuracy ?? "—", unit: " m" },
          ].map((s) => (
            <div className="stat-card" key={s.label}>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{s.value}{s.value !== "—" && <span className="stat-unit">{s.unit}</span>}</div>
            </div>
          ))}
        </div>

        <div className="map-wrapper">
          <MapContainer center={defaultCenter} zoom={10} style={{ width: "100%", height: "100%" }} zoomControl={true}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap contributors" />
            {position && <Marker position={position} icon={myIcon}><Popup>Your location</Popup></Marker>}
            {path.length > 1 && <Polyline positions={path} color="#22c55e" weight={4} opacity={0.85} />}
            {places.map(p => (
              <Marker key={p.id} position={[p.lat, p.lng]} icon={makeIcon(p.color, p.icon)}>
                <Popup><strong>{p.name}</strong></Popup>
              </Marker>
            ))}
            {position && <MapUpdater position={position} />}
          </MapContainer>
        </div>

        <div className="tabs">
          <button className={`tab${tab === "track" ? " active" : ""}`} onClick={() => setTab("track")}>Tracking</button>
          <button className={`tab${tab === "share" ? " active" : ""}`} onClick={() => setTab("share")}>Share location</button>
          <button className={`tab${tab === "nearby" ? " active" : ""}`} onClick={() => setTab("nearby")}>Nearby places</button>
        </div>

        {tab === "track" && (
          <div className="panel">
            <div className="controls">
              <button className="btn btn-start" onClick={startTracking} disabled={tracking}>▶ Start</button>
              <button className="btn btn-stop" onClick={stopTracking} disabled={!tracking}>■ Stop</button>
              <button className="btn btn-clear" onClick={clearAll}>↺ Clear</button>
            </div>
          </div>
        )}

        {tab === "share" && (
          <div className="panel">
            {!shareLink ? (
              <div className="share-empty">
                <p className="muted">Start tracking first to generate your shareable link.</p>
                <button className="btn btn-start" onClick={() => { setTab("track"); startTracking(); }}>▶ Start tracking</button>
              </div>
            ) : (
              <div className="share-box">
                <p className="share-label">Anyone with this link can see your live location:</p>
                <div className="link-row">
                  <span className="link-text">{shareLink}</span>
                  <button className="btn btn-copy" onClick={copyLink}>{copied ? "✓ Copied!" : "Copy"}</button>
                </div>
                <p className="muted small">Link stays active while you are tracking. Share it via WhatsApp, SMS, or any app.</p>
              </div>
            )}
          </div>
        )}

        {tab === "nearby" && (
          <div className="panel">
            {!position ? (
              <p className="muted">Start tracking first to search nearby places.</p>
            ) : (
              <>
                <p className="nearby-hint">Select a category to find places within 3km:</p>
                <div className="categories">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.key}
                      className={`cat-btn${activeCategory === cat.key ? " active" : ""}`}
                      style={{ "--cat-color": cat.color }}
                      onClick={() => searchNearby(cat)}
                    >
                      <span className="cat-icon">{cat.icon}</span>
                      <span className="cat-label">{cat.label}</span>
                    </button>
                  ))}
                </div>
                {loadingPlaces && <p className="muted">Searching...</p>}
                {!loadingPlaces && activeCategory && places.length === 0 && (
                  <p className="muted">No results found nearby.</p>
                )}
                {places.length > 0 && (
                  <div className="places-list">
                    {places.map(p => (
                      <div className="place-item" key={p.id}>
                        <span className="place-icon" style={{ color: p.color }}>{p.icon}</span>
                        <span className="place-name">{p.name}</span>
                        <span className="place-coords">{p.lat.toFixed(4)}, {p.lng.toFixed(4)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
