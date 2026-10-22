/**
 * Restores field values in the page tree pdf.js builds for a dynamic XFA
 * form, before XfaLayer renders it.
 *
 * WHY. pdf.js reads a data value through XFAAttribute.$getDataValue,
 * which trims it, so a value that starts with blank lines or a run of
 * spaces (the typed name opening block 13 on the NAVMC 10274) loses
 * them in the preview while Acrobat keeps them. The tree names each
 * field's data node in `dataId` as the field name followed by a numeric
 * uid ("ProcAct582"); the exact values the app wrote replace the
 * trimmed ones there. Inputs take `value`, textareas `textContent`.
 */
export interface XfaHtmlNode {
  name: string;
  attributes?: Record<string, unknown> & { dataId?: string; value?: string; textContent?: string };
  children?: (XfaHtmlNode | null)[];
}

/**
 * The field a pdf.js dataId belongs to, among `names`, or null. The id is
 * the field name plus a numeric uid ("ProcAct582"), and a field name may
 * itself end in a digit ("Via1574" is Via1), so the match is against the
 * known names, longest first, with the rest all digits.
 */
export function xfaFieldNameOf(dataId: unknown, names: readonly string[]): string | null {
  if (typeof dataId !== 'string') return null;
  const candidates = [...names].sort((a, b) => b.length - a.length);
  for (const name of candidates) {
    if (dataId.startsWith(name) && /^\d+$/.test(dataId.slice(name.length))) return name;
  }
  return null;
}

/** Walks the tree and sets every input or textarea whose field has a value in `values`. Returns how many it set. */
export function applyXfaFieldValues(root: XfaHtmlNode | null | undefined, values: Readonly<Record<string, string>>): number {
  if (!root) return 0;
  let count = 0;
  const names = Object.keys(values);
  const stack: XfaHtmlNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop() as XfaHtmlNode;
    if ((node.name === 'textarea' || node.name === 'input') && node.attributes) {
      const name = xfaFieldNameOf(node.attributes.dataId, names);
      if (name && Object.prototype.hasOwnProperty.call(values, name)) {
        const text = values[name].replace(/\r\n?/g, '\n');
        if (node.name === 'textarea') node.attributes.textContent = text;
        else node.attributes.value = text;
        count++;
      }
    }
    for (const child of node.children ?? []) if (child) stack.push(child);
  }
  return count;
}
