#!/usr/bin/env python3
"""Generate src/lib/navmc10132-field-metrics.ts from the NAVMC 10132 field map.

The full map is 134KB and carries the decoded PDF JavaScript source, none of
which belongs in a client bundle. This emits only the four numbers a width
check needs, for the form's 32 text fields.

Usage:
    python gen_navmc10132_metrics.py navmc10132-map.json > ../../src/lib/navmc10132-field-metrics.ts
"""
import json
import sys

HEADER = '''/**
 * NAVMC 10132 text-field geometry, the minimum needed to measure fit.
 *
 * GENERATED from tools/aa-forms/navmc10132-map.json by
 * tools/aa-forms/gen_navmc10132_metrics.py. Do not hand-edit.
 *
 * The full map is 134KB and carries the decoded PDF JavaScript, which has no
 * business in a client bundle. This module carries only the four numbers a
 * width check needs, for the 32 text fields.
 *
 * Rule source: docs/NAVMC_10132_SPEC.md section 2.2.
 */

export interface Navmc10132FieldMetric {
  /** Widget width in points. */
  width: number;
  /** Point size from the widget's own /DA. Every field on this form is 8pt. */
  fontSize: number;
  /** Usable lines. 1 for every field except item 21. */
  lines: number;
  multiline: boolean;
}

export const NAVMC_10132_FIELD_METRICS: Readonly<Record<string, Navmc10132FieldMetric>> = {'''


def main():
    if len(sys.argv) != 2:
        print(__doc__, file=sys.stderr)
        return 2
    data = json.load(open(sys.argv[1], encoding='utf-8'))
    print(HEADER)
    count = 0
    for field in data['fields']:
        if field['type'] != '/Tx':
            continue
        multiline = 'multiline' in (field.get('flags') or [])
        name = field['name'].replace("'", "\\'")
        print(
            f"  '{name}': {{ width: {field['width']}, fontSize: {field['fontSize']}, "
            f"lines: {field['lines']}, multiline: {str(multiline).lower()} }},"
        )
        count += 1
    print('};')
    print(f'{count} text fields', file=sys.stderr)
    return 0


if __name__ == '__main__':
    sys.exit(main())
