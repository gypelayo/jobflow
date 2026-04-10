import { useState } from 'preact/hooks';
import * as api from '@/lib/api';
import { renderMarkdown } from '@/lib/markdown';
import { downloadCvAsPdf } from '@/lib/pdf';
import { BundleGate } from '@/components/BundleGate';

interface CvSectionProps {
  jobId: number;
  initialMarkdown: string;
}

export function CvSection({ jobId, initialMarkdown }: CvSectionProps) {
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [showPreview, setShowPreview] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const cv = await api.generateCv(jobId);
      setMarkdown(cv);
      setShowPreview(false);
    } catch (err) {
      alert(
        err instanceof Error
          ? `Failed to generate CV: ${err.message}`
          : 'Failed to generate CV.'
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    setSaveStatus('Saving...');
    try {
      await api.updateJobCv(jobId, markdown);
      setSaveStatus('Saved!');
      setTimeout(() => setSaveStatus(''), 1500);
    } catch {
      setSaveStatus('Save failed');
      setTimeout(() => setSaveStatus(''), 2000);
    }
  };

  const handleRender = () => {
    if (!markdown.trim()) {
      alert('Generate a CV first.');
      return;
    }
    setShowPreview(true);
  };

  return (
    <BundleGate feature="cv-generation">
      <div class="cv-columns">
      <div class="cv-editor">
        <h3>Generated CV (Markdown)</h3>
        <p class="small">
          AI-generated draft based on your profile and this job. Edit the
          markdown and save.
        </p>
        <textarea
          rows={16}
          placeholder="No CV generated for this job yet."
          value={markdown}
          onInput={(e) =>
            setMarkdown((e.target as HTMLTextAreaElement).value)
          }
        />
        <div class="cv-controls">
          <button
            class="cv-generate-btn"
            disabled={generating}
            onClick={handleGenerate}
          >
            {generating ? 'Generating...' : 'Generate CV'}
          </button>
          <button onClick={handleSave}>
            {saveStatus || 'Save CV'}
          </button>
          <button onClick={handleRender}>Render Markdown</button>
          <button onClick={() => void downloadCvAsPdf(markdown)}>
            Download as PDF
          </button>
        </div>
      </div>
      <div
        class={`cv-rendered ${!showPreview ? 'empty' : ''}`}
        dangerouslySetInnerHTML={{
          __html: showPreview
            ? renderMarkdown(markdown)
            : '<em>Click "Render Markdown" to preview the CV here.</em>',
        }}
      />
    </div>
    </BundleGate>
  );
}
