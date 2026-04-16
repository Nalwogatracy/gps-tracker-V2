import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "../supabase";
import "../App.css";

const liveIcon = L.divIcon({
  html: `<div style="width:20px;height:20px;border-radius:50%;background:#ef4444;border:3px solid #fff;box-shadow:0 0 0 3px rgba(239,68,68,0.4),0 2px 8px rgba(0,0,0,0.3)"></div>`,
  iconSize: [20, 20], iconAnchor: [10, 10], className: "",
});

function MapUpdater({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView(position, Math.max(map.getZoom(), 15));
  }, [position]);
  return null;
}

export default function ViewerPage({ sessionId }) {
  const [position, setPosition] = useState(null);
  const [stats, setStats] = useState(null);
  const [status, setStatus] = useState("connecting");
  const [lastSeen, setLastSeen] = useState(null);

  useEffect(() => {
    const fetchInitial = async () => {
      const { data } = await supabase.from("locations").select("*").eq("id", sessionId).single();
      if (data) {
        setPosition([data.lat, data.lng]);
        setStats(data);
        setLastSeen(new Date(data.updated_at));
        setStatus("live");
      } else {
        setStatus("notfound");
      }
    };
    fetchInitial();

    const channel = supabase
      .channel("location-updates")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "locations",
        filter: `id=eq.${sessionId}`,
      }, (payload) => {
        const d = payload.new;
        setPosition([d.lat, d.lng]);
        setStats(d);
        setLastSeen(new Date(d.updated_at));
        setStatus("live");
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [sessionId]);

  const defaultCenter = [0.3476, 32.5825];

  const statusInfo = {
    connecting: { label: "Connecting...", color: "#f59e0b", pulse: true },
    live: { label: "Live", color: "#22c55e", pulse: true },
    notfound: { label: "Session not found", color: "#ef4444", pulse: false },
  }[status];

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">◎</span>
            <span className="logo-text">Watching live location</span>
          </div>
          <div className="status-pill">
            <span className={`dot${statusInfo.pulse ? " pulse" : ""}`} style={{ background: statusInfo.color }} />
            <span className="status-label">{statusInfo.label}</span>
          </div>
        </div>
      </header>

      <main className="main">
        {status === "notfound" ? (
          <div className="panel" style={{ textAlign: "center", padding: "3rem 1rem" }}>
            <p style={{ fontSize: "2rem", marginBottom: "1rem" }}>⚠</p>
            <p className="muted">This tracking session was not found or has ended.</p>
            <a href="/" className="btn btn-start" style={{ display: "inline-block", marginTop: "1rem", textDecoration: "none" }}>Go to tracker</a>
          </div>
        ) : (
          <>
            <div className="stats-row">
              {[
                { label: "Latitude", value: stats ? stats.lat.toFixed(5) : "—", unit: "°" },
                { label: "Longitude", value: stats ? stats.lng.toFixed(5) : "—", unit: "°" },
                { label: "Speed", value: stats ? (stats.speed ?? 0).toFixed(1) : "—", unit: " km/h" },
                { label: "Accuracy", value: stats ? Math.round(stats.accuracy ?? 0) : "—", unit: " m" },
              ].map((s) => (
                <div className="stat-card" key={s.label}>
                  <div className="stat-label">{s.label}</div>
                  <div className="stat-value">{s.value}{s.value !== "—" && <span className="stat-unit">{s.unit}</span>}</div>
                </div>
              ))}
            </div>

            <div className="map-wrapper">
              <MapContainer center={defaultCenter} zoom={10} style={{ width: "100%", height: "100%" }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap contributors" />
                {position && (
                  <Marker position={position} icon={liveIcon}>
                    <Popup>Live location</Popup>
                  </Marker>
                )}
                {position && <MapUpdater position={position} />}
              </MapContainer>
            </div>

            {lastSeen && (
              <div className="panel">
                <p className="muted small">Last updated: {lastSeen.toLocaleTimeString()} — This map updates automatically whenever the person moves.</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
