/**
 * jsdom implements neither the resize observer nor pointer capture, and Radix primitives use
 * both to position and drag their parts. These stubs let the components mount; nothing in the
 * tests depends on real measurements.
 */

class ResizeObserverStub implements ResizeObserver {
  observe(): void {
    // Measurements are irrelevant in jsdom: nothing has a layout.
  }

  unobserve(): void {
    // See observe().
  }

  disconnect(): void {
    // See observe().
  }
}

globalThis.ResizeObserver = ResizeObserverStub;

/**
 * jsdom has no matchMedia at all, and the theme code asks it what the system prefers.
 * The stub reports "no match", so tests see the light scheme unless they say otherwise —
 * a test that cares about the dark preference overrides this itself.
 */
globalThis.matchMedia = (query: string): MediaQueryList =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }) as MediaQueryList;

// jsdom declares these on the prototype but throws "not implemented" when they run, so they
// are replaced unconditionally rather than only when absent.
Element.prototype.hasPointerCapture = (): boolean => false;
Element.prototype.setPointerCapture = (): void => undefined;
Element.prototype.releasePointerCapture = (): void => undefined;
Element.prototype.scrollIntoView = (): void => undefined;
