'use client';

/**
 * ISO string adapter over the shared DatePicker.
 *
 * The shared component speaks Date objects through date and setDate. Every NAVMC
 * 10132 field stores an ISO yyyy-mm-dd string, because that is what the form's own
 * AFDate_FormatEx scripts print. Rather than repeat the conversion at nine call
 * sites, and risk one of them reaching for new Date('yyyy-mm-dd') and losing a day
 * west of Greenwich, the conversion lives here once.
 */

import React from 'react';
import { DatePicker } from '@/components/ui/date-picker';
import { parseIsoDate, toIsoDate } from '@/lib/navmc10132-date';

export function IsoDatePicker({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string | undefined;
  onChange: (iso: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const current = parseIsoDate(value);
  return (
    <DatePicker
      date={current ?? undefined}
      setDate={(d) => onChange(d ? toIsoDate(d) : '')}
      placeholder={placeholder}
      className={className}
    />
  );
}
