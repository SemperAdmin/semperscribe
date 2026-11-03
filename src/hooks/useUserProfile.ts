'use client';

import { useState, useEffect, useCallback } from 'react';
import { z } from 'zod';
import { loadUnits, getLoadedUnits } from '@/lib/reference-data';
import type { Unit } from '@/lib/units';
import { STORAGE_KEYS, readStorage, writeStorage, removeStorage } from '@/lib/storage-utils';

export interface UserProfile {
  // Identity / Refills
  fullName: string;
  rank: string;
  title: string;
  officeCode: string;
  fromTitle: string;
  unitRuc: string;
  // MCC of the selected unit. Most RUCs cover several units (RUC 06015
  // alone spans CNATT, CNATTU and MATSG-23), so the RUC by itself does
  // not identify which letterhead the user picked. Empty on profiles
  // saved before this field existed - those fall back to RUC only.
  unitMcc: string;
  // SET-1: manual unit entry for units missing from the RUC dataset.
  // Used only when unitRuc is empty - a selected unit always wins.
  // Mirrors the app's 4-line letterhead: name, optional sub-name
  // (FormData.line1b), street, city/state/zip.
  manualUnitName: string;
  manualUnitSubName: string;
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
  unitMcc: z.string(),
  manualUnitName: z.string(),
  manualUnitSubName: z.string(),
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
  unitMcc: '',
  manualUnitName: '',
  manualUnitSubName: '',
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
export function findUnit(ruc: string, mcc?: string): Unit | undefined {
  if (!ruc) return undefined;
  // Reads the lazy-loaded snapshot; useUserProfile awaits loadUnits()
  // before reporting loaded, so profile-gated callers see real data.
  const units = getLoadedUnits();
  return (mcc ? units.find(u => u.ruc === ruc && u.mcc === mcc) : undefined)
    ?? units.find(u => u.ruc === ruc);
}

export function resolveUnit(ruc: string, mcc?: string) {
  if (!ruc) return { line1: '', line2: '', line3: '' };
  const unit = findUnit(ruc, mcc);
  if (!unit) return { line1: '', line2: '', line3: '' };
  // A unit with spelled-out letterhead lines prints those instead of the
  // abbreviated unitName, the same as picking it in UnitInfoSection.
  const headingLines = unit.letterhead?.length
    ? unit.letterhead.map(l => l.toUpperCase())
    : undefined;
  return {
    line1: (headingLines?.[0] ?? unit.unitName).toUpperCase(),
    headingLines,
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
    // units the RUC table does not carry. line1b is the optional
    // sub-name line - the dataset has no equivalent, so it fills only
    // from manual entry.
    const unit = profile.unitRuc
      ? { ...resolveUnit(profile.unitRuc, profile.unitMcc), line1b: '' }
      : profile.manualUnitName.trim()
        ? {
            line1: profile.manualUnitName.trim().toUpperCase(),
            line1b: profile.manualUnitSubName.trim().toUpperCase(),
            line2: profile.manualUnitLine2.trim().toUpperCase(),
            line3: profile.manualUnitLine3.trim().toUpperCase(),
            headingLines: undefined as string[] | undefined,
          }
        : { line1: '', line1b: '', line2: '', line3: '', headingLines: undefined as string[] | undefined };
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
