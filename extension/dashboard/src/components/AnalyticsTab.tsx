import { useState, useEffect, useRef } from 'preact/hooks';
import { Chart, registerables } from 'chart.js';
import type { AnalyticsData, SkillCount, TitleCount } from '@/types';
import { JOB_STATUS_LABELS } from '@/types';
import * as api from '@/lib/api';
import { BundleGate } from '@/components/BundleGate';
import { InsightsSection } from '@/components/InsightsSection';

Chart.register(...registerables);

export function AnalyticsTab() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const result = await api.getAnalytics();
        setData(result);
      } catch {
        setError('Could not load analytics. Check native helper installation.');
      }
    })();
  }, []);

  if (error) return <div class="tab-message">{error}</div>;
  if (!data) return <div class="tab-message">Loading analytics...</div>;

  const stats = data.statusStats ?? {};

  return (
    <div class="tab-analytics">
      <BundleGate feature="insights">
        <InsightsSection />
      </BundleGate>

      <div id="analyticsSummary" class="analytics-summary">
        You have {stats.total ?? 0} jobs tracked. Applied:{' '}
        {stats.applied ?? 0}, Interviewing: {(stats['interview-hr'] ?? 0) + (stats['interview-tech-intro'] ?? 0) + (stats['interview-tech-system'] ?? 0) + (stats['interview-tech-code'] ?? 0)}, Offer:{' '}
        {stats.offer ?? 0}.
      </div>

      <div class="charts-grid">
        <BarChart
          id="chartProgrammingLanguages"
          title="Programming Languages"
          items={data.skillsByCategory?.programming_language}
          color="#2563eb"
        />
        <BarChart
          id="chartDatabases"
          title="Databases"
          items={data.skillsByCategory?.database}
          color="#2563eb"
        />
        <BarChart
          id="chartCloudPlatforms"
          title="Cloud Platforms"
          items={data.skillsByCategory?.cloud}
          color="#2563eb"
        />
        <BarChart
          id="chartDevopsTools"
          title="DevOps Tools"
          items={data.skillsByCategory?.devops}
          color="#2563eb"
        />
        <BarChart
          id="chartOtherSkills"
          title="Other Technical Skills"
          items={data.skillsByCategory?.other}
          color="#2563eb"
        />
        <BarChart
          id="chartJobTitles"
          title="Top Job Titles"
          items={data.topJobTitles?.map((t: TitleCount) => ({
            skill: t.title,
            count: t.count,
          }))}
          color="#2563eb"
        />
      </div>

      <div class="chart-block chart-block-wide">
        <h3>Skills by Pipeline Stage</h3>
        <SkillsByStatusChart data={data} />
      </div>
    </div>
  );
}

// ---- Reusable horizontal bar chart ----

function BarChart({
  id,
  title,
  items,
  color,
}: {
  id: string;
  title: string;
  items?: SkillCount[];
  color: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !items?.length) return;

    chartRef.current?.destroy();

    chartRef.current = new Chart(canvasRef.current.getContext('2d')!, {
      type: 'bar',
      data: {
        labels: items.map((s) => s.skill),
        datasets: [
          {
            label: 'Jobs',
            data: items.map((s) => s.count),
            backgroundColor: color,
            borderRadius: 4,
            borderSkipped: false,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            beginAtZero: true,
            ticks: { precision: 0, color: '#8b949e', font: { size: 11 } },
            grid: { color: 'rgba(48, 54, 61, 0.5)' },
            border: { color: '#30363d' },
          },
          y: {
            ticks: { autoSkip: false, font: { size: 11 }, color: '#8b949e' },
            grid: { display: false },
            border: { color: '#30363d' },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
    };
  }, [items, color]);

  if (!items?.length) return null;

  return (
    <div class="chart-block">
      <h3>{title}</h3>
      <canvas id={id} ref={canvasRef} />
    </div>
  );
}

// ---- Skills by status grouped chart ----

function SkillsByStatusChart({ data }: { data: AnalyticsData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const statuses = ['saved', 'applied', 'interview-hr', 'interview-tech-intro', 'interview-tech-system', 'interview-tech-code', 'offer', 'rejected'];
    const skillsByStatus = data.skillsByStatus ?? {};

    const skillNamesSet = new Set<string>();
    statuses.forEach((status) => {
      (skillsByStatus[status] ?? []).forEach((s: SkillCount) =>
        skillNamesSet.add(s.skill)
      );
    });
    const skillNames = Array.from(skillNamesSet);

    if (!skillNames.length) return;

    const palette = ['#58a6ff', '#3fb950', '#d29922', '#f59e0b', '#d97706', '#b45309', '#a78bfa', '#f85149'];

    const datasets = statuses.map((status, idx) => ({
      label: JOB_STATUS_LABELS[status as keyof typeof JOB_STATUS_LABELS] ?? status,
      data: skillNames.map((skill) => {
        const match = (skillsByStatus[status] ?? []).find(
          (s: SkillCount) => s.skill === skill
        );
        return match ? match.count : 0;
      }),
      backgroundColor: palette[idx % palette.length],
    }));

    chartRef.current?.destroy();
    chartRef.current = new Chart(canvasRef.current.getContext('2d')!, {
      type: 'bar',
      data: { labels: skillNames, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'top', labels: { color: '#8b949e', font: { size: 11 } } }, title: { display: false } },
        scales: {
          x: {
            ticks: {
              maxRotation: 45,
              minRotation: 0,
              autoSkip: true,
              font: { size: 11 },
              color: '#8b949e',
            },
            grid: { color: 'rgba(48, 54, 61, 0.5)' },
            border: { color: '#30363d' },
          },
          y: {
            beginAtZero: true,
            ticks: { color: '#8b949e', font: { size: 11 } },
            grid: { color: 'rgba(48, 54, 61, 0.5)' },
            border: { color: '#30363d' },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
    };
  }, [data]);

  return <canvas id="chartSkillsByStatus" ref={canvasRef} />;
}
