import type { Feedback } from "@shared/types";
import { Check, Loader2, Pencil, Trash2 } from "lucide-preact";
import { flushSync } from "preact/compat";
import { useEffect, useRef, useState } from "preact/hooks";
import { api } from "../services/api";
import "./Feedbacks.css";

const formatDate = (isoString: string) => {
  // SQLite CURRENT_TIMESTAMP is in UTC but 'YYYY-MM-DD HH:MM:SS' format.
  // We need to ensure it's treated as UTC.
  const dateStr = isoString.endsWith("Z")
    ? isoString
    : isoString.replace(" ", "T") + "Z";
  const date = new Date(dateStr);

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const timeStr = date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  if (isToday) {
    return `Today, ${timeStr}`;
  }
  return `${date.toLocaleDateString()} ${timeStr}`;
};

const sortFeedbacks = (list: Feedback[]) => {
  return [...list].sort((a, b) => {
    // First by isAddressed (false < true)
    if (a.isAddressed !== b.isAddressed) {
      return a.isAddressed ? 1 : -1;
    }
    // Then by createdAt desc
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
};

export function Feedbacks() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [newFeedbackContent, setNewFeedbackContent] = useState("");
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");

  const inputRef = useRef<HTMLTextAreaElement>(null);

  const fetchFeedbacks = async () => {
    try {
      const data = await api.getFeedbacks();
      setFeedbacks(sortFeedbacks(data));
    } catch (err) {
      console.error("Failed to fetch feedbacks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const handleAddFeedback = async () => {
    if (!newFeedbackContent.trim()) return;

    setSubmitting(true);
    try {
      await api.createFeedback(newFeedbackContent);
      setNewFeedbackContent("");
      setIsInputExpanded(false);
      await fetchFeedbacks();
    } catch (err) {
      console.error("Failed to create feedback:", err);
      alert("Failed to create feedback");
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputFocus = () => {
    setIsInputExpanded(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this feedback?")) return;
    try {
      await api.deleteFeedback(id);

      const update = () => {
        setFeedbacks((prev) => prev.filter((f) => f.id !== id));
      };

      if ((document as any).startViewTransition) {
        (document as any).startViewTransition(() => {
          flushSync(update);
        });
      } else {
        update();
      }
    } catch (err) {
      console.error("Failed to delete feedback:", err);
      alert("Failed to delete feedback");
    }
  };

  const handleToggleAddressed = async (feedback: Feedback) => {
    try {
      // Optimistic update
      const updatedFeedback = {
        ...feedback,
        isAddressed: !feedback.isAddressed,
      };

      const update = () => {
        setFeedbacks((prev) =>
          sortFeedbacks(
            prev.map((f) => (f.id === feedback.id ? updatedFeedback : f))
          )
        );
      };

      if ((document as any).startViewTransition) {
        (document as any).startViewTransition(() => {
          flushSync(update);
        });
      } else {
        update();
      }

      // Actual API call
      await api.updateFeedback(feedback.id, {
        isAddressed: !feedback.isAddressed,
      });
    } catch (err) {
      console.error("Failed to update feedback:", err);
      alert("Failed to update feedback");
    }
  };

  const startEditing = (feedback: Feedback) => {
    setEditingId(feedback.id);
    setEditContent(feedback.content);
  };

  const saveEdit = async (id: number) => {
    try {
      const updated = await api.updateFeedback(id, {
        content: editContent,
      });
      setFeedbacks(feedbacks.map((f) => (f.id === id ? updated : f)));
      setEditingId(null);
      setEditContent("");
    } catch (err) {
      console.error("Failed to update feedback:", err);
      alert("Failed to update feedback");
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent("");
  };

  if (loading) {
    return (
      <div
        class="feedbacks-page"
        style={{ paddingTop: "2rem", textAlign: "center" }}
      >
        <Loader2 class="spin" />
      </div>
    );
  }

  return (
    <div class="feedbacks-page">
      <h2>Feedbacks</h2>

      <div class="input-section">
        <textarea
          ref={inputRef}
          class={`feedback-input ${isInputExpanded || newFeedbackContent ? "feedback-input-expanded" : ""}`}
          placeholder="Add a feedback..."
          value={newFeedbackContent}
          onInput={(e) => setNewFeedbackContent(e.currentTarget.value)}
          onFocus={handleInputFocus}
          onBlur={() => {
            // Small delay to allow button click if needed, though button usually disabled if empty
            if (!newFeedbackContent) setIsInputExpanded(false);
          }}
          rows={isInputExpanded ? 4 : 1}
        />
        {(isInputExpanded || newFeedbackContent) && (
          <div class="submit-btn">
            <button
              onClick={handleAddFeedback}
              disabled={submitting || !newFeedbackContent.trim()}
            >
              {submitting ? <Loader2 class="spin" size={16} /> : "Add Feedback"}
            </button>
          </div>
        )}
      </div>

      <div class="feedbacks-list">
        {feedbacks.length === 0 ? (
          <div class="empty-state">
            <p>No feedbacks yet.</p>
          </div>
        ) : (
          <>
            {feedbacks
              .filter((f) => !f.isAddressed)
              .map((feedback) => (
                <div
                  key={feedback.id}
                  class={`feedback-card ${feedback.isAddressed ? "addressed" : ""}`}
                  style={{ viewTransitionName: `feedback-${feedback.id}` }}
                >
                  <div class="card-header">
                    <div
                      class="header-left"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                      }}
                    >
                      <button
                        class={`checkbox-btn ${feedback.isAddressed ? "checked" : ""}`}
                        onClick={() => handleToggleAddressed(feedback)}
                        title={
                          feedback.isAddressed
                            ? "Mark as not addressed"
                            : "Mark as addressed"
                        }
                      >
                        {feedback.isAddressed && <Check size={14} />}
                      </button>
                      <span class="timestamp">
                        {formatDate(feedback.createdAt)}
                      </span>
                    </div>
                    <div class="actions">
                      <button
                        class="btn-icon"
                        onClick={() => startEditing(feedback)}
                        title="Edit"
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        class="btn-icon danger"
                        onClick={() => handleDelete(feedback.id)}
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  <div class="card-body">
                    {editingId === feedback.id ? (
                      <div class="edit-mode">
                        <textarea
                          value={editContent}
                          onInput={(e) => setEditContent(e.currentTarget.value)}
                          rows={3}
                        />
                        <div class="edit-actions">
                          <button
                            class="btn-small primary"
                            onClick={() => saveEdit(feedback.id)}
                            style={{
                              padding: "4px 8px",
                              borderRadius: "4px",
                              border: "none",
                              background: "var(--primary)",
                              color: "white",
                              cursor: "pointer",
                            }}
                          >
                            Save
                          </button>
                          <button
                            class="btn-small"
                            onClick={cancelEdit}
                            style={{
                              padding: "4px 8px",
                              borderRadius: "4px",
                              border: "1px solid var(--border)",
                              background: "transparent",
                              color: "var(--text)",
                              cursor: "pointer",
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div class="feedback-content">
                        {feedback.content.split("\n").map((line, i) => (
                          <p key={i}>{line}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

            {feedbacks.some((f) => f.isAddressed) && (
              <div class="feedbacks-divider">
                <span>Completed</span>
              </div>
            )}

            {feedbacks
              .filter((f) => f.isAddressed)
              .map((feedback) => (
                <div
                  key={feedback.id}
                  class={`feedback-card ${feedback.isAddressed ? "addressed" : ""}`}
                  style={{ viewTransitionName: `feedback-${feedback.id}` }}
                >
                  <div class="card-header">
                    <div
                      class="header-left"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                      }}
                    >
                      <button
                        class={`checkbox-btn ${feedback.isAddressed ? "checked" : ""}`}
                        onClick={() => handleToggleAddressed(feedback)}
                        title={
                          feedback.isAddressed
                            ? "Mark as not addressed"
                            : "Mark as addressed"
                        }
                      >
                        {feedback.isAddressed && <Check size={14} />}
                      </button>
                      <span class="timestamp">
                        {formatDate(feedback.createdAt)}
                      </span>
                    </div>
                    <div class="actions">
                      <button
                        class="btn-icon"
                        onClick={() => startEditing(feedback)}
                        title="Edit"
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        class="btn-icon danger"
                        onClick={() => handleDelete(feedback.id)}
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  <div class="card-body">
                    {editingId === feedback.id ? (
                      <div class="edit-mode">
                        <textarea
                          value={editContent}
                          onInput={(e) => setEditContent(e.currentTarget.value)}
                          rows={3}
                        />
                        <div class="edit-actions">
                          <button
                            class="btn-small primary"
                            onClick={() => saveEdit(feedback.id)}
                            style={{
                              padding: "4px 8px",
                              borderRadius: "4px",
                              border: "none",
                              background: "var(--primary)",
                              color: "white",
                              cursor: "pointer",
                            }}
                          >
                            Save
                          </button>
                          <button
                            class="btn-small"
                            onClick={cancelEdit}
                            style={{
                              padding: "4px 8px",
                              borderRadius: "4px",
                              border: "1px solid var(--border)",
                              background: "transparent",
                              color: "var(--text)",
                              cursor: "pointer",
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div class="feedback-content">
                        {feedback.content.split("\n").map((line, i) => (
                          <p key={i}>{line}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </>
        )}
      </div>
    </div>
  );
}
