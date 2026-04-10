import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/preact';
import { SettingsTab } from '@/components/SettingsTab';

vi.mock('@/lib/storage', () => ({
  loadSettings: vi.fn().mockResolvedValue({
    provider: 'ollama',
    ollamaModel: 'qwen2.5:7b',
    perplexityKey: '',
    perplexityModel: 'sonar-pro',
    perplexityApiKey: '',
    openaiApiKey: '',
    openaiModel: 'gpt-4o-mini',
    anthropicApiKey: '',
    anthropicModel: 'claude-3-5-haiku-20241022',
    geminiApiKey: '',
    geminiModel: 'gemini-1.5-flash',
  }),
  saveSettings: vi.fn().mockResolvedValue(undefined),
  getPerplexityKey: vi.fn().mockReturnValue(''),
}));

vi.mock('@/lib/db', () => ({
  exportDatabase: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
  importDatabase: vi.fn().mockResolvedValue(undefined),
}));

describe('SettingsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the settings heading', () => {
    const { getByText } = render(<SettingsTab />);
    expect(getByText('Settings')).toBeTruthy();
  });

  it('renders LLM provider selector', () => {
    const { getByText } = render(<SettingsTab />);
    expect(getByText('LLM Provider')).toBeTruthy();
    expect(getByText('Ollama (local)')).toBeTruthy();
    expect(getByText('OpenAI (cloud)')).toBeTruthy();
    expect(getByText('Anthropic (cloud)')).toBeTruthy();
    expect(getByText('Google Gemini (cloud)')).toBeTruthy();
    expect(getByText('Perplexity (cloud)')).toBeTruthy();
  });

  it('shows Ollama model field by default', () => {
    const { getByPlaceholderText, getByText } = render(<SettingsTab />);
    expect(getByPlaceholderText('qwen2.5:7b')).toBeTruthy();
    expect(getByText('Model')).toBeTruthy();
  });

  it('shows OpenAI fields when provider is switched', async () => {
    const { getByPlaceholderText, container } = render(<SettingsTab />);
    const select = container.querySelector('select') as HTMLSelectElement;

    // Preact needs the value set + change event
    select.value = 'openai';
    fireEvent.change(select);
    fireEvent.input(select);

    await waitFor(() => {
      expect(getByPlaceholderText('sk-...')).toBeTruthy();
      expect(getByPlaceholderText('gpt-4o-mini')).toBeTruthy();
    });
  });

  it('shows Perplexity fields when provider is switched', async () => {
    const { getByPlaceholderText, container } = render(<SettingsTab />);
    const select = container.querySelector('select') as HTMLSelectElement;

    // Preact needs the value set + change event
    select.value = 'perplexity';
    fireEvent.change(select);
    fireEvent.input(select);

    await waitFor(() => {
      expect(getByPlaceholderText('pplx-...')).toBeTruthy();
      expect(getByPlaceholderText('sonar-pro')).toBeTruthy();
    });
  });

  it('saves Ollama settings', async () => {
    const { saveSettings } = await import('@/lib/storage');
    const { getByPlaceholderText, getByText, getAllByText } = render(<SettingsTab />);

    const modelInput = getByPlaceholderText('qwen2.5:7b');
    fireEvent.input(modelInput, { target: { value: 'llama3:8b' } });
    fireEvent.click(getAllByText('Save')[0]);

    await waitFor(() => {
      expect(saveSettings).toHaveBeenCalledWith({
        provider: 'ollama',
        ollamaModel: 'llama3:8b',
      });
      expect(getByText('Saved.')).toBeTruthy();
    });
  });

  it('saves OpenAI settings with API key', async () => {
    const { saveSettings } = await import('@/lib/storage');
    const { container, getByPlaceholderText, getByText, getAllByText } = render(<SettingsTab />);

    // Wait for initial settings to load (useEffect resolves loadSettings)
    await waitFor(() => {
      expect(getByPlaceholderText('qwen2.5:7b')).toBeTruthy();
    });

    // Switch to openai
    const select = container.querySelector('select') as HTMLSelectElement;
    select.value = 'openai';
    fireEvent.change(select);
    fireEvent.input(select);

    await waitFor(() => {
      expect(getByPlaceholderText('sk-...')).toBeTruthy();
    });

    fireEvent.input(getByPlaceholderText('sk-...'), {
      target: { value: 'sk-test-key-123' },
    });
    fireEvent.click(getAllByText('Save')[0]);

    await waitFor(() => {
      expect(saveSettings).toHaveBeenCalledWith({
        provider: 'openai',
        openaiModel: 'gpt-4o-mini',
        openaiApiKey: 'sk-test-key-123',
      });
      expect(getByText('Saved.')).toBeTruthy();
    });
  });

  it('saves Perplexity settings with API key', async () => {
    const { saveSettings } = await import('@/lib/storage');
    const { container, getByPlaceholderText, getByText, getAllByText } = render(<SettingsTab />);

    // Wait for initial settings to load (useEffect resolves loadSettings)
    await waitFor(() => {
      expect(getByPlaceholderText('qwen2.5:7b')).toBeTruthy();
    });

    // Switch to perplexity
    const select = container.querySelector('select') as HTMLSelectElement;
    select.value = 'perplexity';
    fireEvent.change(select);
    fireEvent.input(select);

    await waitFor(() => {
      expect(getByPlaceholderText('pplx-...')).toBeTruthy();
    });

    fireEvent.input(getByPlaceholderText('pplx-...'), {
      target: { value: 'pplx-test-key-123' },
    });
    fireEvent.click(getAllByText('Save')[0]);

    await waitFor(() => {
      expect(saveSettings).toHaveBeenCalledWith({
        provider: 'perplexity',
        perplexityModel: 'sonar-pro',
        perplexityApiKey: 'pplx-test-key-123',
        perplexityKey: 'pplx-test-key-123',
      });
      expect(getByText('Saved.')).toBeTruthy();
    });
  });

  it('rejects saving OpenAI without API key', async () => {
    const { saveSettings } = await import('@/lib/storage');
    const { container, getByText, getByPlaceholderText, getAllByText } = render(<SettingsTab />);

    // Wait for initial settings to load
    await waitFor(() => {
      expect(getByPlaceholderText('qwen2.5:7b')).toBeTruthy();
    });

    // Switch to openai
    const select = container.querySelector('select') as HTMLSelectElement;
    select.value = 'openai';
    fireEvent.change(select);
    fireEvent.input(select);

    await waitFor(() => {
      expect(getByPlaceholderText('sk-...')).toBeTruthy();
    });

    // Don't enter an API key — just click Save
    fireEvent.click(getAllByText('Save')[0]);

    await waitFor(() => {
      expect(getByText('Openai requires an API key.')).toBeTruthy();
    });
    expect(saveSettings).not.toHaveBeenCalled();
  });

  it('renders database section', () => {
    const { getByText } = render(<SettingsTab />);
    expect(getByText('Database')).toBeTruthy();
    expect(getByText('Export Database')).toBeTruthy();
    expect(getByText('Import Database')).toBeTruthy();
  });

  it('renders version info', () => {
    const { getByText } = render(<SettingsTab />);
    expect(getByText('0.1.3')).toBeTruthy();
  });

  it('exports database on button click', async () => {
    const { exportDatabase } = await import('@/lib/db');

    const mockUrl = 'blob:test-url';
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn().mockReturnValue(mockUrl);
    URL.revokeObjectURL = vi.fn();

    const { getByText } = render(<SettingsTab />);
    fireEvent.click(getByText('Export Database'));

    await waitFor(() => {
      expect(exportDatabase).toHaveBeenCalled();
      expect(getByText('Database exported.')).toBeTruthy();
    });

    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('shows export error on failure', async () => {
    const { exportDatabase } = await import('@/lib/db');
    (exportDatabase as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('DB not initialized')
    );

    const { getByText } = render(<SettingsTab />);
    fireEvent.click(getByText('Export Database'));

    await waitFor(() => {
      expect(getByText('Export failed: DB not initialized')).toBeTruthy();
    });
  });
});
