import { useState, useEffect, useRef } from 'preact/hooks';
import { loadSettings, saveSettings, getPerplexityKey } from '@/lib/storage';
import { exportDatabase, importDatabase } from '@/lib/db';
import { useAgentSync, UseAgentSyncResult } from '@/hooks/useAgentSync';
import { verifyLicenseKey, computeLicenseStatus } from '@/lib/license';
import { useLicense } from '@/hooks/useLicense';

interface SettingsTabProps {
  agentSync?: UseAgentSyncResult;
}

export function SettingsTab({ agentSync: agentSyncProp }: SettingsTabProps = {}) {
  const [provider, setProvider] = useState('ollama');
  const [ollamaModel, setOllamaModel] = useState('qwen2.5:7b');
  const [perplexityModel, setPerplexityModel] = useState('sonar-pro');
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-mini');
  const [anthropicModel, setAnthropicModel] = useState('claude-3-5-haiku-20241022');
  const [geminiModel, setGeminiModel] = useState('gemini-1.5-flash');
  const [apiKey, setApiKey] = useState('');
  const [providerStatus, setProviderStatus] = useState('');
  const [extVersion, setExtVersion] = useState('');
  const [dbStatus, setDbStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ghostedDays, setGhostedDays] = useState(14);
  const [ghostedStatus, setGhostedStatus] = useState('');
  const [licenseInput, setLicenseInput] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [licenseStatus, setLicenseStatus] = useState('');

  // Agent sync state — use prop instance from App if provided (avoids double state)
  const agentSyncFallback = useAgentSync();
  const agentSync = agentSyncProp ?? agentSyncFallback;
  const license = useLicense();

  useEffect(() => {
    (async () => {
      const settings = await loadSettings();
      setProvider(settings.provider || 'ollama');
      setOllamaModel(settings.ollamaModel || 'qwen2.5:7b');
      setPerplexityModel(settings.perplexityModel || 'sonar-pro');
      setOpenaiModel(settings.openaiModel || 'gpt-4o-mini');
      setAnthropicModel(settings.anthropicModel || 'claude-3-5-haiku-20241022');
      setGeminiModel(settings.geminiModel || 'gemini-1.5-flash');

      // Load the appropriate API key based on current provider
      let key = '';
      switch (settings.provider) {
        case 'perplexity':
          key = getPerplexityKey(settings) || '';
          break;
        case 'openai':
          key = settings.openaiApiKey || '';
          break;
        case 'anthropic':
          key = settings.anthropicApiKey || '';
          break;
        case 'gemini':
          key = settings.geminiApiKey || '';
          break;
      }
      setApiKey(key);
    })();

    try {
      setExtVersion(chrome.runtime.getManifest().version);
    } catch {
      setExtVersion('unknown');
    }

    // Load ghosted threshold
    (async () => {
      const settings = await loadSettings();
      setGhostedDays(typeof settings.ghostedDays === 'number' ? settings.ghostedDays : 14);
      setLicenseExpiry(settings.licenseExpiry ?? '');
    })();
  }, []);

  // Load API key when provider changes
  useEffect(() => {
    (async () => {
      const settings = await loadSettings();
      let key = '';
      switch (provider) {
        case 'perplexity':
          key = getPerplexityKey(settings) || '';
          break;
        case 'openai':
          key = settings.openaiApiKey || '';
          break;
        case 'anthropic':
          key = settings.anthropicApiKey || '';
          break;
        case 'gemini':
          key = settings.geminiApiKey || '';
          break;
      }
      setApiKey(key);
    })();
  }, [provider]);

  const handleSaveProvider = async () => {
    const updates: Record<string, string> = { provider };

    if (provider === 'ollama') {
      const model = ollamaModel.trim() || 'qwen2.5:7b';
      updates.ollamaModel = model;
      setOllamaModel(model);
    } else if (provider === 'hosted') {
      // No API key needed — license key is already stored separately
    } else {
      const key = apiKey.trim();
      if (!key) {
        setProviderStatus(`${provider.charAt(0).toUpperCase() + provider.slice(1)} requires an API key.`);
        return;
      }

      switch (provider) {
        case 'openai':
          const openaiModelValue = openaiModel.trim() || 'gpt-4o-mini';
          updates.openaiModel = openaiModelValue;
          updates.openaiApiKey = key;
          setOpenaiModel(openaiModelValue);
          break;
        case 'anthropic':
          const anthropicModelValue = anthropicModel.trim() || 'claude-3-5-haiku-20241022';
          updates.anthropicModel = anthropicModelValue;
          updates.anthropicApiKey = key;
          setAnthropicModel(anthropicModelValue);
          break;
        case 'gemini':
          const geminiModelValue = geminiModel.trim() || 'gemini-1.5-flash';
          updates.geminiModel = geminiModelValue;
          updates.geminiApiKey = key;
          setGeminiModel(geminiModelValue);
          break;
        case 'perplexity':
          const perplexityModelValue = perplexityModel.trim() || 'sonar-pro';
          updates.perplexityModel = perplexityModelValue;
          updates.perplexityApiKey = key;
          updates.perplexityKey = key;
          setPerplexityModel(perplexityModelValue);
          break;
      }
    }

    await saveSettings(updates);
    setProviderStatus('Saved.');
  };

  const handleExportDb = async () => {
    setDbStatus('Exporting...');
    try {
      const data = await exportDatabase();
      const blob = new Blob([data.buffer as ArrayBuffer], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);

      if (typeof chrome !== 'undefined' && chrome.downloads?.download) {
        chrome.downloads.download({
          url,
          filename: `jobflow-backup-${new Date().toISOString().slice(0, 10)}.db`,
          saveAs: true,
        });
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = `jobflow-backup-${new Date().toISOString().slice(0, 10)}.db`;
        a.click();
        URL.revokeObjectURL(url);
      }

      setDbStatus('Database exported.');
    } catch (err) {
      setDbStatus(`Export failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  };

  const handleImportDb = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    setDbStatus('Importing...');
    try {
      const buffer = await file.arrayBuffer();
      await importDatabase(new Uint8Array(buffer));
      setDbStatus('Database imported. Reload the page to see changes.');
    } catch (err) {
      setDbStatus(`Import failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    }

    input.value = '';
  };

  // ---- Agent export handlers ----

  const [agentExportStatus, setAgentExportStatus] = useState('');

  const AGENTS_MD = `# JobFlow Agent Guide

This directory contains \`db.json\` — the JobFlow database export your AI agent can read and write.

## File location

\`~/.jobflow/db.json\`

## File format

\`\`\`json
{
  "jobs": [...],
  "profile": {...},
  "exportedAt": "2024-01-01T00:00:00.000Z"
}
\`\`\`

---

## \`jobs\` array

Each job entry has the following top-level fields:

| Field | Type | Description |
|-------|------|-------------|
| \`id\` | number | Unique job ID |
| \`sourceUrl\` | string | Original URL of the job posting |
| \`status\` | string | Current pipeline stage (see below) |
| \`notes\` | string | Agent/user notes (append, don't overwrite) |
| \`rating\` | number? | Fit score 1–5 (optional) |
| \`extracted\` | object | Full structured job data (see below) |

**Valid \`status\` values** (pipeline order):

\`saved\` → \`applied\` → \`interview-hr\` → \`interview-tech-intro\` → \`interview-tech-system\` → \`interview-tech-code\` → \`offer\` / \`rejected\`

---

## \`extracted\` object (full job schema)

When adding a new job, populate \`extracted\` as fully as possible — every field you fill appears in the extension's job detail view.

\`\`\`json
{
  "source_url": "https://...",
  "extracted_at": "2024-01-01T00:00:00.000Z",

  "metadata": {
    "job_title": "Senior Software Engineer",
    "department": "Engineering",
    "seniority_level": "Senior",
    "job_function": "Backend"
  },

  "company_info": {
    "company_name": "Acme Corp",
    "industry": "SaaS",
    "company_size": "51-200",
    "location_full": "San Francisco, CA (Remote)",
    "location_city": "San Francisco",
    "location_country": "US"
  },

  "role_details": {
    "summary": "One-paragraph summary of the role.",
    "key_responsibilities": [
      "Design and build scalable APIs",
      "Own the deployment pipeline"
    ],
    "team_structure": "5-person backend team reporting to CTO"
  },

  "requirements": {
    "years_experience_min": 4,
    "years_experience_max": 8,
    "education_level": "Bachelor's or equivalent",
    "requires_specific_degree": false,
    "technical_skills": {
      "programming_languages": ["Go", "Python"],
      "frameworks": ["gRPC", "FastAPI"],
      "databases": ["PostgreSQL", "Redis"],
      "cloud_platforms": ["AWS"],
      "devops_tools": ["Docker", "Kubernetes"],
      "other": ["GraphQL"]
    },
    "soft_skills": ["Communication", "Ownership"],
    "nice_to_have": ["Rust experience", "Open-source contributions"]
  },

  "compensation": {
    "salary_min": 140000,
    "salary_max": 180000,
    "salary_currency": "USD",
    "has_equity": true,
    "has_remote_stipend": true,
    "benefits": ["Health insurance", "401k match", "PTO"],
    "offers_visa_sponsorship": false,
    "offers_health_insurance": true,
    "offers_pto": true,
    "offers_professional_development": true,
    "offers_401k": true
  },

  "work_arrangement": {
    "workplace_type": "remote",
    "job_type": "full-time",
    "is_remote_friendly": true,
    "timezone_requirements": "US timezones preferred"
  },

  "market_signals": {
    "urgency_level": "normal",
    "interview_rounds": 4,
    "has_take_home": false,
    "has_pair_programming": true
  }
}
\`\`\`

---

## \`profile\` object

| Field | Type | Description |
|-------|------|-------------|
| \`id\` | number | Always 1 |
| \`fullName\` | string | User's full name |
| \`email\` | string | Contact email |
| \`phone\` | string | Contact phone |
| \`location\` | string | User's location |
| \`currentRole\` | string | Current job title |
| \`yearsExperience\` | number | Years of experience |
| \`skills\` | string[] | User's skills |
| \`links\` | string[] | Portfolio/LinkedIn links |
| \`storyMarkdown\` | string | Bio/story in Markdown |

---

## Agent workflow

1. **Read** \`db.json\` to understand the current pipeline and user profile.
2. **Find jobs** on job boards that match the user's profile.
3. **Add new jobs** by appending to the \`jobs\` array — populate \`extracted\` as fully as possible.
4. **Update existing jobs** — change \`status\`, append to \`notes\`, set \`rating\`.
5. **Write** the modified JSON back to \`db.json\` (update \`exportedAt\` to current timestamp).
6. The extension auto-imports changes on next open (if connected) or when the user clicks Sync Now.

## Tips

- Always **append** to \`notes\` — don't overwrite existing notes.
- The \`id\` field for new jobs can be any number not already in use (or omit it — the extension will assign one).
- Populate \`extracted.requirements.technical_skills\` carefully — it drives the Skills analytics view.
- \`salary_min\`/\`salary_max\` are integers in the local currency (no commas, no symbols).
`;

  const handleExportAgent = async () => {
    setAgentExportStatus('Exporting...');
    try {
      const { listJobsFull, getProfile } = await import('@/lib/queries');
      const jobs = await listJobsFull();
      const profile = await getProfile();

      const exportData = {
        jobs: jobs.map(j => ({
          id: j.id,
          sourceUrl: j.sourceUrl,
          status: j.status,
          notes: j.notes,
          rating: j.rating,
          extracted: j.extracted,
        })),
        profile: profile ? {
          id: profile.id,
          fullName: profile.fullName,
          email: profile.email,
          phone: profile.phone,
          location: profile.location,
          currentRole: profile.currentRole,
          yearsExperience: profile.yearsExperience,
          skills: profile.skills,
          links: profile.links,
          storyMarkdown: profile.storyMarkdown,
        } : null,
        exportedAt: new Date().toISOString(),
      };

      // Download db.json
      const jsonBlob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const jsonUrl = URL.createObjectURL(jsonBlob);
      const jsonLink = document.createElement('a');
      jsonLink.href = jsonUrl;
      jsonLink.download = 'db.json';
      jsonLink.click();
      URL.revokeObjectURL(jsonUrl);

      // Download AGENTS.md
      const mdBlob = new Blob([AGENTS_MD], { type: 'text/markdown' });
      const mdUrl = URL.createObjectURL(mdBlob);
      const mdLink = document.createElement('a');
      mdLink.href = mdUrl;
      mdLink.download = 'AGENTS.md';
      mdLink.click();
      URL.revokeObjectURL(mdUrl);

      setAgentExportStatus('Exported db.json and AGENTS.md — save both to ~/.jobflow/');
    } catch (err) {
      setAgentExportStatus(`Export failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  };

  const agentFileInputRef = useRef<HTMLInputElement>(null);

  const handleAgentFileSelected = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    setAgentExportStatus('Importing...');
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.jobs || !Array.isArray(data.jobs)) {
        throw new Error('Invalid db.json format — missing jobs array');
      }

      const { importMcpJobs } = await import('@/lib/queries');
      const count = await importMcpJobs(data.jobs);
      setAgentExportStatus(`Imported ${count} jobs. Reload the page to see changes.`);
    } catch (err) {
      setAgentExportStatus(`Import failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    }

    input.value = '';
  };

  return (
    <div class="tab-settings">
      <h2>Settings</h2>

      <div class="settings-section">
        <div class="version-info">
          <span>
            Extension: <strong>{extVersion}</strong>
          </span>
        </div>
      </div>

      <div class="settings-section">
        <h3>Job Search Bundle</h3>
        {(() => {
          const status = computeLicenseStatus(licenseExpiry);
          if (status.isActive) {
            return (
              <div>
                <div class="license-active">
                  <span class="license-active-badge">Active</span>
                  <span class="license-active-detail">{status.daysRemaining} days remaining — expires {new Date(licenseExpiry).toLocaleDateString()}</span>
                </div>
                <button
                  style={{ marginTop: '10px', background: 'var(--bg-elevated)', color: 'var(--accent-red)', borderColor: 'rgba(248,81,73,0.2)', fontSize: '12px', padding: '4px 10px' }}
                  onClick={async () => {
                    await saveSettings({ licenseKey: '', licenseExpiry: '' });
                    setLicenseExpiry('');
                    setLicenseStatus('License removed.');
                  }}
                >Remove license</button>
              </div>
            );
          }
          return (
            <div>
              {status.isExpired && (
                <p class="settings-hint" style={{ color: 'var(--accent-red)', marginBottom: '8px' }}>
                  Your license expired on {new Date(licenseExpiry).toLocaleDateString()}. Purchase a new bundle to continue.
                </p>
              )}
              {!status.isExpired && (
                <p class="settings-hint">
                  Unlock CV generation and the insights engine. €29 · 90 days · one-time.
                  {' '}<a href="https://jobflow.lemonsqueezy.com" target="_blank" rel="noopener">Purchase &rarr;</a>
                </p>
              )}
              <label>License key</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="JOBFLOW-..."
                  value={licenseInput}
                  onInput={(e) => setLicenseInput((e.target as HTMLInputElement).value)}
                  style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                />
                <button onClick={async () => {
                  const key = licenseInput.trim();
                  if (!key) { setLicenseStatus('Please enter a license key.'); return; }
                  setLicenseStatus('Verifying...');
                  const payload = await verifyLicenseKey(key);
                  if (!payload) {
                    setLicenseStatus('Invalid license key.');
                    return;
                  }
                  await saveSettings({ licenseKey: key, licenseExpiry: payload.expiry });
                  setLicenseExpiry(payload.expiry);
                  setLicenseInput('');
                  setLicenseStatus('');
                }}>Activate</button>
              </div>
              <span class="status-text">{licenseStatus}</span>
            </div>
          );
        })()}
      </div>

      <div class="settings-section">
        <h3>LLM Provider</h3>
        <select
          value={provider}
          onChange={(e) => {
            setProvider((e.target as HTMLSelectElement).value);
            setProviderStatus('');
          }}
        >
          <option value="ollama">Ollama (local)</option>
          <option value="openai">OpenAI (cloud)</option>
          <option value="anthropic">Anthropic (cloud)</option>
          <option value="gemini">Google Gemini (cloud)</option>
          <option value="perplexity">Perplexity (cloud)</option>
          {license.isActive && (
            <option value="hosted">JobFlow (hosted) ✦</option>
          )}
        </select>

        {provider === 'ollama' && (
          <div class="provider-fields">
            <label>Model</label>
            <input
              type="text"
              placeholder="qwen2.5:7b"
              value={ollamaModel}
              onInput={(e) => setOllamaModel((e.target as HTMLInputElement).value)}
            />
            <p class="settings-hint">
              Requires Ollama running at localhost:11434. Pull the model first with{' '}
              <code>ollama pull {ollamaModel || 'qwen2.5:7b'}</code>.
            </p>
          </div>
        )}

        {provider === 'openai' && (
          <div class="provider-fields">
            <label>API Key</label>
            <input
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onInput={(e) => setApiKey((e.target as HTMLInputElement).value)}
            />
            <label>Model</label>
            <input
              type="text"
              placeholder="gpt-4o-mini"
              value={openaiModel}
              onInput={(e) => setOpenaiModel((e.target as HTMLInputElement).value)}
            />
            <p class="settings-hint">
              Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener">OpenAI Platform</a>.
              Popular models: gpt-4o, gpt-4o-mini, gpt-3.5-turbo.
            </p>
          </div>
        )}

        {provider === 'anthropic' && (
          <div class="provider-fields">
            <label>API Key</label>
            <input
              type="password"
              placeholder="sk-ant-..."
              value={apiKey}
              onInput={(e) => setApiKey((e.target as HTMLInputElement).value)}
            />
            <label>Model</label>
            <input
              type="text"
              placeholder="claude-3-5-haiku-20241022"
              value={anthropicModel}
              onInput={(e) => setAnthropicModel((e.target as HTMLInputElement).value)}
            />
            <p class="settings-hint">
              Get your API key from <a href="https://console.anthropic.com/" target="_blank" rel="noopener">Anthropic Console</a>.
              Popular models: claude-3-5-sonnet-20241022, claude-3-5-haiku-20241022.
            </p>
          </div>
        )}

        {provider === 'gemini' && (
          <div class="provider-fields">
            <label>API Key</label>
            <input
              type="password"
              placeholder="AI..."
              value={apiKey}
              onInput={(e) => setApiKey((e.target as HTMLInputElement).value)}
            />
            <label>Model</label>
            <input
              type="text"
              placeholder="gemini-1.5-flash"
              value={geminiModel}
              onInput={(e) => setGeminiModel((e.target as HTMLInputElement).value)}
            />
            <p class="settings-hint">
              Get your API key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio</a>.
              Popular models: gemini-1.5-pro, gemini-1.5-flash.
            </p>
          </div>
        )}

        {provider === 'perplexity' && (
          <div class="provider-fields">
            <label>API Key</label>
            <input
              type="password"
              placeholder="pplx-..."
              value={apiKey}
              onInput={(e) => setApiKey((e.target as HTMLInputElement).value)}
            />
            <label>Model</label>
            <input
              type="text"
              placeholder="sonar-pro"
              value={perplexityModel}
              onInput={(e) => setPerplexityModel((e.target as HTMLInputElement).value)}
            />
            <p class="settings-hint">
              Get your API key from <a href="https://www.perplexity.ai/settings/api" target="_blank" rel="noopener">Perplexity Settings</a>.
              Popular models: sonar-pro, sonar-reasoning.
            </p>
          </div>
        )}

        {provider === 'hosted' && (
          <div class="provider-fields">
            {license.isActive ? (
              <p class="settings-hint" style={{ color: 'var(--accent-green)' }}>
                ✓ No API key needed. Extractions and CV generation are handled by JobFlow.
                Your bundle has {license.daysRemaining} days remaining.
              </p>
            ) : (
              <p class="settings-hint" style={{ color: 'var(--accent-orange)' }}>
                Hosted AI requires an active Job Search Bundle.
                {' '}<a href="https://jobflow.lemonsqueezy.com" target="_blank" rel="noopener">Get the bundle &rarr;</a>
              </p>
            )}
          </div>
        )}

        <button onClick={handleSaveProvider}>Save</button>
        <span class="status-text">{providerStatus}</span>
      </div>

      <div class="settings-section">
        <h3>Database</h3>
        <p class="settings-hint">
          Export your database to create a backup, or import a previously exported database.
        </p>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={handleExportDb}>Export Database</button>
          <button onClick={handleImportDb}>Import Database</button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".db,.sqlite,.sqlite3"
          style={{ display: 'none' }}
          onChange={handleFileSelected}
        />
        <span class="status-text">{dbStatus}</span>
      </div>

      <div class="settings-section">
        <h3>Tracking</h3>
        <p class="settings-hint">
          Jobs stuck in <strong>Applied</strong> with no update for this many days are flagged as ghosted in the Rejected tab.
        </p>
        <label>Ghost detection threshold (days)</label>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="number"
            min="1"
            max="90"
            value={ghostedDays}
            onInput={(e) => setGhostedDays(Number((e.target as HTMLInputElement).value))}
            style={{ width: '80px' }}
          />
          <button onClick={async () => {
            const days = Math.max(1, Math.min(90, Math.floor(ghostedDays)));
            setGhostedDays(days);
            await saveSettings({ ghostedDays: days });
            setGhostedStatus('Saved.');
            setTimeout(() => setGhostedStatus(''), 2000);
          }}>Save</button>
          <span class="status-text">{ghostedStatus}</span>
        </div>
      </div>

      <div class="settings-section">
        <h3>Agent Sync</h3>
        <p class="settings-hint">
          Export your jobs so AI agents can read and update them. Connect once so the extension auto-imports agent changes every time it opens.
        </p>

        {agentSync.isConnected ? (
          <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(63, 185, 80, 0.08)', border: '1px solid rgba(63, 185, 80, 0.2)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>Connected</span>
              {agentSync.lastSync && (
                <span class="settings-hint" style={{ margin: 0 }}>
                  Last sync: {new Date(agentSync.lastSync).toLocaleString()}
                </span>
              )}
            </div>
            <p class="settings-hint" style={{ margin: '0 0 8px' }}>
              Agent changes to <code>~/.jobflow/db.json</code> are imported automatically when the extension opens.
            </p>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={async () => {
                  const count = await agentSync.syncNow();
                  if (count > 0) window.location.reload();
                }}
                disabled={agentSync.isLoading}
                style={{ background: 'var(--bg-elevated)' }}
              >
                {agentSync.isLoading ? 'Syncing...' : 'Sync Now'}
              </button>
              <button onClick={handleExportAgent}>Re-export db.json</button>
              <button
                onClick={() => agentSync.disconnect()}
                style={{ background: 'var(--bg-elevated)', color: 'var(--accent-red)', borderColor: 'rgba(248, 81, 73, 0.2)' }}
              >
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: '12px' }}>
            <div style={{ marginBottom: '12px' }}>
              <p class="settings-hint" style={{ margin: '0 0 6px', fontWeight: 600 }}>Setup:</p>
              <ol style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                <li style={{ marginBottom: '4px' }}>Click <strong>Export db.json</strong> — downloads your jobs + an <code>AGENTS.md</code> schema guide</li>
                <li style={{ marginBottom: '4px' }}>Move both files to <code>~/.jobflow/</code></li>
                <li style={{ marginBottom: '4px' }}>Point your agent at <code style={{ userSelect: 'all' }}>~/.jobflow/db.json</code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText('~/.jobflow/db.json').then(() => {
                        setAgentExportStatus('Path copied');
                        setTimeout(() => setAgentExportStatus(''), 2000);
                      });
                    }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--accent-blue)', cursor: 'pointer', padding: '0 4px', fontSize: '12px' }}
                  >copy</button>
                </li>
                <li>Click <strong>Connect</strong> and select your <code>~/.jobflow</code> folder — after that, imports happen automatically on open</li>
              </ol>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={handleExportAgent}>Export db.json</button>
              <button
                onClick={() => agentSync.connect()}
                disabled={agentSync.isLoading}
                style={{ background: 'var(--accent-gradient)', color: '#0d1117', fontWeight: 600 }}
              >
                {agentSync.isLoading ? 'Connecting...' : 'Connect'}
              </button>
            </div>
            {agentSync.error && (
              <p class="settings-hint" style={{ marginTop: '8px', color: 'var(--accent-red)' }}>
                {agentSync.error}
              </p>
            )}
          </div>
        )}

        <input
          ref={agentFileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleAgentFileSelected}
        />
        <span class="status-text">{agentExportStatus}</span>
      </div>
    </div>
  );
}
