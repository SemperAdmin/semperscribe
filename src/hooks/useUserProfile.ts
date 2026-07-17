'use client';

import { useState, useEffect, useCallback } from 'react';
import { z } from 'zod';
import { loadUnits, getLoadedUnits } from '@/lib/reference-data';
import { STORAGE_KEYS, readStorage, writeStorage, removeStorage } from '@/lib/storage-utils';

export interface UserProfile {
  // Identity / Refills
  fullName: string;
  rank: string;
  title: string;
  officeCode: string;
  fromTitle: string;
  unitRuc: string;
  // SET-1: manual unit entry for units missing from the RUC dataset.
  // Used only when unitRuc is empty - a selected unit always wins.
  manualUnitName: string;
  manualUnitLine2: string;
  manualUnitLine3: string;

  // Document Formatting
  headerType: 'USMC' | 'DON' | 'DLA';
  bodyFont: 'times' | 'courier';
  accentColor: 'black' | 'blue';

  // AMHS Defaults
  amhsClassification: string;
  amhsPrecedence: string;
}

// Persisted shape: every field optional so a profile saved by an older
// build still loads; unknown/mistyped fields are rejected by zod and
// the profile falls back to defaults rather than spreading bad data.
const persistedProfileSchema = z.object({
  fullName: z.string(),
  rank: z.string(),
  title: z.string(),
  officeCode: z.string(),
  fromTitle: z.string(),
  unitRuc: z.string(),
  manualUnitName: z.string(),
  manualUnitLine2: z.string(),
  manualUnitLine3: z.string(),
  headerType: z.enum(['USMC', 'DON', 'DLA']),
  bodyFont: z.enum(['times', 'courier']),
  accentColor: z.enum(['black', 'blue']),
  amhsClassification: z.string(),
  amhsPrecedence: z.string(),
}).partial();

const DEFAULT_PROFILE: UserProfile = {
  fullName: '',
  rank: '',
  title: '',
  officeCode: '',
  fromTitle: '',
  unitRuc: '',
  manualUnitName: '',
  manualUnitLine2: '',
  manualUnitLine3: '',
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
      const saved = readStorage(STORAGE_KEYS.userProfile, persistedProfileSchema);
      if (saved) {
        setProfile({ ...DEFAULT_PROFILE, ...saved });
      }
      setLoaded(true);
    })();
  }, []);

  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    setProfile(prev => {
      const next = { ...prev, ...updates };
      writeStorage(STORAGE_KEYS.userProfile, next);
      return next;
    });
  }, []);

  const clearProfile = useCallback(() => {
    removeStorage(STORAGE_KEYS.userProfile);
    setProfile(DEFAULT_PROFILE);
  }, []);

  /**
   * Build a partial FormData object from the profile for applying defaults.
   */
  const getFormDefaults = useCallback(() => {
    // SET-1: a dataset unit wins; the manual entry fills the gap for
    // units the RUC table does not carry.
    const unit = profile.unitRuc
      ? resolveUnit(profile.unitRuc)
      : profile.manualUnitName.trim()
        ? {
            line1: profile.manualUnitName.trim().toUpperCase(),
            line2: profile.manualUnitLine2.trim().toUpperCase(),
            line3: profile.manualUnitLine3.trim().toUpperCase(),
          }
        : { line1: '', line2: '', line3: '' };
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
