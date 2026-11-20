/** Keep focused page titles below the real sticky navigation, including wrapped labels and zoom. */
export function focusFamilyHeading(heading: HTMLElement | null | undefined) {
  if (!heading) return;
  const header = heading.ownerDocument.querySelector<HTMLElement>('app-header header');
  const bottom = header?.getBoundingClientRect().bottom ?? 0;
  heading.style.scrollMarginTop = `${Math.max(0, bottom) + 16}px`;
  heading.focus({ preventScroll: true });
  heading.scrollIntoView({ behavior: 'instant', block: 'start' });
}
