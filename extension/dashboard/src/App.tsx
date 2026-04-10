import { useState, useRef, useEffect } from 'preact/hooks';
import { lazy, Suspense } from 'preact/compat';
import type { TabId } from '@/types';
import { useJobs } from '@/hooks/useJobs';
import { JobOpenContext } from '@/contexts/JobOpenContext';
import { Sidebar } from '@/components/Sidebar';
import { JobsTab } from '@/components/JobsTab';
import { PipelineTab } from '@/components/PipelineTab';
import { RejectedTab } from '@/components/RejectedTab';
import { ProfileTab } from '@/components/ProfileTab';
import { SettingsTab } from '@/components/SettingsTab';
import { Onboarding } from '@/components/Onboarding';
import { seedDemoData } from '@/lib/seed';
import { useAgentSync } from '@/hooks/useAgentSync';
import { loadSettings } from '@/lib/storage';
import * as api from '@/lib/api';

const AnalyticsTab = lazy(() =>
  import('@/components/AnalyticsTab').then((m) => ({ default: m.AnalyticsTab }))
);

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>('jobs');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingLoaded, setOnboardingLoaded] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [ghostedDays, setGhostedDays] = useState(14);
  const [ghostedCount, setGhostedCount] = useState(0);
  const jobsState = useJobs();
  const agentSync = useAgentSync();

  // Open settings tab when paywall link is clicked
  useEffect(() => {
    const handler = () => setActiveTab('settings');
    window.addEventListener('jobflow:open-settings', handler);
    return () => window.removeEventListener('jobflow:open-settings', handler);
  }, []);

  // Load ghosted settings and count on mount
  useEffect(() => {
    loadSettings().then((s) => {
      const days = typeof s.ghostedDays === 'number' ? s.ghostedDays : 14;
      setGhostedDays(days);
      api.listGhostedJobs(days).then((jobs) => setGhostedCount(jobs.length));
    });
  }, []);

  // Reload onboarding completion flag from storage on mount
  useEffect(() => {
    const storage = typeof chrome !== 'undefined' && chrome.storage ? chrome.storage.local : null;
    if (storage) {
      storage.get('onboardingComplete', (result) => {
        if (!result.onboardingComplete) {
          setShowOnboarding(true);
        }
        setOnboardingLoaded(true);
      });
    } else {
      // Fallback for non-extension context (dev/test)
      setShowOnboarding(true);
      setOnboardingLoaded(true);
    }
  }, []);

  // Auto-import agent changes on open (only if db.json is newer than last import)
  useEffect(() => {
    if (agentSync.isConnected && !agentSync.isLoading) {
      agentSync.checkAndSync();
    }
  }, [agentSync.isConnected]);

  // Reload jobs list when an auto-import brings in changes
  useEffect(() => {
    if (agentSync.syncCount > 0) {
      jobsState.reload();
    }
  }, [agentSync.syncCount]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === 'true' && !seeding) {
      setSeeding(true);
      seedDemoData().then(() => {
        jobsState.reload();
      });
    }
  }, []);

  const handleOnboardingComplete = () => {
    const storage = typeof chrome !== 'undefined' && chrome.storage ? chrome.storage.local : null;
    if (storage) {
      storage.set({ onboardingComplete: true });
    }
    setShowOnboarding(false);
    setActiveTab('settings');
  };

  // Context-based approach: allow components to register a handler
  const handlerRef = useRef<(id: number) => void>(() => {});
  const pendingRef = useRef<number | null>(null);
  const register = (fn: (id: number) => void) => {
    handlerRef.current = fn;
    // Flush any pending open request that arrived before registration
    if (pendingRef.current !== null) {
      const id = pendingRef.current;
      pendingRef.current = null;
      fn(id);
    }
    return () => {
      handlerRef.current = () => {};
    };
  };
  const open = (id: number) => {
    pendingRef.current = id;
    setActiveTab('jobs');
  };

  return (
    <>
      {!onboardingLoaded ? null : showOnboarding ? (
        <Onboarding onComplete={handleOnboardingComplete} />
      ) : (
        <>
          <div class="app-layout">
            <Sidebar activeTab={activeTab} onTabChange={setActiveTab} badges={{ rejected: ghostedCount || undefined }} />
            <main class="main-content">
              <JobOpenContext.Provider value={{ register, open }}>
                {activeTab === 'jobs' && <JobsTab {...jobsState} />}
                {activeTab === 'pipeline' && (
                  <PipelineTab {...jobsState} onOpenJob={open} />
                )}
                {activeTab === 'rejected' && (
                  <RejectedTab updateStatus={jobsState.updateStatus} remove={jobsState.remove} ghostedDays={ghostedDays} />
                )}
              </JobOpenContext.Provider>
              {activeTab === 'analytics' && (
                <Suspense fallback={<div class="tab-message">Loading analytics...</div>}>
                  <AnalyticsTab />
                </Suspense>
              )}
              {activeTab === 'profile' && <ProfileTab />}
              {activeTab === 'settings' && <SettingsTab agentSync={agentSync} />}
            </main>
          </div>
        </>
      )}
    </>
  );
}
