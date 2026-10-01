import { ElementIdentity } from '../types/element';

export function parseElementIdentity(raw: string): ElementIdentity {
  if (!raw) {
    return { raw, tag: '' };
  }

  if (raw.startsWith('key:') && !raw.includes(' > ')) {
    return {
      raw,
      key: raw.slice(4),
      tag: '',
    };
  }

  if (raw.startsWith('id:') && !raw.includes(' > ')) {
    return {
      raw,
      id: raw.slice(3),
      tag: '',
    };
  }

  const parts = raw.split(' > ');
  const anchor = parts[0];
  const target = parts[1] || parts[0];

  const tagMatch = target.match(/^([a-z0-9]+)/i);
  const tag = tagMatch ? tagMatch[1].toLowerCase() : '';

  const classMatch = target.match(/\.([a-z0-9_-]+)/i);
  const firstClass = classMatch ? classMatch[1] : undefined;

  const nameMatch = target.match(/\[name="([^"]+)"\]/);
  const dataName = nameMatch ? nameMatch[1] : undefined;

  const textMatch = target.match(/\[text="([^"]+)"\]/);
  const textSnippet = textMatch ? decodeURIComponent(textMatch[1]) : undefined;

  const ordinalMatch = target.match(/#(\d+)$/);
  const ordinal = ordinalMatch ? parseInt(ordinalMatch[1], 10) : 0;

  return {
    raw,
    anchor,
    tag,
    firstClass,
    dataName,
    textSnippet,
    ordinal,
  };
}

export function areIdentitiesEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a === b;
}
