import { useState, useEffect } from 'preact/hooks';
import type { Insight, InsightsResult } from '@/types';
import * as api from '@/lib/api';
import { MIN_APPLIED_JOBS } from '@/lib/insights';

const LEVEL_COLORS: Record<string, string> = {
  positive: 'var(--accent-green)',
  warning: 'var(--accent-orange)',
  neutral: 'var(--accent-blue)',
};

const LEVEL_BG: Record<string, string> = {
  positive: 'rgba(63,185,80,0.06)',
  warning: 'rgba(210,153,34,0.06)',
  neutral: 'rgba(88,166,255,0.06)',
};

const LEVEL_BORDER: Record<string, string> = {
  positive: 'rgba(63,185,80,0.2)',
  warning: 'rgba(210,153,34,0.2)',
  neutral: 'rgba(88,166,255,0.2)',
};

const LEVEL_ICONS: Record<string, string> = {
  positive: '↑',
  warning: '⚠',
  neutral: '→',
};

const CONFIDENCE_LABELS: Record<string, string> = {
  low: 'Low confidence',
  medium: 'Medium confidence',
  high: 'High confidence',
};

export function InsightsSection() {
  const [result, setResult] = useState<InsightsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await api.getInsights();
        setResult(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to compute insights');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div class="tab-message">Computing insights...</div>;
  if (error) return <div class="tab-message" style={{ color: 'var(--accent-red)' }}>{error}</div>;
  if (!result) return null;

  if (!result.hasEnoughData) {
    const remaining = MIN_APPLIED_JOBS - result.appliedCount;
    const progress = Math.round((result.appliedCount / MIN_APPLIED_JOBS) * 100);
    return (
      <div class="insights-empty">
        <div class="insights-empty-icon">📊</div>
        <h3>Not enough data yet</h3>
        <p>
          Apply to {remaining} more job{remaining === 1 ? '' : 's'} to unlock insights.
          Insights appear once you have {MIN_APPLIED_JOBS} applications tracked.
        </p>
        <div class="insights-progress-bar">
          <div class="insights-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span class="insights-progress-label">
          {result.appliedCount} / {MIN_APPLIED_JOBS} applications
        </span>
      </div>
    );
  }

  if (!result.insights.length) {
    return (
      <div class="insights-empty">
        <div class="insights-empty-icon">🔍</div>
        <h3>No strong patterns yet</h3>
        <p>
          You have {result.appliedCount} applications tracked but no segment stands out
          significantly yet. Keep applying and updating statuses — patterns will emerge.
        </p>
      </div>
    );
  }

  return (
    <div class="insights-section">
      <div class="insights-header">
        <h2>Insights</h2>
        <span class="insights-meta">Based on {result.appliedCount} applications</span>
      </div>
      <div class="insights-grid">
        {result.insights.map((insight) => (
          <InsightCard key={insight.id} insight={insight} />
        ))}
      </div>
    </div>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const [expanded, setExpanded] = useState(false);
  const color = LEVEL_COLORS[insight.level];
  const bg = LEVEL_BG[insight.level];
  const border = LEVEL_BORDER[insight.level];
  const icon = LEVEL_ICONS[insight.level];
  const maxRate = Math.max(...insight.data.map(d => d.rate), 1);

  return (
    <div
      class="insight-card"
      style={{ background: bg, borderColor: border }}
      onClick={() => setExpanded(e => !e)}
    >
      <div class="insight-card-header">
        <span class="insight-level-icon" style={{ color }}>{icon}</span>
        <h3 class="insight-headline">{insight.headline}</h3>
        <span class="insight-confidence" style={{ color: 'var(--text-muted)' }}>
          {CONFIDENCE_LABELS[insight.confidence]}
        </span>
      </div>

      <p class="insight-description">{insight.description}</p>

      {expanded && (
        <>
          <div class="insight-bars">
            {insight.data.map((point) => (
              <div key={point.label} class="insight-bar-row">
                <span class="insight-bar-label">{point.label}</span>
                <div class="insight-bar-track">
                  <div
                    class="insight-bar-fill"
                    style={{
                      width: `${(point.rate / maxRate) * 100}%`,
                      background: point.rate === maxRate ? color : 'var(--bg-hover)',
                    }}
                  />
                </div>
                <span class="insight-bar-pct" style={{ color: point.rate === maxRate ? color : 'var(--text-muted)' }}>
                  {point.rate}%
                  <span class="insight-bar-count"> ({point.responses}/{point.applied})</span>
                </span>
              </div>
            ))}
          </div>

          <div class="insight-action">
            <span class="insight-action-label">→</span>
            {insight.action}
          </div>
        </>
      )}

      <button class="insight-expand-btn" style={{ color }}>
        {expanded ? 'Show less ↑' : 'See breakdown ↓'}
      </button>
    </div>
  );
}
