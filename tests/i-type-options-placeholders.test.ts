/**
 * Host report 2026-11-10: the I-Type pick lists offered "Xxxxx" and
 * "Xxxxx Xxxxx", fill-in placeholders carried over from the source
 * template. The lists are select-only, so picking one printed the
 * placeholder on the publication. The address list carried the same kind
 * of row ("## Street Address, City, State #####-####").
 *
 * Short-title formats (TM-#####X-##/#) and the supersedure statement are
 * patterns the drafter reads as a format guide, so the check covers only
 * the lists of names, offices and addresses.
 */
import { describe, it, expect } from 'vitest';
import { I_TYPE_OPTIONS } from '@/lib/i-type-options';

const NAME_LISTS = [
  'entities',
  'addresses',
  'categories',
  'signingAuthorities',
  'controllingOffices',
  'controlMarkings',
] as const;

describe('I-Type pick lists', () => {
  it.each(NAME_LISTS)('%s offers no fill-in placeholder', (list) => {
    const placeholders = I_TYPE_OPTIONS[list]
      .map((o) => o.value)
      .filter((v) => /x{5}/i.test(v) || v.includes('#'));
    expect(placeholders).toEqual([]);
  });
});
