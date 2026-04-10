import type { TabId } from '@/types';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'jobs', label: 'Jobs', icon: 'jobs' },
  { id: 'pipeline', label: 'Pipeline', icon: 'pipeline' },
  { id: 'rejected', label: 'Rejected', icon: 'rejected' },
  { id: 'analytics', label: 'Analytics', icon: 'analytics' },
  { id: 'profile', label: 'Profile', icon: 'profile' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

function NavIcon({ icon, active }: { icon: string; active: boolean }) {
  const color = active ? '#22d3ee' : '#8b949e';
  const icons: Record<string, () => preact.VNode> = {
    jobs: () => (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="3" width="12" height="10" rx="1.5" stroke={color} stroke-width="1.3" />
        <path d="M5 3V2.5A1.5 1.5 0 016.5 1h3A1.5 1.5 0 0111 2.5V3" stroke={color} stroke-width="1.3" />
        <line x1="2" y1="6.5" x2="14" y2="6.5" stroke={color} stroke-width="1.3" />
      </svg>
    ),
    pipeline: () => (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="2" width="4" height="12" rx="1" stroke={color} stroke-width="1.3" />
        <rect x="6" y="4" width="4" height="8" rx="1" stroke={color} stroke-width="1.3" />
        <rect x="11" y="6" width="4" height="4" rx="1" stroke={color} stroke-width="1.3" />
      </svg>
    ),
    rejected: () => (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6.5" stroke={color} stroke-width="1.3" />
        <line x1="5" y1="5" x2="11" y2="11" stroke={color} stroke-width="1.3" stroke-linecap="round" />
        <line x1="11" y1="5" x2="5" y2="11" stroke={color} stroke-width="1.3" stroke-linecap="round" />
      </svg>
    ),
    analytics: () => (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="10" width="3" height="5" rx="0.5" stroke={color} stroke-width="1.3" />
        <rect x="6" y="6" width="3" height="9" rx="0.5" stroke={color} stroke-width="1.3" />
        <rect x="11" y="2" width="3" height="13" rx="0.5" stroke={color} stroke-width="1.3" />
      </svg>
    ),
    profile: () => (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="5" r="3" stroke={color} stroke-width="1.3" />
        <path d="M2.5 14.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke={color} stroke-width="1.3" stroke-linecap="round" />
      </svg>
    ),
    settings: () => (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="2.5" stroke={color} stroke-width="1.3" />
        <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke={color} stroke-width="1.3" stroke-linecap="round" />
      </svg>
    ),
  };

  const IconComponent = icons[icon];
  if (!IconComponent) return null;
  return <span class="nav-btn-icon"><IconComponent /></span>;
}

interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  badges?: Partial<Record<TabId, number>>;
}

export function Sidebar({ activeTab, onTabChange, badges }: SidebarProps) {
  return (
    <nav class="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-logo">JF</div>
        <div class="sidebar-title">JobFlow</div>
      </div>

      <div class="sidebar-divider" />

      <div class="sidebar-section-label">Navigation</div>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          class={`nav-btn ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          <NavIcon icon={tab.icon} active={activeTab === tab.id} />
          {tab.label}
          {badges?.[tab.id] ? (
            <span class="nav-badge">{badges[tab.id]}</span>
          ) : null}
        </button>
      ))}

      <div class="sidebar-footer">
        v{typeof chrome !== 'undefined' && chrome.runtime?.getManifest
          ? chrome.runtime.getManifest().version
          : 'dev'}
      </div>
    </nav>
  );
}
