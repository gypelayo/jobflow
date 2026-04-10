import type { ComponentChildren } from 'preact';
import { useLicense } from '@/hooks/useLicense';

const PURCHASE_URL = 'https://jobflow.lemonsqueezy.com';

const FEATURE_COPY: Record<string, { title: string; description: string }> = {
  'cv-generation': {
    title: 'Generate a tailored CV for this role',
    description: 'AI builds a customised resume from your profile and the job requirements.',
  },
  'insights': {
    title: 'Unlock insights from your job search',
    description: 'See response rate by company size, skill correlations, seniority mismatch warnings, and what to change to get more callbacks.',
  },
  default: {
    title: 'Bundle feature',
    description: 'Included in the Job Search Bundle.',
  },
};

interface BundleGateProps {
  feature: string;
  children: ComponentChildren;
}

/**
 * Renders children if the user has an active bundle license.
 * Otherwise renders a PaywallCard inline.
 */
export function BundleGate({ feature, children }: BundleGateProps) {
  const { isActive } = useLicense();
  if (isActive) return <>{children}</>;
  return <PaywallCard feature={feature} />;
}

interface PaywallCardProps {
  feature: string;
}

export function PaywallCard({ feature }: PaywallCardProps) {
  const copy = FEATURE_COPY[feature] ?? FEATURE_COPY.default;

  return (
    <div class="paywall-card">
      <div class="paywall-lock">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <h3 class="paywall-title">{copy.title}</h3>
      <p class="paywall-description">{copy.description}</p>
      <a
        href={PURCHASE_URL}
        target="_blank"
        rel="noopener"
        class="paywall-cta"
      >
        Unlock — €29 for 90 days
      </a>
      <p class="paywall-hint">
        Already purchased?{' '}
        <span
          class="paywall-settings-link"
          onClick={() => {
            // Dispatch a custom event the App can listen to for tab switching
            window.dispatchEvent(new CustomEvent('jobflow:open-settings'));
          }}
        >
          Enter your key in Settings
        </span>
      </p>
    </div>
  );
}
