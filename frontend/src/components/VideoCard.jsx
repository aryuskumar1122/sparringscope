import { ArrowUpRight, Play } from "lucide-react";

export default function VideoCard({ video }) {
  const youtubeId = video.youtube_id;
  const embedUrl = video.embed_url || `https://www.youtube-nocookie.com/embed/${youtubeId}`;
  const thumbnail = youtubeId ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg` : "";

  return (
    <article className="video-card">
      <a className="video-card-media" href={`https://www.youtube.com/watch?v=${youtubeId}`}
         target="_blank" rel="noreferrer" aria-label={`Watch ${video.title} on YouTube`}>
        {thumbnail && <img src={thumbnail} alt="" loading="lazy" />}
        <span className="video-card-index">{video.category === "grappling" ? "GROUND" : video.category === "striking" ? "STRIKING" : "SESSION"}</span>
        <span className="video-card-play"><Play size={19} fill="currentColor" /></span>
        <span className="video-card-media-caption">OPEN SESSION <ArrowUpRight size={14} /></span>
      </a>
      <div className="video-card-copy">
        <div>
          <p className="eyebrow">TRAINING LOG / {video.category || "ARCHIVE"}</p>
          <h3>{video.title}</h3>
          {video.description && <p>{video.description}</p>}
        </div>
        <a href={embedUrl} target="_blank" rel="noreferrer">
          Watch session <ArrowUpRight size={14} />
        </a>
      </div>
    </article>
  );
}
