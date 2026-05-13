import { describe, expect, it, vi } from 'vitest';
import { Overlayer } from 'foliate-js/overlayer.js';

const makeRange = (rect: DOMRectInit) => {
  document.body.innerHTML = '<p>Annotated text</p>';
  const textNode = document.querySelector('p')!.firstChild!;
  const range = document.createRange();
  range.setStart(textNode, 0);
  range.setEnd(textNode, textNode.textContent!.length);

  Object.defineProperty(range, 'getClientRects', {
    value: vi.fn(() => [DOMRect.fromRect(rect)]),
  });

  return range;
};

describe('Overlayer note bubble hit target', () => {
  it('uses the note bubble hit rect instead of the original text rect', () => {
    const overlayer = new Overlayer(document);
    const range = makeRange({ x: 10, y: 10, width: 100, height: 20 });

    overlayer.add('note-1', range, Overlayer.bubble, { hitSize: 32 });

    expect(overlayer.hitTest({ x: 120, y: 0 })[0]).toBe('note-1');
  });

  it('does not expand normal annotation hit testing', () => {
    const overlayer = new Overlayer(document);
    const range = makeRange({ x: 10, y: 10, width: 100, height: 20 });

    overlayer.add('highlight-1', range, Overlayer.highlight);

    expect(overlayer.hitTest({ x: 120, y: 0 })).toEqual([]);
  });

  it('chooses the closest note bubble when adjacent hit targets overlap', () => {
    const overlayer = new Overlayer(document);
    const firstRange = makeRange({ x: 10, y: 10, width: 100, height: 20 });
    const secondRange = makeRange({ x: 70, y: 30, width: 100, height: 20 });

    overlayer.add('note-1', firstRange, Overlayer.bubble, { hitSize: 44 });
    overlayer.add('note-2', secondRange, Overlayer.bubble, { hitSize: 44 });

    expect(overlayer.hitTest({ x: 115, y: 10 })[0]).toBe('note-1');
    expect(overlayer.hitTest({ x: 175, y: 30 })[0]).toBe('note-2');
  });
});
