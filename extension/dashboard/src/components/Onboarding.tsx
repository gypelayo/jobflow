import { useState, useEffect } from 'preact/hooks';
import { loadSettings } from '@/lib/storage';

interface OnboardingProps {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [isFirstRun, setIsFirstRun] = useState<boolean | null>(null);

  useEffect(() => {
    checkFirstRun();
  }, []);

  const checkFirstRun = async () => {
    const settings = await loadSettings();
    const hasCompletedOnboarding = settings.onboardingCompleted === true;
    setIsFirstRun(!hasCompletedOnboarding);
  };

  const completeOnboarding = async () => {
    const storage =
      typeof browser !== 'undefined' && browser
        ? browser.storage
        : chrome.storage;
    await new Promise<void>((resolve) => {
      storage.sync.set({ onboardingCompleted: true } as Record<string, unknown>, () => {
        resolve();
      });
    });
    onComplete();
  };

  const steps = [
    {
      title: 'Welcome to JobFlow',
      description: 'Your AI-powered job application tracker. Extract job postings automatically and manage your entire pipeline in one place.',
      icon: '🎯',
    },
    {
      title: 'Configure Your AI Provider',
      description: 'Choose how you want to extract job data. Use a local model (Ollama) for privacy, or connect to OpenAI, Anthropic, Google, or Perplexity.',
      icon: '🤖',
    },
    {
      title: 'Extract Job Postings',
      description: 'Navigate to any job posting online and click the JobFlow extension. The AI will extract title, company, requirements, and salary information.',
      icon: '📋',
    },
    {
      title: "You're All Set!",
      description: 'Start tracking your applications and watch your pipeline grow. Good luck with your job search!',
      icon: '🚀',
    },
  ];

  if (isFirstRun === null) {
    return null;
  }

  if (!isFirstRun) {
    return null;
  }

  return (
    <div class="onboarding-overlay">
      <div class="onboarding-modal">
        <div class="onboarding-header">
          <span class="onboarding-icon">{steps[step].icon}</span>
          <span class="onboarding-step">Step {step + 1} of {steps.length}</span>
        </div>
        
        <div class="onboarding-progress">
          {steps.map((_, i) => (
            <div
              key={i}
              class={`onboarding-progress-dot ${i <= step ? 'active' : ''}`}
            />
          ))}
        </div>

        <h2 class="onboarding-title">{steps[step].title}</h2>
        <p class="onboarding-description">{steps[step].description}</p>

        {step === 1 && (
          <div class="onboarding-providers">
            <div class="provider-badge">
              <span class="provider-icon">🖥️</span>
              <span>Ollama (Local)</span>
              <span class="provider-note">Most private</span>
            </div>
            <div class="provider-badge">
              <span class="provider-icon">🔑</span>
              <span>OpenAI / Anthropic</span>
              <span class="provider-note">Most powerful</span>
            </div>
            <div class="provider-badge">
              <span class="provider-icon">⚡</span>
              <span>Google / Perplexity</span>
              <span class="provider-note">Fast & capable</span>
            </div>
          </div>
        )}

        <div class="onboarding-actions">
          {step > 0 && (
            <button
              class="onboarding-btn onboarding-btn-secondary"
              onClick={() => setStep(step - 1)}
            >
              Back
            </button>
          )}
          
          {step < steps.length - 1 ? (
            <button
              class="onboarding-btn onboarding-btn-primary"
              onClick={() => setStep(step + 1)}
            >
              Next
            </button>
          ) : (
            <button
              class="onboarding-btn onboarding-btn-primary"
              onClick={completeOnboarding}
            >
              Get Started
            </button>
          )}
        </div>

        {step === steps.length - 1 && (
          <button
            class="onboarding-skip"
            onClick={completeOnboarding}
          >
            Go to Settings to configure AI provider →
          </button>
        )}
      </div>
    </div>
  );
}
