
import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowUpRight,
  Eye,
  Globe2,
  LockKeyhole,
} from "lucide-react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import CategoryPage from "./components/CategoryPage";
import VideoCard from "./components/VideoCard";
import "./styles.css";
import VideoManager from "./components/VideoManager";

const ADMIN_TOKEN_KEY = "sparringscope_admin_token";

// Generate a random first-party visitor ID.
// This is not device fingerprinting or real-world identification.
function getVisitorId() {
  const key = "sparringscope_visitor_id";

  let id = localStorage.getItem(key);

  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }

  return id;
}

// --------------------------------------------------
// PUBLIC HOMEPAGE
// --------------------------------------------------

function PublicPage() {
  const [videos, setVideos] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    // Record a page visit.
    fetch("/api/track", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        visitor_id: getVisitorId(),
        screen_width: window.screen?.width ?? null,
        screen_height: window.screen?.height ?? null,
        viewport_width: window.innerWidth ?? null,
      }),
    }).catch((err) => {
      console.error("Analytics tracking failed:", err);
    });

    // Fetch videos from the backend.
    async function loadVideos() {
      try {
        const response = await fetch("/api/videos");

        if (!response.ok) {
          throw new Error("Video API request failed");
        }

        const data = await response.json();

        // Support both the old array response and
        // the new categorized response.
        const allVideos = Array.isArray(data)
          ? data
          : [
              ...(data.grappling ?? []),
              ...(data.striking ?? []),
            ];

        setVideos(allVideos);
      } catch (err) {
        console.error("Video loading failed:", err);
        setError("Could not load videos. Start the API and try again.");
      }
    }

    loadVideos();
  }, []);

  return (
    <main className="public-shell">
      <nav className="topbar">
        <span className="mark">SS</span>
        <span>SPARRINGSCOPE</span>

        <a href="/admin">
          Dashboard <ArrowUpRight size={15} />
        </a>
      </nav>

      {/* HERO */}
      <section className="hero">
        <p className="eyebrow">
          TRAINING ARCHIVE · BOXING · MMA
        </p>

        <h1>
          Work in
          <br />
          <em>progress.</em>
        </h1>

        <p className="hero-copy">
          A collection of rounds, lessons, and moments from the gym.
        </p>

        <div className="hero-meta">
          <span>
            <Activity size={15} />
            TRAINING FOOTAGE
          </span>

          <span>
            <LockKeyhole size={15} />
            SHARED COLLECTION
          </span>
        </div>
      </section>

      {/* TRAINING CATEGORIES */}
      <section className="video-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">EXPLORE THE ARCHIVE</p>
            <h2>Training categories</h2>
          </div>
        </div>

        <div className="category-grid">
          <a href="/grappling" className="category-tile category-tile--grappling">
            <div className="category-tile-art">
              <span className="category-number">01 / DISCIPLINE</span>
              <span className="category-art-word">GROUND</span>
              <span className="category-art-icon"><Activity size={34} /></span>
              <span className="category-open"><ArrowUpRight size={21} /></span>
            </div>
            <div className="category-tile-copy">
              <div>
                <p className="eyebrow">WRESTLING · BJJ · SUBMISSIONS</p>
                <h3>Grappling</h3>
                <p>Control the position. Find the finish.</p>
              </div>
              <span className="category-link">Explore archive <ArrowUpRight size={15} /></span>
            </div>
          </a>

          <a href="/striking" className="category-tile category-tile--striking">
            <div className="category-tile-art">
              <span className="category-number">02 / DISCIPLINE</span>
              <span className="category-art-word">STRIKE</span>
              <span className="category-art-icon"><Activity size={34} /></span>
              <span className="category-open"><ArrowUpRight size={21} /></span>
            </div>
            <div className="category-tile-copy">
              <div>
                <p className="eyebrow">BOXING · MUAY THAI · KICKBOXING</p>
                <h3>Striking</h3>
                <p>Timing, distance, pressure and precision.</p>
              </div>
              <span className="category-link">Explore archive <ArrowUpRight size={15} /></span>
            </div>
          </a>
        </div>
      </section>

      {/* RECENT VIDEOS */}
      <section className="video-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">THE ARCHIVE</p>
            <h2>Recent sessions</h2>
          </div>

          <span className="count">
            {(videos?.length ?? 0).toString().padStart(2, "0")} VIDEOS
          </span>
        </div>

        {error && <p className="notice">{error}</p>}

        {videos.length > 0 ? (
          <div className="video-grid">
            {videos.slice(0, 4).map((video, index) => (
              <VideoCard key={video.id ?? video.youtube_id ?? index} video={video} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-state-mark">SS</span>
            <h3>No sessions in the archive yet.</h3>
            <p>New training footage will appear here when it is added.</p>
          </div>
        )}

        <p className="privacy-note">
          This page uses basic, privacy-conscious visit analytics.
          Approximate location may be unavailable or inaccurate.
          No precise GPS location is collected.
        </p>
      </section>

      <footer>
        SPARRINGSCOPE <span>KEEP SHOWING UP.</span>
      </footer>
    </main>
  );
}

// --------------------------------------------------
// PRIVATE ANALYTICS DASHBOARD
// --------------------------------------------------

function Dashboard() {
  
  const [token, setToken] = useState(
    sessionStorage.getItem(ADMIN_TOKEN_KEY) || ""
  );

  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  async function load(value = token) {
    setError("");

    try {
      const response = await fetch("/api/admin/analytics", {
        headers: {
          Authorization: `Bearer ${value}`,
        },
      });

      if (!response.ok) {
        throw new Error(
          response.status === 401
            ? "Invalid admin token."
            : "Could not load analytics."
        );
      }

      const result = await response.json();

      sessionStorage.setItem(ADMIN_TOKEN_KEY, value);
      setData(result);
    } catch (err) {
      setError(err.message);
      setData(null);
    }
  }

  const chartData = useMemo(() => {
    if (!data) return [];

    const counts = {};

    (data.recent ?? []).forEach((event) => {
      const device = event.device || "Unknown";

      counts[device] = (counts[device] || 0) + 1;
    });

    return Object.entries(counts).map(([device, visits]) => ({
      device,
      visits,
    }));
  }, [data]);

  // LOGIN SCREEN
  if (!data) {
    return (
      <main className="admin-shell">
        <div className="login-card">
          <span className="mark">SS</span>

          <p className="eyebrow">PRIVATE AREA</p>

          <h1>
            Analytics
            <br />
            <em>dashboard.</em>
          </h1>

          <label>
            Admin token

            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste ADMIN_TOKEN from .env"
            />
          </label>

          <button onClick={() => load()}>
            Unlock dashboard <ArrowUpRight size={16} />
          </button>

          {error && <p className="notice">{error}</p>}

          <a href="/">← Back to video page</a>
        </div>
      </main>
    );
  }

  // ANALYTICS DASHBOARD
  return (
    <main className="dashboard">
      <header className="dash-header">
        <div>
          <p className="eyebrow">
            SPARRINGSCOPE / PRIVATE ANALYTICS
          </p>

          <h1>Visitor overview</h1>
          <p className="dash-subtitle">Your archive, audience and activity at a glance.</p>
        </div>

        <button
          className="secondary"
          onClick={() => load()}
        >
          Refresh data
        </button>
      </header>

      <VideoManager token={token} />

      <section className="stats">
        <div className="stat">
          <Eye />
          <span>TOTAL VISITS</span>
          <strong>{data.total_clicks ?? 0}</strong>
        </div>

        <div className="stat">
          <Globe2 />
          <span>UNIQUE BROWSER ESTIMATE</span>
          <strong>{data.unique_browsers_estimate ?? 0}</strong>
        </div>

        <div className="stat">
          <Activity />
          <span>TRACKING PHASE</span>
          <strong className="phase">
            {(data.phase ?? "unknown").replaceAll("_", " ")}
          </strong>
        </div>
      </section>

      <section className="dash-grid">
        <div className="panel">
          <p className="eyebrow">
            DEVICE MIX · LAST 200 VISITS
          </p>

          <h2>Devices</h2>

          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#333"
                />

                <XAxis dataKey="device" stroke="#999" />
                <YAxis stroke="#999" />

                <Tooltip
                  contentStyle={{
                    background: "#171717",
                    border: "1px solid #444",
                  }}
                />

                <Bar
                  dataKey="visits"
                  fill="#d5ff54"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <p className="eyebrow">LOCATION DATA</p>
          <h2>Recent areas</h2>

          <p className="muted">
            Area lookup requires a locally installed MaxMind
            GeoLite2 City database. Without it, locations
            appear as Unknown.
          </p>
        </div>
      </section>

      {/* RECENT VISITS TABLE */}
      <section className="panel table-panel">
        <p className="eyebrow">LATEST ACTIVITY</p>
        <h2>Recent visits</h2>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>AREA</th>
                <th>DEVICE</th>
                <th>BROWSER / OS</th>
                <th>SCREEN</th>
                <th>PERIOD TAG</th>
                <th>TIME</th>
              </tr>
            </thead>

            <tbody>
              {(data.recent ?? []).map((event) => (
                <tr key={event.id}>
                  <td>{event.area ?? "Unknown"}</td>
                  <td>{event.device ?? "Unknown"}</td>

                  <td>
                    {event.browser ?? "Unknown"} /{" "}
                    {event.os ?? "Unknown"}
                  </td>

                  <td>{event.screen ?? "Unknown"}</td>

                  <td>
                    <span className="tag">
                      {event.source ?? "Unknown"}
                    </span>
                  </td>

                  <td>
                    {event.clicked_at
                      ? new Date(event.clicked_at).toLocaleString()
                      : "—"}
                  </td>
                </tr>
              ))}

              {(data.recent ?? []).length === 0 && (
                <tr>
                  <td colSpan="6">No visits recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="privacy-note">
        Visitor IDs are random first-party browser IDs,
        not real-world identities. They can reset or differ
        across browsers and devices. Story/Highlight period
        is inferred from the configured publication time,
        not verified by Instagram.
      </p>
    </main>
  );
}

// --------------------------------------------------
// APPLICATION ROUTING
// --------------------------------------------------

function App() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";

  if (path === "/grappling") {
    return (
      <CategoryPage
        category="grappling"
        title="Grappling"
        description="Wrestling, Brazilian Jiu-Jitsu and ground game."
      />
    );
  }

  if (path === "/striking") {
    return (
      <CategoryPage
        category="striking"
        title="Striking"
        description="Boxing, Muay Thai and kickboxing."
      />
    );
  }

  if (path === "/admin") {
    return <Dashboard />;
  }

  return <PublicPage />;
}

createRoot(document.getElementById("root")).render(<App />);
