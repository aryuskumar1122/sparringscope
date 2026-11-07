
import { useCallback, useEffect, useRef, useState } from "react";
import { Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { apiUrl } from "../lib/api";

const EMPTY_FORM = {
  title: "",
  description: "",
  category: "grappling",
  youtube_url: "",
};

function getYouTubeUrl(video) {
  if (video.youtube_url) return video.youtube_url;
  if (video.youtube_id) {
    return `https://www.youtube.com/watch?v=${video.youtube_id}`;
  }
  return "";
}

export default function VideoManager({ token }) {
  const [videos, setVideos] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const titleInputRef = useRef(null);
  const formRef = useRef(null);

  const authHeaders = {
    Authorization: `Bearer ${token}`,
  };

  const showMessage = (text, type = "info") => {
    setMessage(text);
    setMessageType(type);
  };

  const refresh = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch(apiUrl("/api/videos"));

      if (!response.ok) {
        throw new Error(`Could not load videos (${response.status}).`);
      }

      const data = await response.json();

      const allVideos = Array.isArray(data)
        ? data
        : [
            ...(data?.grappling ?? []),
            ...(data?.striking ?? []),
          ];

      setVideos(allVideos);
    } catch (error) {
      showMessage(
        error.message || "Could not load videos.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function change(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function startEdit(video) {
    if (video.id === undefined || video.id === null) {
      showMessage(
        "This video has no database ID, so it cannot be edited.",
        "error"
      );
      return;
    }

    setEditingId(video.id);
    setIsEditing(true);

    setForm({
      title: video.title ?? "",
      description: video.description ?? "",
      category: video.category ?? "grappling",
      youtube_url: getYouTubeUrl(video),
    });

    showMessage(`Editing: ${video.title}`, "info");

    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      titleInputRef.current?.focus({
        preventScroll: true,
      });
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setIsEditing(false);
    setForm(EMPTY_FORM);
    showMessage("Edit cancelled.", "info");
  }

  async function submit(event) {
    event.preventDefault();

    if (saving) return;

    setSaving(true);
    setMessage("");

    try {
      const editing = isEditing && editingId !== null;

      const endpoint = editing
        ? `/api/admin/videos/${encodeURIComponent(editingId)}`
        : "/api/admin/videos";

      // Route all requests through the Render API base URL.
      const response = await fetch(apiUrl(endpoint), {
        method: editing ? "PATCH" : "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim(),
          category: form.category,
          youtube_url: form.youtube_url.trim(),
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        const detail = result?.detail;

        throw new Error(
          typeof detail === "string"
            ? detail
            : `Unable to ${editing ? "update" : "add"} video (${response.status}).`
        );
      }

      setEditingId(null);
      setIsEditing(false);
      setForm(EMPTY_FORM);

      showMessage(
        editing
          ? "Video updated successfully."
          : "Video added successfully.",
        "success"
      );

      await refresh();
    } catch (error) {
      showMessage(
        error.message || "Something went wrong while saving.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(video) {
    if (video.id === undefined || video.id === null) {
      showMessage(
        "This video has no database ID, so it cannot be deleted.",
        "error"
      );
      return;
    }

    if (
      !window.confirm(
        `Delete "${video.title}" from the archive?`
      )
    ) {
      return;
    }

    try {
      // Route DELETE request through Render.
      const response = await fetch(
        apiUrl(
          `/api/admin/videos/${encodeURIComponent(video.id)}`
        ),
        {
          method: "DELETE",
          headers: authHeaders,
        }
      );

      if (!response.ok) {
        const result = await response.json().catch(() => null);

        throw new Error(
          result?.detail ||
          `Unable to delete video (${response.status}).`
        );
      }

      if (isEditing && editingId === video.id) {
        setEditingId(null);
        setIsEditing(false);
        setForm(EMPTY_FORM);
      }

      showMessage(
        "Video deleted successfully.",
        "success"
      );

      await refresh();
    } catch (error) {
      showMessage(
        error.message || "Unable to delete video.",
        "error"
      );
    }
  }

  return (
    <section className="panel manager-panel">
      <div className="manager-heading">
        <div>
          <p className="eyebrow">CONTENT CONTROL</p>
          <h2>Video management</h2>
        </div>

        <button
          className="secondary"
          type="button"
          onClick={refresh}
          disabled={loading}
        >
          <RefreshCw size={15} />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <form
        ref={formRef}
        className="video-form"
        onSubmit={submit}
      >
        <h3>
          {isEditing
            ? `Edit video · #${editingId}`
            : "Add a YouTube video"}
        </h3>

        <label>
          Video title
          <input
            ref={titleInputRef}
            name="title"
            value={form.title}
            onChange={change}
            maxLength={160}
            required
            placeholder="Kickboxing sparring — Round 1"
          />
        </label>

        <label>
          YouTube URL
          <input
            name="youtube_url"
            type="url"
            value={form.youtube_url}
            onChange={change}
            required
            placeholder="https://www.youtube.com/watch?v=..."
          />
        </label>

        <label>
          Description
          <textarea
            name="description"
            value={form.description}
            onChange={change}
            maxLength={500}
            rows="3"
            placeholder="Describe this training session"
          />
        </label>

        <label>
          Category
          <select
            name="category"
            value={form.category}
            onChange={change}
          >
            <option value="grappling">Grappling</option>
            <option value="striking">Striking</option>
          </select>
        </label>

        <div className="form-actions">
          <button type="submit" disabled={saving}>
            {saving ? (
              "Saving..."
            ) : (
              <>
                <Plus size={16} />
                {isEditing ? "Save changes" : "Add video"}
              </>
            )}
          </button>

          {isEditing && (
            <button
              className="secondary"
              type="button"
              onClick={cancelEdit}
            >
              <X size={15} />
              Cancel edit
            </button>
          )}
        </div>

        <p className="muted form-hint">
          Supported: YouTube watch, youtu.be, Shorts and embed URLs.
          The video must allow embedding.
        </p>
      </form>

      {message && (
        <p
          className={`notice manager-message manager-message--${messageType}`}
          role="status"
        >
          {message}
        </p>
      )}

      <div className="managed-list">
        <h3>Published videos ({videos.length})</h3>

        {loading ? (
          <p className="muted">Loading videos...</p>
        ) : (
          videos.map((video) => (
            <article
              className={`managed-video${
                isEditing && editingId === video.id
                  ? " is-editing"
                  : ""
              }`}
              key={video.id ?? video.youtube_id}
            >
              <img
                src={
                  video.thumbnail_url ||
                  (video.youtube_id
                    ? `https://i.ytimg.com/vi/${video.youtube_id}/default.jpg`
                    : "")
                }
                alt=""
              />

              <div className="managed-video-info">
                <span className="tag">{video.category}</span>
                <strong>{video.title}</strong>
                <small>{video.description}</small>
              </div>

              <div className="managed-actions">
                <button
                  className="secondary icon-button"
                  type="button"
                  onClick={() => startEdit(video)}
                  aria-label={`Edit ${video.title}`}
                  title="Edit video"
                >
                  <Pencil size={16} />
                </button>

                <button
                  className="danger icon-button"
                  type="button"
                  onClick={() => remove(video)}
                  aria-label={`Delete ${video.title}`}
                  title="Delete video"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))
        )}

        {!loading && videos.length === 0 && (
          <p className="muted">
            No videos in the archive yet.
          </p>
        )}
      </div>
    </section>
  );
}
