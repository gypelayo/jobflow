import { useProfile } from '@/hooks/useProfile';
import { useState, useEffect } from 'preact/hooks';

export function ProfileTab() {
  const { profile, setProfile, loading, saving, status, save } =
    useProfile();

  // Local state for skills input to allow natural typing
  const [skillsInput, setSkillsInput] = useState('');
  const [linksInput, setLinksInput] = useState('');

  // Update local state when profile loads
  useEffect(() => {
    setSkillsInput(profile.skills?.join(', ') ?? '');
    setLinksInput(profile.links?.join(', ') ?? '');
  }, [profile.skills, profile.links]);

  if (loading) return <div class="tab-message">Loading profile...</div>;

  const update = (field: string, value: string | number | string[]) => {
    setProfile({ ...profile, [field]: value });
  };

  const processSkills = () => {
    const skills = skillsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    update('skills', skills);
  };

  const processLinks = () => {
    const links = linksInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    update('links', links);
  };

  return (
    <div class="tab-profile">
      <h2>Your Profile</h2>
      <p class="small">
        This information is used to generate tailored CVs for each job.
      </p>

      <div class="profile-form">
        <label>
          Full Name
          <input
            type="text"
            value={profile.fullName}
            onInput={(e) =>
              update('fullName', (e.target as HTMLInputElement).value)
            }
          />
        </label>

        <label>
          Email
          <input
            type="email"
            value={profile.email}
            onInput={(e) =>
              update('email', (e.target as HTMLInputElement).value)
            }
          />
        </label>

        <label>
          Phone
          <input
            type="tel"
            value={profile.phone}
            onInput={(e) =>
              update('phone', (e.target as HTMLInputElement).value)
            }
          />
        </label>

        <label>
          Location
          <input
            type="text"
            value={profile.location}
            onInput={(e) =>
              update('location', (e.target as HTMLInputElement).value)
            }
          />
        </label>

        <label>
          Current Role
          <input
            type="text"
            value={profile.currentRole}
            onInput={(e) =>
              update('currentRole', (e.target as HTMLInputElement).value)
            }
          />
        </label>

        <label>
          Years of Experience
          <input
            type="number"
            min={0}
            value={profile.yearsExperience}
            onInput={(e) =>
              update(
                'yearsExperience',
                Number((e.target as HTMLInputElement).value) || 0
              )
            }
          />
        </label>

        <label>
          Key Skills (comma-separated)
          <input
            type="text"
            value={skillsInput}
            onInput={(e) =>
              setSkillsInput((e.target as HTMLInputElement).value)
            }
            onBlur={processSkills}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                processSkills();
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
        </label>

        <label>
          Links (comma-separated)
          <input
            type="text"
            value={linksInput}
            onInput={(e) =>
              setLinksInput((e.target as HTMLInputElement).value)
            }
            onBlur={processLinks}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                processLinks();
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
        </label>

        <label>
          Career Story (Markdown)
          <textarea
            rows={10}
            value={profile.storyMarkdown}
            onInput={(e) =>
              update(
                'storyMarkdown',
                (e.target as HTMLTextAreaElement).value
              )
            }
          />
        </label>
      </div>

      <button
        id="saveProfileBtn"
        disabled={saving}
        onClick={() => save(profile)}
      >
        {saving ? 'Saving...' : 'Save Profile'}
      </button>
      <span class="status-text">{status}</span>
    </div>
  );
}
