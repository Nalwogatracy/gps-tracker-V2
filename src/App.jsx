import { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";

const redDotIcon = L.divIcon({
  html: `<div style="
    width:18px;height:18px;border-radius:50%;
    background:#ef4444;border:3px solid #fff;
    box-shadow:0 0 0 2px #ef4444,0 2px 8px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  className: "",
});

function MapUpdater({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView(position, Math.max(map.getZoom(), 15));
  }, [position]);
  return null;
}

export default function App() {
  const [tracking, setTracking] = useState(false);
  const [position, setPosition] = useState(null);
  const [path, setPath] = useState([]);
  const [stats, setStats] = useState({ lat: null, lng: null, speed: null, accuracy: null });
  const [log, setLog] = useState([]);
  const [status, setStatus] = useState("idle");
  const watchId = useRef(null);
  const logRef = useRef(null);

  const startTracking = () => {
    if (!navigator.geolocation) {
      setStatus("error");
      return;
    }
    setStatus("acquiring");
    setTracking(true);
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
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
        setLog((prev) => [
          ...prev,
          {
            id: prev.length + 1,
            time: new Date().toLocaleTimeString(),
            lat: lat.toFixed(5),
            lng: lng.toFixed(5),
            speed: speed != null ? (speed * 3.6).toFixed(1) : "0.0",
            acc: Math.round(accuracy),
          },
        ]);
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
    setLog([]);
    setStatus("idle");
  };

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  const statusInfo = {
    idle: { label: "Idle — press Start", color: "#94a3b8", pulse: false },
    acquiring: { label: "Acquiring signal...", color: "#f59e0b", pulse: true },
    active: { label: "Tracking active", color: "#22c55e", pulse: true },
    stopped: { label: "Tracking stopped", color: "#94a3b8", pulse: false },
    denied: { label: "Permission denied", color: "#ef4444", pulse: false },
    error: { label: "Location unavailable", color: "#ef4444", pulse: false },
  }[status];

  const defaultCenter = [0.3476, 32.5825]; // Kampala

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">◎</span>
            <span className="logo-text">GPRS Tracker</span>
          </div>
          <div className="status-pill">
            <span
              className={`dot${statusInfo.pulse ? " pulse" : ""}`}
              style={{ background: statusInfo.color }}
            />
            <span className="status-label">{statusInfo.label}</span>
          </div>
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
              <div className="stat-value">
                {s.value}
                {s.value !== "—" && <span className="stat-unit">{s.unit}</span>}
              </div>
            </div>
          ))}
        </div>

        <div className="map-wrapper">
          <MapContainer
            center={defaultCenter}
            zoom={10}
            style={{ width: "100%", height: "100%" }}
            zoomControl={true}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="© OpenStreetMap contributors"
            />
            {position && <Marker position={position} icon={redDotIcon} />}
            {path.length > 1 && (
              <Polyline positions={path} color="#22c55e" weight={4} opacity={0.85} />
            )}
            {position && <MapUpdater position={position} />}
          </MapContainer>
        </div>

        <div className="controls">
          <button
            className="btn btn-start"
            onClick={startTracking}
            disabled={tracking}
          >
            ▶ Start
          </button>
          <button
            className="btn btn-stop"
            onClick={stopTracking}
            disabled={!tracking}
          >
            ■ Stop
          </button>
          <button className="btn btn-clear" onClick={clearAll}>
            ↺ Clear
          </button>
          <span className="point-count">{log.length} point{log.length !== 1 ? "s" : ""} recorded</span>
        </div>

        <div className="log-section">
          <div className="log-header">Location Log</div>
          <div className="log-list" ref={logRef}>
            {log.length === 0 ? (
              <div className="log-empty">No points recorded yet. Press Start to begin.</div>
            ) : (
              log.map((entry) => (
                <div className="log-entry" key={entry.id}>
                  <span className="log-num">#{entry.id}</span>
                  <span className="log-time">{entry.time}</span>
                  <span className="log-coords">{entry.lat}, {entry.lng}</span>
                  <span className="log-meta">{entry.speed} km/h · ±{entry.acc}m</span>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
