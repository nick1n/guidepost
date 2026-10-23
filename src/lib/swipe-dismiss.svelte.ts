import { swipeDismiss } from "./swipe.ts";

/**
 * Create once per dialog and attach to the whole dialog, including its buttons and content.
 * Bind distance to the moving panel's translation and reset it when opening or closing externally.
 * Listener cleanup, gesture thresholds, click suppression, and scroll handling belong to swipeDismiss.
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
    attach: swipeDismiss({ dismiss, ondrag: (value) => (distance = value) }),
    get distance() {
      return distance;
    },
    reset() {
      distance = 0;
    },
  };
}
