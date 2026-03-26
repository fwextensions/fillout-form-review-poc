"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { FormReviewer, FeedbackItem } from "@/lib/form-reviewer";

const severityColors: Record<string, { border: string; badge: string; badgeText: string }> = {
  critical: { border: "border-red-500", badge: "bg-red-500", badgeText: "text-white" },
  warning: { border: "border-yellow-500", badge: "bg-yellow-500", badgeText: "text-gray-900" },
  info: { border: "border-blue-500", badge: "bg-blue-500", badgeText: "text-white" },
};

export default function Home() {
  const [url, setUrl] = useState("");
  const [feedback, setFeedback] = useState<FeedbackItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reviewerRef = useRef(new FormReviewer());
  const resultsRef = useRef<HTMLDivElement>(null);

  // Clear analysis when URL changes
  const handleUrlChange = useCallback((value: string) => {
    setUrl(value);
    setFeedback(null);
    setError(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setFeedback(null);

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }

      const results = reviewerRef.current.review(data);
      setFeedback(results);
    } catch {
      setError("Failed to connect to the server.");
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    if (feedback && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [feedback]);

  const critical = feedback?.filter((f) => f.severity === "critical") ?? [];
  const warnings = feedback?.filter((f) => f.severity === "warning") ?? [];
  const info = feedback?.filter((f) => f.severity === "info") ?? [];

  // Group by title, sorted by severity
  const grouped = feedback
    ? Object.entries(
        feedback.reduce<Record<string, FeedbackItem[]>>((acc, item) => {
          (acc[item.title] ??= []).push(item);
          return acc;
        }, {})
      ).sort((a, b) => {
        const order = { critical: 0, warning: 1, info: 2 };
        return order[a[1][0].severity] - order[b[1][0].severity];
      })
    : [];

  return (
    <div className="min-h-screen bg-gray-50 font-[family-name:var(--font-public-sans),system-ui,sans-serif]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Form review tool</h1>
          <p className="text-gray-600">
            Paste a Fillout form URL to get feedback based on SF.gov standards
          </p>
        </header>

        <section className="bg-white rounded shadow-sm p-6 mb-6">
          <label htmlFor="formUrl" className="block font-semibold mb-2">
            Fillout form URL
          </label>
          <div className="flex gap-3">
            <input
              id="formUrl"
              type="url"
              className="flex-1 border-2 border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              placeholder="https://digital.forms.sf.gov/t/..."
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
            <button
              onClick={handleSubmit}
              disabled={loading || !url.trim()}
              className="bg-blue-600 text-white px-5 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Loading…" : "Review form"}
            </button>
          </div>
          {error && (
            <p className="mt-3 text-sm text-red-600">{error}</p>
          )}
        </section>

        {feedback && (
          <section ref={resultsRef} className="bg-white rounded shadow-sm p-6">
            <h2 className="text-xl font-bold mb-4">Your review</h2>

            {/* Summary */}
            <div className="bg-gray-50 rounded p-4 mb-6">
              <p className="text-lg font-semibold mb-3">
                {critical.length > 0
                  ? "This form has critical issues that must be fixed before publishing."
                  : warnings.length > 5
                    ? "This form needs several improvements to meet sf.gov standards."
                    : warnings.length > 0
                      ? "This form is close to meeting standards with a few improvements needed."
                      : "Great work! This form follows sf.gov standards well."}
              </p>
              <div className="flex gap-6 text-sm">
                <div>
                  <span className="text-2xl font-bold text-green-600">
                    {feedback.length - critical.length - warnings.length}
                  </span>{" "}
                  passed
                </div>
                <div>
                  <span className="text-2xl font-bold text-red-500">{critical.length}</span> critical
                </div>
                <div>
                  <span className="text-2xl font-bold text-yellow-500">{warnings.length}</span> warnings
                </div>
                <div>
                  <span className="text-2xl font-bold text-blue-500">{info.length}</span> suggestions
                </div>
              </div>
            </div>

            {/* Grouped feedback */}
            <div className="space-y-4">
              {grouped.map(([title, items]) => (
                <FeedbackGroup key={title} title={title} items={items} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function FeedbackGroup({ title, items }: { title: string; items: FeedbackItem[] }) {
  const [collapsed, setCollapsed] = useState(items.length > 5);
  const severity = items[0].severity;
  const colors = severityColors[severity];

  return (
    <div className={`border-l-4 ${colors.border} bg-gray-50 rounded-r p-4`}>
      <div className="flex justify-between items-start mb-2">
        <span className="font-semibold">{title}</span>
        <span className={`${colors.badge} ${colors.badgeText} text-xs font-bold uppercase px-2 py-0.5 rounded`}>
          {severity}
        </span>
      </div>

      {items.length > 5 && (
        <div className="flex justify-between items-center bg-white rounded p-3 mb-3 text-sm">
          <span>{items.length} instances found.</span>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="bg-blue-600 text-white text-xs px-3 py-1 rounded hover:bg-blue-700"
          >
            {collapsed ? "Show all" : "Hide all"}
          </button>
        </div>
      )}

      {!collapsed && (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="bg-white rounded p-3 text-sm text-gray-600">
              {item.message}
              {item.location && (
                <span className="block text-xs text-gray-400 mt-1">Location: {item.location}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
