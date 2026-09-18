/** Mouse panning complements native wheel and touch scrolling without taking over controls. */
export function dragScroll(workspace: HTMLElement) {
  let gesture: { panel: HTMLElement; id: number; x: number; y: number; left: number; top: number; moving: boolean } | undefined;
  let suppressClick = false;
  const controls = "button, input, textarea, select, a, label, [contenteditable], [draggable=true]";

  function nearestPanel(x: number) {
    const panels = Array.from(workspace.querySelectorAll<HTMLElement>(":scope > .dashboard"));
    return panels.reduce<HTMLElement | undefined>((nearest, panel) => {
      if (!nearest) return panel;
      const distance = (element: HTMLElement) => {
        const bounds = element.getBoundingClientRect();
        return Math.max(bounds.left - x, 0, x - bounds.right);
      };
      return distance(panel) < distance(nearest) ? panel : nearest;
    }, undefined);
  }

  function onpointerdown(event: PointerEvent) {
    suppressClick = false;
    if (event.pointerType !== "mouse" || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    const target = event.target as Element;
    if (target.closest(controls)) return;
    const panel = target.closest<HTMLElement>(".dashboard") ?? nearestPanel(event.clientX);
    if (!panel || !workspace.contains(panel)) return;
    gesture = {
      panel,
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: workspace.scrollLeft,
      top: panel.scrollTop,
      moving: false,
    };
  }
  function onpointermove(event: PointerEvent) {
    if (!gesture || event.pointerId !== gesture.id) return;
    const x = event.clientX - gesture.x;
    const y = event.clientY - gesture.y;
    if (!gesture.moving) {
      if (Math.hypot(x, y) < 6) return;
      gesture.moving = true;
      workspace.dataset.dragging = "true";
      gesture.panel.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    workspace.scrollLeft = gesture.left - x;
    gesture.panel.scrollTop = gesture.top - y;
  }
  function finish() {
    if (!gesture) return;
    suppressClick = gesture.moving;
    if (gesture.panel.hasPointerCapture(gesture.id)) gesture.panel.releasePointerCapture(gesture.id);
    gesture = undefined;
    delete workspace.dataset.dragging;
  }
  function onpointerup(event: PointerEvent) {
    if (gesture?.id === event.pointerId) finish();
  }
  function onclick(event: MouseEvent) {
    if (!suppressClick) return;
    suppressClick = false;
    event.preventDefault();
    event.stopPropagation();
  }
  workspace.addEventListener("pointerdown", onpointerdown);
  workspace.addEventListener("click", onclick, true);
  window.addEventListener("pointermove", onpointermove, { passive: false });
  window.addEventListener("pointerup", onpointerup);
  window.addEventListener("pointercancel", onpointerup);
  window.addEventListener("blur", finish);
  return () => {
    finish();
    workspace.removeEventListener("pointerdown", onpointerdown);
    workspace.removeEventListener("click", onclick, true);
    window.removeEventListener("pointermove", onpointermove);
    window.removeEventListener("pointerup", onpointerup);
    window.removeEventListener("pointercancel", onpointerup);
    window.removeEventListener("blur", finish);
  };
}
