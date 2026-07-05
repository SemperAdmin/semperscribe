'use client';

import { useState, useEffect, useCallback } from 'react';
import { loadUnits, getLoadedUnits } from '@/lib/reference-data';

export interface UserProfile {
  // Identity / Refills
  fullName: string;
  rank: string;
  title: string;
  officeCode: string;
  fromTitle: string;
  unitRuc: string;

  // Document Formatting
  headerType: 'USMC' | 'DON' | 'DLA';
  bodyFont: 'times' | 'courier';
  accentColor: 'black' | 'blue';

  // AMHS Defaults
  amhsClassification: string;
  amhsPrecedence: string;
}

const STORAGE_KEY = 'semperscribe-user-profile';

const DEFAULT_PROFILE: UserProfile = {
  fullName: '',
  rank: '',
  title: '',
  officeCode: '',
  fromTitle: '',
  unitRuc: '',
  headerType: 'USMC',
  bodyFont: 'times',
  accentColor: 'black',
  amhsClassification: 'UNCLASSIFIED',
  amhsPrecedence: 'ROUTINE',
};

/**
 * Resolve a unit RUC to line1/line2/line3 address fields.
 */
export function resolveUnit(ruc: string) {
  if (!ruc) return { line1: '', line2: '', line3: '' };
  // Reads the lazy-loaded snapshot; useUserProfile awaits loadUnits()
  // before reporting loaded, so profile-gated callers see real data.
  const unit = getLoadedUnits().find(u => u.ruc === ruc);
  if (!unit) return { line1: '', line2: '', line3: '' };
  return {
    line1: unit.unitName.toUpperCase(),
    line2: unit.streetAddress.toUpperCase(),
    line3: `${unit.cityState} ${unit.zip}`.toUpperCase(),
  };
}

/**
 * Hook for managing persisted user profile (localStorage).
 */
export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      // Units back resolveUnit()/getFormDefaults(); make sure the lazy
      // chunk is in before consumers gate on `loaded`. On failure the
      // profile still loads — unit lines just resolve empty.
      try {
        await loadUnits();
      } catch (e) {
        console.error('Failed to load unit table:', e);
      }
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          setProfile({ ...DEFAULT_PROFILE, ...parsed });
        }
      } catch (e) {
        console.error('Failed to load user profile:', e);
      }
      setLoaded(true);
    })();
  }, []);

  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    setProfile(prev => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.error('Failed to save user profile:', e);
      }
      return next;
    });
  }, []);

  const clearProfile = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear user profile:', e);
    }
    setProfile(DEFAULT_PROFILE);
  }, []);

  /**
   * Build a partial FormData object from the profile for applying defaults.
   */
  const getFormDefaults = useCallback(() => {
    const unit = resolveUnit(profile.unitRuc);
    return {
      sig: profile.fullName,
      originatorCode: profile.officeCode,
      from: profile.fromTitle,
      headerType: profile.headerType,
      bodyFont: profile.bodyFont,
      accentColor: profile.accentColor,
      amhsClassification: profile.amhsClassification,
      amhsPrecedence: profile.amhsPrecedence,
      ...unit,
    };
  }, [profile]);

  return { profile, loaded, updateProfile, clearProfile, getFormDefaults };
}
