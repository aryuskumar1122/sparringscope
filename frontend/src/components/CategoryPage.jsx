import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, Activity } from "lucide-react";
import VideoCard from "./VideoCard";

export default function CategoryPage({ category, title, description }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/videos")
      .then((response) => {
        if (!response.ok) throw new Error("Failed to load videos");
        return response.json();
      })
      .then((data) => {
        if (active) setVideos(Array.isArray(data) ? data.filter(v => v.category === category) : (data?.[category] ?? []));
      })
      .catch((err) => {
        console.error(err);
        if (active) setError("Could not load videos. Please try again later.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [category]);

  return (
    <main className={`category-page category-page--${category}`}>
      <nav className="topbar">
        <a href="/" className="back-link"><ArrowLeft size={16} /> Back to archive</a>
        <a href="/admin">Dashboard <ArrowUpRight size={15} /></a>
      </nav>

      <section className="category-hero">
        <div className="category-hero-copy">
          <p className="eyebrow">SPARRINGSCOPE / TRAINING ARCHIVE</p>
          <h1>{title}<span>.</span></h1>
          <p>{description}</p>
          <div className="category-hero-meta">
            <span><Activity size={15} /> TRAINING FOOTAGE</span>
            <span>{String(videos.length).padStart(2, "0")} SESSIONS</span>
          </div>
        </div>
        <div className="category-hero-stamp" aria-hidden="true">
          <span>{category === "grappling" ? "GROUND" : "STRIKE"}</span>
          <b>SS / {category === "grappling" ? "01" : "02"}</b>
        </div>
      </section>

      <section className="category-archive">
        <div className="section-heading">
          <div>
            <p className="eyebrow">THE COLLECTION</p>
            <h2>Sessions <span>({String(videos.length).padStart(2, "0")})</span></h2>
          </div>
          <span className="archive-note">WATCH · STUDY · REPEAT</span>
        </div>

        {loading ? <p className="muted">Loading sessions...</p>
          : error ? <p className="notice">{error}</p>
          : videos.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-mark">SS</span>
              <h3>No sessions here yet.</h3>
              <p>Check back when new footage is added to this discipline.</p>
            </div>
          ) : <div className="video-grid">{videos.map((video) =>
              <VideoCard key={video.id ?? video.youtube_id} video={video} />)}</div>}
      </section>

      <footer>SPARRINGSCOPE <span>KEEP SHOWING UP.</span></footer>
    </main>
  );
}
