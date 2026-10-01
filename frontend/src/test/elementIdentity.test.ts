import { describe, it, expect, beforeEach } from 'vitest';
import { parseElementIdentity } from '../services/elementIdentity';

// Helper recreating page agent's identity logic to test inside JSDOM environment
function getDirectTextSnippet(el: Element): string {
  let text = '';
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent || '';
    } else if (node.nodeType === Node.ELEMENT_NODE && text.length < 40) {
      text += (node.textContent || '').trim() + ' ';
    }
    if (text.length >= 60) break;
  }
  return text.replace(/\s+/g, ' ').trim().slice(0, 40);
}

function getElementIdentity(el: Element): string | null {
  if (el === document.body || el === document.documentElement) return null;

  const dataKey = el.getAttribute('data-key');
  if (dataKey) return `key:${dataKey}`;

  if (el.id && el.id !== 'root' && el.id !== 'app') return `id:${el.id}`;

  let ancestor = el.parentElement;
  let anchorDesc = 'body';
  while (ancestor && ancestor !== document.body && ancestor !== document.documentElement) {
    const aKey = ancestor.getAttribute('data-key');
    if (aKey) {
      anchorDesc = `key:${aKey}`;
      break;
    }
    if (ancestor.id && ancestor.id !== 'root' && ancestor.id !== 'app') {
      anchorDesc = `id:${ancestor.id}`;
      break;
    }
    ancestor = ancestor.parentElement;
  }

  const tag = el.tagName.toLowerCase();
  const firstClass = el.classList.length > 0 ? `.${el.classList[0]}` : '';
  const dataName = el.getAttribute('data-name') ? `[name="${el.getAttribute('data-name')}"]` : '';
  const textSnippet = getDirectTextSnippet(el);
  const textSig = textSnippet ? `[text="${encodeURIComponent(textSnippet)}"]` : '';

  let ordinal = 0;
  let sibling = el.previousElementSibling;
  while (sibling) {
    if (
      sibling.tagName === el.tagName &&
      sibling.getAttribute('data-name') === el.getAttribute('data-name') &&
      getDirectTextSnippet(sibling) === textSnippet
    ) {
      ordinal++;
    }
    sibling = sibling.previousElementSibling;
  }

  return `${anchorDesc} > ${tag}${firstClass}${dataName}${textSig}${ordinal > 0 ? `#${ordinal}` : ''}`;
}

function resolveElementByIdentity(idStr: string): Element | null {
  if (!idStr) return null;

  if (idStr.startsWith('key:') && !idStr.includes(' > ')) {
    return document.querySelector(`[data-key="${CSS.escape(idStr.slice(4))}"]`);
  }

  if (idStr.startsWith('id:') && !idStr.includes(' > ')) {
    return document.getElementById(idStr.slice(3));
  }

  const parts = idStr.split(' > ');
  if (parts.length === 2) {
    const anchorDesc = parts[0];
    const targetDesc = parts[1];

    let anchorEl: Element | null = document.body;
    if (anchorDesc.startsWith('key:')) {
      anchorEl = document.querySelector(`[data-key="${CSS.escape(anchorDesc.slice(4))}"]`);
    } else if (anchorDesc.startsWith('id:')) {
      anchorEl = document.getElementById(anchorDesc.slice(3));
    }
    if (!anchorEl) return null;

    const tagMatch = targetDesc.match(/^([a-z0-9]+)/i);
    if (!tagMatch) return null;
    const tag = tagMatch[1].toLowerCase();

    const nameMatch = targetDesc.match(/\[name="([^"]+)"\]/);
    const targetName = nameMatch ? nameMatch[1] : null;

    const textMatch = targetDesc.match(/\[text="([^"]+)"\]/);
    const targetText = textMatch ? decodeURIComponent(textMatch[1]) : null;

    const ordinalMatch = targetDesc.match(/#(\d+)$/);
    const targetOrdinal = ordinalMatch ? parseInt(ordinalMatch[1], 10) : 0;

    const candidates = anchorEl.querySelectorAll(tag);
    let matchedCount = 0;

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      if (targetName && candidate.getAttribute('data-name') !== targetName) continue;
      if (targetText && getDirectTextSnippet(candidate) !== targetText) continue;

      if (matchedCount === targetOrdinal) {
        return candidate;
      }
      matchedCount++;
    }
  }

  return null;
}

describe('Element Identity Strategy', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="hero" data-key="hero-banner">
        <h1 data-name="Title">Welcome to Figr</h1>
        <button class="primary" data-key="btn-cta">Get Started</button>
      </div>
      <ul id="feed">
        <li><span>Ada</span> commented on Design</li>
        <li><span>Linus</span> approved PR</li>
        <li><span>Grace</span> merged Feature</li>
      </ul>
    `;
  });

  it('identifies elements with data-key directly', () => {
    const btn = document.querySelector('[data-key="btn-cta"]')!;
    const identity = getElementIdentity(btn);
    expect(identity).toBe('key:btn-cta');

    const resolved = resolveElementByIdentity(identity!);
    expect(resolved).toBe(btn);
  });

  it('identifies elements with id directly', () => {
    const feed = document.getElementById('feed')!;
    const identity = getElementIdentity(feed);
    expect(identity).toBe('id:feed');

    const resolved = resolveElementByIdentity(identity!);
    expect(resolved).toBe(feed);
  });

  it('survives DOM rebuild via innerHTML without data-key (page-4 scenario)', () => {
    const secondLi = document.querySelectorAll('#feed li')[1]; // Linus approved PR
    const identity = getElementIdentity(secondLi);
    expect(identity).toContain('id:feed > li');
    expect(identity).toContain('Linus');

    // Simulate page-4 innerHTML rebuild
    document.getElementById('feed')!.innerHTML = `
      <li><span>Ada</span> commented on Design</li>
      <li><span>Linus</span> approved PR</li>
      <li><span>Grace</span> merged Feature</li>
    `;

    const newLi = resolveElementByIdentity(identity!);
    expect(newLi).not.toBeNull();
    expect(newLi!.textContent).toContain('Linus approved PR');
  });

  it('survives insertion of new siblings before the element (page-4 unshift scenario)', () => {
    const graceLi = document.querySelectorAll('#feed li')[2]; // Grace merged Feature
    const identity = getElementIdentity(graceLi);
    expect(identity).toContain('Grace');

    // Simulate new item unshifted to the top of feed (prepending a sibling)
    const feed = document.getElementById('feed')!;
    feed.innerHTML = `
      <li><span>Alan</span> reopened Ticket</li>
      <li><span>Ada</span> commented on Design</li>
      <li><span>Linus</span> approved PR</li>
      <li><span>Grace</span> merged Feature</li>
    `;

    // Grace is now at index 3 instead of index 2, but identity resolves to Grace!
    const resolved = resolveElementByIdentity(identity!);
    expect(resolved).not.toBeNull();
    expect(resolved!.textContent).toContain('Grace merged Feature');
  });

  it('returns null and does not jump when element is deleted (page-4 pop scenario)', () => {
    const graceLi = document.querySelectorAll('#feed li')[2];
    const identity = getElementIdentity(graceLi);

    // Simulate element dropping off the feed
    document.getElementById('feed')!.innerHTML = `
      <li><span>Ada</span> commented on Design</li>
      <li><span>Linus</span> approved PR</li>
    `;

    const resolved = resolveElementByIdentity(identity!);
    expect(resolved).toBeNull(); // Correctly marked missing, never jumped to another li!
  });

  it('parses identity strings correctly', () => {
    const parsedKey = parseElementIdentity('key:hero-banner');
    expect(parsedKey.key).toBe('hero-banner');

    const parsedId = parseElementIdentity('id:feed');
    expect(parsedId.id).toBe('feed');

    const parsedComplex = parseElementIdentity('id:feed > li.item[name="FeedItem"][text="Grace"]#1');
    expect(parsedComplex.anchor).toBe('id:feed');
    expect(parsedComplex.tag).toBe('li');
    expect(parsedComplex.firstClass).toBe('item');
    expect(parsedComplex.dataName).toBe('FeedItem');
    expect(parsedComplex.textSnippet).toBe('Grace');
    expect(parsedComplex.ordinal).toBe(1);
  });
});
