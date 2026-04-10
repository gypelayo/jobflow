const statusEl = document.getElementById('status')!;
const btn = document.getElementById('extractJob') as HTMLButtonElement;

function openDashboard() {
  chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
  window.close();
}

// ---- Extraction stage UI helpers ----

function setStage(text: string, icon: 'spinner' | 'check' | 'error' | '') {
  const icons: Record<string, string> = {
    spinner: '<span class="popup-spinner"></span>',
    check: '<span class="popup-icon done">&#10003;</span>',
    error: '<span class="popup-icon error">&#10007;</span>',
  };
  statusEl.innerHTML = (icons[icon] ?? '') + ' ' + text;
}

// ---- Listen for extraction lifecycle messages from background.js ----

chrome.runtime.onMessage.addListener((request: Record<string, unknown>) => {
  switch (request.action) {
    case 'extractionStarted':
      setStage('Scraping page...', 'spinner');
      break;
    case 'extractionProcessing':
      setStage(`Analyzing with ${request.provider || 'LLM'}...`, 'spinner');
      break;
    case 'extractionSaving':
      setStage('Saving job...', 'spinner');
      break;
    case 'jobExtracted':
      setStage('Job extracted!', 'check');
      btn.disabled = false;
      break;
    case 'extractionFailed':
      setStage(`Error: ${request.error || 'Extraction failed'}`, 'error');
      btn.disabled = false;
      break;
  }
});

// ---- Extract button handler ----

function extractJob() {
  btn.disabled = true;
  setStage('Starting...', 'spinner');

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs.length) {
      setStage('No active tab.', 'error');
      btn.disabled = false;
      return;
    }

    chrome.runtime.sendMessage(
      { action: 'triggerExtraction', tabId: tabs[0].id },
      (raw) => {
        const response = raw as { ok?: boolean; error?: string } | undefined;
        if (chrome.runtime.lastError) {
          setStage('Error: ' + chrome.runtime.lastError.message, 'error');
          btn.disabled = false;
          return;
        }
        if (response?.ok) {
          // Stage message will arrive from background.js via onMessage
          setStage('Scraping page...', 'spinner');
        } else {
          setStage(response?.error || 'Extraction failed.', 'error');
          btn.disabled = false;
        }
      },
    );
  });
}

document.getElementById('extractJob')?.addEventListener('click', extractJob);
document.getElementById('openDashboard')?.addEventListener('click', openDashboard);
