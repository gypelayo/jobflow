/**
 * background.js — extraction coordinator.
 *
 * Handles tab scraping, LLM extraction via fetch(), and stores results in
 * chrome.storage.local for the dashboard to persist into SQLite.
 *
 * No native messaging — everything runs in-browser.
 */

const HOSTED_API_URL = 'https://api.jobflow.app';

let frameData = [];
let extractionTimer = null;

// ---- Unified API detection ----
// Prefer browser.* (Firefox native Promises) over chrome.* (callback-based).
// Firefox exposes both, but chrome.runtime.sendMessage returns undefined
// instead of a Promise in Firefox, which breaks .catch() chains.
let api = null;

if (typeof browser !== "undefined" && browser && browser.runtime) {
  api = browser;
} else if (typeof chrome !== "undefined" && chrome && chrome.runtime) {
  api = chrome;
} else {
  console.error("No chrome or browser API found");
}

/**
 * Safe fire-and-forget sendMessage. Handles both Promise-returning (browser.*)
 * and callback-based (chrome.*) APIs without throwing.
 */
function safeSendMessage(msg) {
  try {
    const result = api.runtime.sendMessage(msg);
    if (result && typeof result.catch === "function") {
      result.catch(() => {});
    }
  } catch (e) {
    // No listeners — that's fine
  }
}

let actionApi = null;

if (api) {
  if (api.action && api.action.onClicked) {
    actionApi = api.action; // MV3 (Chrome) or Firefox with action
  } else if (api.browserAction && api.browserAction.onClicked) {
    actionApi = api.browserAction; // MV2 (Firefox, Chrome)
  } else {
    console.error("No action or browserAction API on", api);
  }
}

// ---- Core extraction logic (called from onClicked or popup message) ----
async function extractFromTab(tab) {
  if (!tab || !tab.url) {
    console.warn("No active tab URL");
    return;
  }

  // Notify any open dashboard tabs immediately so the spinner appears
  safeSendMessage({ action: "extractionStarted" });

  const jobInfo = extractGreenhouseInfo(tab.url);

  try {
    if (jobInfo) {
      await handleGreenhouseJob(tab, jobInfo);
    } else if (isWellfound(tab.url)) {
      await handleWellfoundJob(tab);
    } else if (isRemoteRocketship(tab.url)) {
      await handleRemoteRocketshipJob(tab);
    } else if (isLinkedIn(tab.url)) {
      await handleLinkedInJob(tab);
    } else {
      await handleGenericScraping(tab);
    }
  } catch (err) {
    console.error("Extraction failed:", err);
    const errorMsg = err instanceof Error ? err.message : String(err);
    safeSendMessage({ action: "extractionFailed", error: errorMsg });
    setBadge("ERR", "#F44336");
    setTimeout(() => setBadge("", ""), 5000);
  }
}

if (!actionApi) {
  console.error("No action or browserAction API available");
} else {
  actionApi.onClicked.addListener((tab) => extractFromTab(tab));
}

// ---- helper: execute a content script (MV3 + MV2) ----
function runContentScript(tabId, file, callback) {
  if (api.scripting && api.scripting.executeScript) {
    // MV3 path (Chrome)
    api.scripting
      .executeScript({
        target: { tabId },
        files: [file],
      })
      .then(() => callback && callback())
      .catch((err) => {
        console.error("Injection failed (scripting):", err);
      });
  } else if (api.tabs && api.tabs.executeScript) {
    // MV2 path (Firefox / old Chrome)
    try {
      api.tabs.executeScript(tabId, { file }, () => {
        if (api.runtime.lastError) {
          console.error("Injection failed (tabs):", api.runtime.lastError.message);
          return;
        }
        callback && callback();
      });
    } catch (err) {
      console.error("Injection failed (tabs):", err);
    }
  } else {
    console.error("No scripting or tabs.executeScript API available");
  }
}

// ========== GREENHOUSE API HANDLING ==========

async function handleGreenhouseJob(tab, jobInfo) {
  if (jobInfo.boardToken && jobInfo.jobId) {
    const jobData = await fetchGreenhouseJob(jobInfo.boardToken, jobInfo.jobId);
    if (jobData) {
      processExtractedText(jobData, tab.url);
    } else {
      console.error("API failed");
    }
  } else if (jobInfo.jobId) {
    api.webNavigation.getAllFrames({ tabId: tab.id }, async (frames) => {
      let boardToken = null;

      for (const frame of frames) {
        const match = frame.url.match(/greenhouse\.io.*[?&]for=([^&]+)/);
        if (match) {
          boardToken = match[1];
          break;
        }
      }

      if (boardToken) {
        const jobData = await fetchGreenhouseJob(boardToken, jobInfo.jobId);
        if (jobData) {
          processExtractedText(jobData, tab.url);
        }
      } else {
        console.error("No board token found");
      }
    });
  }
}

function extractGreenhouseInfo(url) {
  try {
    const urlObj = new URL(url);

    const directMatch = url.match(/greenhouse\.io\/([^/]+)\/jobs\/(\d+)/);
    if (directMatch) {
      return {
        boardToken: directMatch[1],
        jobId: directMatch[2],
        type: "direct",
      };
    }

    const jobId = urlObj.searchParams.get("gh_jid");
    if (jobId) {
      return {
        boardToken: null,
        jobId: jobId,
        type: "embedded",
      };
    }

    return null;
  } catch (e) {
    return null;
  }
}

async function fetchGreenhouseJob(boardToken, jobId) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs/${jobId}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const job = await response.json();

    // Strip HTML tags — DOMParser is not available in MV3 service workers,
    // so we use a simple regex approach instead.
    const textContent = stripHTMLTags(job.content);

    const formatted = `
JOB TITLE: ${job.title}

LOCATION: ${job.location?.name || "Not specified"}

DEPARTMENT: ${
      job.departments?.map((d) => d.name).join(", ") || "Not specified"
    }

DESCRIPTION:
${textContent}

URL: ${job.absolute_url}
UPDATED: ${job.updated_at}
SOURCE: Greenhouse API
`;

    return formatted;
  } catch (error) {
    console.error("API error:", error);
    return null;
  }
}

// ========== WELLFOUND HANDLING ==========

function isWellfound(url) {
  return url.includes("wellfound.com/jobs/") || url.includes("angel.co/jobs/");
}

async function handleWellfoundJob(tab) {
  await scrapeWithContentScript(tab, "extractWellfound", 8000);
}

// ========== REMOTE ROCKETSHIP HANDLING ==========

function isRemoteRocketship(url) {
  return url.includes("remoterocketship.com/company/");
}

async function handleRemoteRocketshipJob(tab) {
  await scrapeWithContentScript(tab, "extractRemoteRocketship", 8000);
}

// ========== LINKEDIN HANDLING ==========

function isLinkedIn(url) {
  return url.includes("linkedin.com/jobs/view/");
}

async function handleLinkedInJob(tab) {
  await scrapeWithContentScript(tab, "extractLinkedIn", 10000);
}

// ========== GENERIC SCRAPING ==========

async function handleGenericScraping(tab) {
  await scrapeWithContentScript(tab, "extract", 10000);
}

/**
 * Unified content-script scraping helper.
 * Injects content.js, sends the extract action, waits for data or timeout.
 *
 * The content script sends data back via chrome.runtime.sendMessage with
 * action "extractText". We resolve the promise either when data arrives
 * (handled by the onMessage listener) or when the fallback timeout fires.
 */
let scrapeResolve = null;

function scrapeWithContentScript(tab, action, timeoutMs) {
  return new Promise((resolve, reject) => {
    frameData = [];
    clearTimeout(extractionTimer);
    scrapeResolve = resolve;

    runContentScript(tab.id, "content.js", () => {
      // Send the extract message immediately (no artificial delay)
      try {
        api.tabs.sendMessage(tab.id, { action });
      } catch (err) {
        console.error("Message to content script failed:", err);
        scrapeResolve = null;
        reject(err);
        return;
      }

      // Fallback timeout — if content script never responds
      extractionTimer = setTimeout(() => {
        if (frameData.length > 0) {
          combineAndSend();
        } else {
          const err = new Error("Scraping timed out — no data received from page");
          safeSendMessage({ action: "extractionFailed", error: err.message });
          setBadge("ERR", "#F44336");
          setTimeout(() => setBadge("", ""), 5000);
        }
        scrapeResolve = null;
        resolve();
      }, timeoutMs);
    });
  });
}

// ========== MESSAGE HANDLING FROM CONTENT SCRIPT ==========

api.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractText") {
    const data = request.data;

    frameData.push(data);

    // We got data — cancel the fallback timeout and process immediately
    clearTimeout(extractionTimer);
    combineAndSend();

    // Resolve the scrapeWithContentScript promise so extractFromTab can continue
    if (scrapeResolve) {
      scrapeResolve();
      scrapeResolve = null;
    }

    sendResponse({ received: true });
  }

  if (request.action === "triggerExtraction") {
    const tabId = request.tabId;
    api.tabs.get(tabId, (tab) => {
      if (api.runtime.lastError) {
        sendResponse({ ok: false, error: api.runtime.lastError.message });
        return;
      }
      extractFromTab(tab);
      sendResponse({ ok: true });
    });
    return true; // keep the message channel open for async sendResponse
  }
});

function combineAndSend() {
  if (frameData.length === 0) {
    console.error("No data collected from content script");
    safeSendMessage({ action: "extractionFailed", error: "No text extracted from page" });
    setBadge("ERR", "#F44336");
    setTimeout(() => setBadge("", ""), 5000);
    return;
  }

  const data = frameData[0];
  processExtractedText(data.text, data.url);

  frameData = [];
}

// ========== LLM EXTRACTION (replaces native host) ==========

/**
 * Takes raw scraped text, sends it to Ollama or Perplexity for structured
 * extraction, then queues the result for the dashboard to persist.
 */
async function processExtractedText(text, tabUrl) {
  const settings = await getSettings();

  // Update badge to show extraction in progress
  setBadge("...", "#FF9800");

  // Notify popup/dashboard that we're now calling the LLM
  let providerName = "Ollama";
  if (settings.provider === "hosted" && settings.licenseKey) {
    providerName = "JobFlow";
  } else if (settings.provider === "openai" && settings.openaiApiKey) {
    providerName = "OpenAI";
  } else if (settings.provider === "anthropic" && settings.anthropicApiKey) {
    providerName = "Anthropic";
  } else if (settings.provider === "gemini" && settings.geminiApiKey) {
    providerName = "Gemini";
  } else if (settings.provider === "perplexity" && (settings.perplexityKey || settings.perplexityApiKey)) {
    providerName = "Perplexity";
  }
  safeSendMessage({ action: "extractionProcessing", provider: providerName });

  try {
    const prompt = buildExtractionPrompt(text);
    let rawResponse;

    if (settings.provider === "hosted" && settings.licenseKey) {
      rawResponse = await callHosted(text, settings.licenseKey);
    } else if (settings.provider === "openai" && settings.openaiApiKey) {
      const model = settings.openaiModel || "gpt-4o-mini";
      rawResponse = await callOpenAI(prompt, settings.openaiApiKey, model);
    } else if (settings.provider === "anthropic" && settings.anthropicApiKey) {
      const model = settings.anthropicModel || "claude-3-5-haiku-20241022";
      rawResponse = await callAnthropic(prompt, settings.anthropicApiKey, model);
    } else if (settings.provider === "gemini" && settings.geminiApiKey) {
      const model = settings.geminiModel || "gemini-1.5-flash";
      rawResponse = await callGemini(prompt, settings.geminiApiKey, model);
    } else if (settings.provider === "perplexity" && (settings.perplexityKey || settings.perplexityApiKey)) {
      const perplexityKey = settings.perplexityKey || settings.perplexityApiKey;
      const model = settings.perplexityModel || "sonar-pro";
      rawResponse = await callPerplexity(prompt, perplexityKey, model);
    } else {
      const model = settings.ollamaModel || "qwen2.5:7b";
      rawResponse = await callOllama(prompt, model);
    }

    const jsonStr = cleanJSONResponse(rawResponse);
    const job = JSON.parse(jsonStr);

    // Ensure source_url is always set (NOT NULL in schema)
    if (!job.source_url) {
      const sourceURL = extractURL(text);
      job.source_url = sourceURL || tabUrl || "unknown";
    }

    // Notify popup/dashboard that we're saving
    safeSendMessage({ action: "extractionSaving" });

    // Queue the extracted job for the dashboard to persist into SQLite
    await queueExtractedJob(job);

    // Notify any open dashboard tabs
    safeSendMessage({ action: "jobExtracted", job: job });

    setBadge("OK", "#4CAF50");
    setTimeout(() => setBadge("", ""), 3000);
  } catch (err) {
    console.error("LLM extraction failed:", err);
    setBadge("ERR", "#F44336");
    setTimeout(() => setBadge("", ""), 5000);

    // Notify any open dashboard tabs that extraction failed
    const errorMsg = err instanceof Error ? err.message : String(err);
    safeSendMessage({ action: "extractionFailed", error: errorMsg });
  }
}

// ========== LLM CLIENTS ==========

async function callHosted(jobText, licenseKey) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);

  try {
    const resp = await fetch(`${HOSTED_API_URL}/v1/extract`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${licenseKey}`,
      },
      body: JSON.stringify({ text: jobText }),
      signal: controller.signal,
    });

    if (resp.status === 401) throw new Error("Invalid or expired license key");
    if (resp.status === 429) throw new Error("Usage limit reached — please try again later");
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Hosted API returned ${resp.status}: ${body}`);
    }

    const data = await resp.json();
    // Backend returns the extracted JSON directly as a string
    return typeof data.result === "string" ? data.result : JSON.stringify(data.result);
  } finally {
    clearTimeout(timer);
  }
}

async function callOllama(prompt, model) {
  const body = { model, prompt, stream: false, format: "json" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180000);

  try {
    const resp = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Ollama returned status ${resp.status}: ${text}`);
    }

    const data = await resp.json();
    return data.response;
  } finally {
    clearTimeout(timer);
  }
}

async function callOpenAI(prompt, apiKey, model) {
  const body = {
    model,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 4000,
    temperature: 0.1,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`OpenAI returned status ${resp.status}: ${text}`);
    }

    const data = await resp.json();
    if (!data.choices?.length) throw new Error("No response from OpenAI");
    return data.choices[0].message.content;
  } finally {
    clearTimeout(timer);
  }
}

async function callAnthropic(prompt, apiKey, model) {
  const body = {
    model,
    max_tokens: 4000,
    temperature: 0.1,
    messages: [{ role: "user", content: prompt }],
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Anthropic returned status ${resp.status}: ${text}`);
    }

    const data = await resp.json();
    if (!data.content?.length) throw new Error("No response from Anthropic");
    return data.content[0].text;
  } finally {
    clearTimeout(timer);
  }
}

async function callGemini(prompt, apiKey, model) {
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: 4000,
      temperature: 0.1,
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);

  try {
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Gemini returned status ${resp.status}: ${text}`);
    }

    const data = await resp.json();
    if (!data.candidates?.length || !data.candidates[0].content?.parts?.length) {
      throw new Error("No response from Gemini");
    }
    return data.candidates[0].content.parts[0].text;
  } finally {
    clearTimeout(timer);
  }
}

async function callPerplexity(prompt, apiKey, model) {
  const body = {
    model,
    messages: [{ role: "user", content: prompt }],
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);

  try {
    const resp = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Perplexity returned status ${resp.status}: ${text}`);
    }

    const data = await resp.json();
    if (!data.choices?.length) throw new Error("No response from Perplexity");
    return data.choices[0].message.content;
  } finally {
    clearTimeout(timer);
  }
}

// ========== PROMPT / TEXT UTILS (minimal port for background context) ==========

function buildExtractionPrompt(jobText) {
  const now = new Date().toISOString();
  const sourceURL = extractURL(jobText);

  return `Extract job posting information into structured JSON for analytics. Extract ONLY what is explicitly stated.

Job Posting:
${jobText}

Return this JSON structure:
{
  "metadata": {
    "job_title": "exact title from posting",
    "department": "Engineering, Product, Sales, etc.",
    "seniority_level": "Junior|Mid|Senior|Staff|Principal|Lead",
    "job_function": "Backend|Frontend|FullStack|DevOps|Data|Mobile|Security|Embedded"
  },
  "company_info": {
    "company_name": "exact company name",
    "industry": "single primary industry: SaaS, E-commerce, Finance, Healthcare, etc.",
    "company_size": "10-50, 50-200, 200-1000, 1000+, or empty",
    "location_full": "full location as stated",
    "location_city": "extract city name",
    "location_country": "extract country name or region (e.g., USA, UK, EMEA, Remote)"
  },
  "role_details": {
    "summary": "1-2 sentence role summary",
    "key_responsibilities": ["extract exact bullet points"],
    "team_structure": "team info if mentioned"
  },
  "requirements": {
    "years_experience_min": 0,
    "years_experience_max": 0,
    "education_level": "None|Bachelor's|Master's|PhD",
    "requires_specific_degree": false,
    "technical_skills": {
      "programming_languages": ["Go", "Python"],
      "frameworks": ["React", "Django"],
      "databases": ["PostgreSQL", "Redis"],
      "cloud_platforms": ["AWS", "GCP", "Azure"],
      "devops_tools": ["Docker", "Kubernetes", "Terraform"],
      "other": ["Git", "Linux"]
    },
    "soft_skills": ["Communication", "Problem-solving"],
    "nice_to_have": ["skill or experience that's nice to have"]
  },
  "compensation": {
    "salary_min": 0,
    "salary_max": 0,
    "salary_currency": "USD|EUR|GBP|empty",
    "has_equity": false,
    "has_remote_stipend": false,
    "benefits": ["401k", "health insurance"],
    "offers_visa_sponsorship": false,
    "offers_health_insurance": false,
    "offers_pto": false,
    "offers_professional_development": false,
    "offers_401k": false
  },
  "work_arrangement": {
    "workplace_type": "Remote|Hybrid|On-site",
    "job_type": "Full-time|Part-time|Contract|Internship",
    "is_remote_friendly": true,
    "timezone_requirements": "EMEA|US|APAC|Flexible|empty"
  },
  "market_signals": {
    "urgency_level": "Standard|Urgent|Immediate",
    "interview_rounds": 0,
    "has_take_home": false,
    "has_pair_programming": false
  },
  "extracted_at": "${now}",
  "source_url": "${sourceURL}"
}

CRITICAL EXTRACTION RULES:
1. years_experience_min/max: Extract numbers from "3-5 years" → min:3, max:5. If "5+ years" → min:5, max:0
2. seniority_level: Infer from title (Junior/Mid/Senior/Staff/Principal/Lead)
3. job_function: Categorize the role type (Backend/Frontend/etc)
4. salary_min/max: Extract numbers only. "€80k-100k" → min:80000, max:100000
5. technical_skills: Use simple names only ["Go", "Python"], not full sentences
6. Boolean fields: Set to true ONLY if explicitly mentioned
7. urgency_level: "Urgent" if mentions "immediate", "ASAP", "urgent". Otherwise "Standard"

Return ONLY valid JSON.`;
}

/**
 * Strip HTML tags from a string. Works in service worker contexts where
 * DOMParser is not available.
 */
function stripHTMLTags(html) {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanJSONResponse(response) {
  let s = response.trim();
  if (s.startsWith("```json")) s = s.slice(7);
  else if (s.startsWith("```")) s = s.slice(3);
  if (s.endsWith("```")) s = s.slice(0, -3);
  return s.trim();
}

function extractURL(text) {
  const idx = text.indexOf("URL:");
  if (idx === -1) return "";
  let urlLine = text.slice(idx);
  const endIdx = urlLine.indexOf("\n");
  if (endIdx !== -1) urlLine = urlLine.slice(0, endIdx);
  return urlLine.replace("URL:", "").trim();
}

// ========== STORAGE HELPERS ==========

function getSettings() {
  return new Promise((resolve) => {
    const defaults = {
      provider: "ollama",
      ollamaModel: "qwen2.5:7b",
      perplexityKey: "",
      perplexityModel: "sonar-pro",
      perplexityApiKey: "",
      openaiApiKey: "",
      openaiModel: "gpt-4o-mini",
      anthropicApiKey: "",
      anthropicModel: "claude-3-5-haiku-20241022",
      geminiApiKey: "",
      geminiModel: "gemini-1.5-flash",
      licenseKey: "",
    };
    api.storage.sync.get(defaults, (result) => resolve(result));
  });
}

/**
 * Queue an extracted job into chrome.storage.local for the dashboard to drain.
 * Uses an array so multiple extractions can queue up before the dashboard opens.
 */
async function queueExtractedJob(job) {
  return new Promise((resolve) => {
    api.storage.local.get({ pendingJobs: [] }, (result) => {
      const pending = result.pendingJobs || [];
      pending.push(job);
      api.storage.local.set({ pendingJobs: pending }, () => resolve());
    });
  });
}

// ========== BADGE HELPERS ==========

function setBadge(text, color) {
  try {
    if (actionApi && actionApi.setBadgeText) {
      actionApi.setBadgeText({ text });
    }
    if (color && actionApi && actionApi.setBadgeBackgroundColor) {
      actionApi.setBadgeBackgroundColor({ color });
    }
  } catch (e) {
    // Badge API may not be available in all contexts
  }
}
