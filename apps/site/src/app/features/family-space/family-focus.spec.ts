import { focusFamilyHeading } from './family-focus';

describe('Family title focus below the sticky header', () => {
  it.each([80, 142, 230])(
    'uses the measured %ipx header rather than a fixed rem margin',
    (bottom) => {
      const focus = vi.fn();
      const scrollIntoView = vi.fn();
      const heading = {
        ownerDocument: {
          querySelector: vi.fn(() => ({ getBoundingClientRect: () => ({ bottom }) })),
        },
        style: { scrollMarginTop: '' },
        focus,
        scrollIntoView,
      } as unknown as HTMLElement;
      focusFamilyHeading(heading);
      expect(heading.style.scrollMarginTop).toBe(`${bottom + 16}px`);
      expect(focus).toHaveBeenCalledWith({ preventScroll: true });
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'instant', block: 'start' });
    },
  );
  it('does nothing when no rendered heading exists', () => {
    expect(() => focusFamilyHeading(null)).not.toThrow();
  });
});
