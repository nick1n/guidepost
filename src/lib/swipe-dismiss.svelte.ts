import { swipe } from "./swipe.ts";

/**
 * Create once per dialog and attach to the whole dialog, including its buttons and content.
 * Bind distance to the moving panel's translation and reset it when opening or closing externally.
 * Gesture recognition, listener cleanup, click suppression, and scroll handling belong to swipe.
 *
 * @example
 * const dismissal = createSwipeDismiss(close);
 * // <dialog {@attach dismissal.attach}>...</dialog>
 * // data-dragging={dismissal.distance > 0}
 * // style:translate={dismissal.distance > 0 ? `0 ${dismissal.distance}px` : undefined}
 */
export function createSwipeDismiss(dismiss: () => void) {
  let distance = $state(0);

  return {
    attach: swipe({ directions: ["down"], threshold: 64, duration: 1500, onSwipe: dismiss, onDrag: (value) => (distance = value) }),
    get distance() {
      return distance;
    },
    reset() {
      distance = 0;
    },
  };
}
