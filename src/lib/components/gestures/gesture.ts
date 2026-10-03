export type Direction = "up" | "right" | "down" | "left";
export type GestureMode = "tap" | "hold" | "vertical" | "swipe" | "number";
export type ControlSize = "compact" | "default" | "comfy";
export type GestureStyle =
  "plain" | "halo" | "corner" | "rails" | "compass" | "orbit" | "grip" | "reveal" | "perimeter" | "track" | "fan" | "courier";

export function swipeDirection(x: number, y: number, threshold = 28): Direction | null {
  if (Math.hypot(x, y) < threshold) return null;
  return Math.abs(x) > Math.abs(y) ? (x > 0 ? "right" : "left") : y > 0 ? "down" : "up";
}

export function swipeDelta(direction: Direction) {
  return { up: 1, right: 5, down: -1, left: -5 }[direction];
}
