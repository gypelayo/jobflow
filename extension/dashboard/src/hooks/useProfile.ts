import { useState, useEffect, useCallback } from 'preact/hooks';
import type { Profile } from '@/types';
import * as api from '@/lib/api';

const EMPTY_PROFILE: Profile = {
  id: 1,
  fullName: '',
  email: '',
  phone: '',
  location: '',
  currentRole: '',
  yearsExperience: 0,
  skills: [],
  links: [],
  storyMarkdown: '',
};

export function useProfile() {
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const p = await api.getProfile();
        setProfile(p);
        setStatus(p.storyMarkdown ? 'Profile loaded.' : 'No profile saved yet.');
      } catch {
        setStatus('Could not load profile (native helper unavailable).');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = useCallback(async (data: Profile) => {
    setSaving(true);
    setStatus('Saving...');
    try {
      const { id: _, ...rest } = data;
      await api.saveProfile(rest);
      setProfile(data);
      setStatus('Profile saved.');
    } catch {
      setStatus('Failed to save profile.');
    } finally {
      setSaving(false);
    }
  }, []);

  return { profile, setProfile, loading, saving, status, save };
}
