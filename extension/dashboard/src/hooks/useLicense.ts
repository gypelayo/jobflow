import { useState, useEffect } from 'preact/hooks';
import { loadSettings } from '@/lib/storage';
import { computeLicenseStatus } from '@/lib/license';
import type { LicenseStatus } from '@/lib/license';

export function useLicense(): LicenseStatus {
  const [status, setStatus] = useState<LicenseStatus>({
    isActive: false,
    isExpired: false,
    daysRemaining: 0,
    expiry: null,
    purchaseDate: null,
  });

  useEffect(() => {
    loadSettings().then((s) => {
      setStatus(computeLicenseStatus(s.licenseExpiry ?? ''));
    });
  }, []);

  return status;
}
