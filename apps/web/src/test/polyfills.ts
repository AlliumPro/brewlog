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

// jsdom declares these on the prototype but throws "not implemented" when they run, so they
// are replaced unconditionally rather than only when absent.
Element.prototype.hasPointerCapture = (): boolean => false;
Element.prototype.setPointerCapture = (): void => undefined;
Element.prototype.releasePointerCapture = (): void => undefined;
Element.prototype.scrollIntoView = (): void => undefined;
