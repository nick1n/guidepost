<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import { swipeDelta, swipeDirection, type ControlSize, type Direction, type GestureMode, type GestureStyle } from "./gesture";

  let {
    name,
    mode,
    variant,
    holdDuration = 550,
    size = "default",
  }: {
    name: string;
    mode: GestureMode;
    variant: GestureStyle;
    holdDuration?: number;
    size?: ControlSize;
  } = $props();

  const initialValues = [6, 3, 8, 2, 5, 1];
  const directions: Direction[] = ["up", "down", "right", "left"];
  const menuLabels = { up: "+5", down: "−5", right: "Edit", left: "Reset" };
  const keyDirections: Record<string, Direction> = { ArrowUp: "up", ArrowRight: "right", ArrowDown: "down", ArrowLeft: "left" };
  const id = $props.id();

  let values = $state([...initialValues]);
  let panels = $state([false, false, false, false, false, false]);
  let active = $state(1);
  let phase = $state<"idle" | "pressing" | "ready" | "menu">("idle");
  let direction = $state<Direction | null>(null);
  let swipeTravel = $state(0);
  let result = $state("Try the neighboring controls");
  let preview = $state(false);
  let previewVersion = $state(0);
  let editing = $state(false);
  let draft = $state(3);
  let menuPaths = $state<Partial<Record<Direction, string>>>({});
  let choiceWidth = $state(44);
  let courierPath = $state("");
  let courierVersion = $state(0);
  let example: HTMLDivElement;
  let menu = $state<HTMLDivElement>();
  let input = $state<HTMLInputElement>();
  const buttons: HTMLButtonElement[] = [];
  let pointer: { id: number; x: number; y: number; moved: boolean } | undefined;
  let holdTimer: ReturnType<typeof setTimeout> | undefined;
  let previewTimer: ReturnType<typeof setTimeout> | undefined;
  let suppressClick = false;
  let spaceDown = false;

  let numeric = $derived(mode === "vertical" || mode === "swipe" || mode === "number");
  let canHold = $derived(mode === "hold" || mode === "vertical" || mode === "number");
  let labels = $derived(
    numeric
      ? ["Survival", "Movement", "Strength", "Accuracy", "Evasion", "Luck"]
      : ["Current", "Survivor", "Monster", "Settlement", "Hunt", "Overview"],
  );
  let shortLabels = $derived(numeric ? ["SUR", "MOV", "STR", "ACC", "EVA", "LCK"] : ["CUR", "SUR", "MON", "SET", "HNT", "ALL"]);
  let expanded = $derived(panels.every(Boolean));
  let menuOpen = $derived(phase === "menu");
  let pathMenu = $derived(variant === "fan");
  let previewMenu = $derived(preview && pathMenu);
  let previewValue = $derived(direction && !menuOpen ? Math.max(0, Math.min(99, values[active] + swipeDelta(direction))) : values[active]);
  let loopDistance = $derived(swipeTravel <= 0 ? -swipeTravel * 25 : 100 - swipeTravel * 25);

  function indexOf(event: Event) {
    return Number((event.currentTarget as HTMLButtonElement).dataset.index);
  }

  function announce(action: string) {
    result = `${labels[active]}: ${action}`;
  }

  function changeValue(delta: number, gesture: string) {
    const previous = values[active];
    values[active] = Math.max(0, Math.min(99, previous + delta));
    announce(
      values[active] === previous
        ? `${values[active] === 0 ? "minimum" : "maximum"} reached`
        : `${gesture} ${previous} → ${values[active]}`,
    );
  }

  function togglePanels(all = false) {
    if (all) {
      const next = !expanded;
      panels = panels.map(() => next);
      result = `All six dashboards ${next ? "expanded" : "collapsed"}`;
    } else {
      panels[active] = !panels[active];
      announce(panels[active] ? "expanded" : "collapsed");
    }
  }

  function courierPoint(index: number) {
    const row = example.getBoundingClientRect();
    const field = buttons[index].getBoundingClientRect();
    return { x: field.x + field.width / 2 - row.x - example.clientLeft, y: field.y - row.y - 10 - example.clientTop };
  }

  function activate(index: number) {
    if (variant === "courier" && index !== active) {
      const from = courierPoint(active);
      const to = courierPoint(index);
      courierPath = `M ${from.x} ${from.y} C ${from.x} ${from.y - 14} ${to.x} ${to.y - 14} ${to.x} ${to.y}`;
      courierVersion += 1;
    }
    active = index;
  }

  function clearHold() {
    clearTimeout(holdTimer);
    holdTimer = undefined;
  }

  function stopPreview() {
    clearTimeout(previewTimer);
    preview = false;
  }

  function cancelGesture() {
    pointer = undefined;
    spaceDown = false;
    clearHold();
    phase = "idle";
    direction = null;
    swipeTravel = 0;
  }

  async function routeMenu() {
    if (!pathMenu) return;
    menuPaths = {};
    const selected = active;
    await tick();
    if ((!menuOpen && !previewMenu) || selected !== active || !menu) return;
    const bounds = menu.getBoundingClientRect();
    const field = buttons[active].getBoundingClientRect();
    const startX = field.x + field.width / 2 - bounds.x - menu.clientLeft;
    const startY = field.y + field.height / 2 - bounds.y - menu.clientTop;
    const row = example.getBoundingClientRect();
    choiceWidth = field.width;
    const minX = row.left - bounds.left - menu.clientLeft + choiceWidth / 2;
    const maxX = row.right - bounds.left - menu.clientLeft - choiceWidth / 2;
    const clampX = (x: number) => Math.max(minX, Math.min(maxX, x));
    const paths: Partial<Record<Direction, string>> = {};
    for (const item of directions) {
      const slot = menu.querySelector<HTMLElement>(`[data-slot="${item}"]`)!.getBoundingClientRect();
      const x = slot.x + slot.width / 2 - bounds.x - menu.clientLeft;
      const y = slot.y + slot.height / 2 - bounds.y - menu.clientTop;
      const bend = (directions.indexOf(item) - 1.5) * 12;
      paths[item] = `M ${startX} ${startY} C ${clampX(startX + bend)} ${startY - 50} ${clampX(x - bend)} ${y + 24} ${x} ${y}`;
    }
    menuPaths = paths;
  }

  function openMenu() {
    editing = false;
    phase = "menu";
    direction = null;
    announce("quick actions open");
    void routeMenu();
  }

  function startHold() {
    if (!canHold) return;
    clearHold();
    holdTimer = setTimeout(() => {
      holdTimer = undefined;
      direction = null;
      if (numeric) openMenu();
      else phase = "ready";
    }, holdDuration);
  }

  function onpointerdown(event: PointerEvent) {
    if (!event.isPrimary || event.button !== 0 || pointer) return;
    const index = indexOf(event);
    suppressClick = false;
    stopPreview();
    editing = false;
    if (menuOpen && index === active) return;
    cancelGesture();
    activate(index);
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    phase = "pressing";
    buttons[index].setPointerCapture(event.pointerId);
    startHold();
  }

  function onpointermove(event: PointerEvent) {
    if (!pointer || event.pointerId !== pointer.id) return;
    const x = event.clientX - pointer.x;
    const y = event.clientY - pointer.y;
    if (variant === "track" && !menuOpen) swipeTravel = Math.max(-1, Math.min(1, y / buttons[active].offsetHeight));
    if (Math.hypot(x, y) > 10) {
      pointer.moved = true;
      clearHold();
    }
    if (!numeric) {
      if (pointer.moved) phase = "idle";
      return;
    }
    const next = swipeDirection(x, y, menuOpen ? 30 : 22);
    direction = mode === "vertical" && !menuOpen && (next === "left" || next === "right") ? null : next;
  }

  function onpointerup(event: PointerEvent) {
    if (!pointer || event.pointerId !== pointer.id) return;
    const moved = pointer.moved;
    pointer = undefined;
    swipeTravel = 0;
    clearHold();
    if (menuOpen) {
      suppressClick = true;
      if (direction) selectMenu(direction);
      return;
    }
    if (phase === "ready") {
      suppressClick = true;
      togglePanels(true);
    } else if (direction) {
      suppressClick = true;
      changeValue(swipeDelta(direction), `Swipe ${direction}`);
    } else if (moved) {
      suppressClick = true;
      announce("gesture cancelled");
    }
    phase = "idle";
    direction = null;
  }

  function onpointercancel(event: PointerEvent) {
    if (pointer?.id !== event.pointerId) return;
    suppressClick = true;
    cancelGesture();
  }

  function onlostpointercapture() {
    if (pointer) {
      suppressClick = true;
      cancelGesture();
    }
  }

  function onclick(event: MouseEvent) {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    const index = indexOf(event);
    stopPreview();
    editing = false;
    if (menuOpen && index === active) {
      void editValue();
      return;
    }
    cancelGesture();
    activate(index);
    if (event.shiftKey && canHold) {
      if (numeric) openMenu();
      else togglePanels(true);
    } else if (numeric) changeValue(-1, "Tap");
    else togglePanels();
  }

  function selectMenu(selected: Direction) {
    cancelGesture();
    if (selected === "right") {
      void editValue();
      return;
    }
    if (selected === "left") {
      values[active] = initialValues[active];
      announce(`reset to ${values[active]}`);
    } else changeValue(selected === "up" ? 5 : -5, "Menu");
    buttons[active].focus();
  }

  async function editValue() {
    stopPreview();
    cancelGesture();
    draft = values[active];
    editing = true;
    await tick();
    input?.focus();
    input?.select();
  }

  function cancelEdit() {
    editing = false;
    buttons[active].focus();
  }

  function onsubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!Number.isFinite(draft)) return;
    values[active] = Math.max(0, Math.min(99, Math.round(draft)));
    editing = false;
    announce(`set to ${values[active]}`);
    buttons[active].focus();
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelGesture();
      cancelEdit();
      return;
    }
    if (!(event.currentTarget instanceof HTMLButtonElement) || !event.currentTarget.hasAttribute("data-index")) return;
    const index = indexOf(event);
    if (index !== active) cancelGesture();
    activate(index);
    if (event.repeat && (event.key === " " || event.key === "Enter")) {
      event.preventDefault();
      return;
    }
    if (event.key === "F2" && numeric) {
      event.preventDefault();
      void editValue();
      return;
    }
    if (event.key === "Enter" || event.key === " ") suppressClick = false;
    const selected = keyDirections[event.key];
    if (selected && numeric) {
      event.preventDefault();
      stopPreview();
      if (menuOpen) direction = selected;
      else if (mode !== "vertical" || selected === "up" || selected === "down") changeValue(swipeDelta(selected), `Arrow ${selected}`);
      return;
    }
    if (menuOpen && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      if (direction) selectMenu(direction);
      else void editValue();
      return;
    }
    if (event.key === " " && !event.repeat) {
      event.preventDefault();
      stopPreview();
      spaceDown = true;
      phase = "pressing";
      startHold();
    }
  }

  function onkeyup(event: KeyboardEvent) {
    if (event.key !== " " || !spaceDown) return;
    event.preventDefault();
    spaceDown = false;
    clearHold();
    if (phase === "ready") {
      togglePanels(true);
      phase = "idle";
    } else if (!menuOpen) {
      phase = "idle";
      if (numeric) changeValue(-1, "Tap");
      else togglePanels();
    }
  }

  function dismissMenu(event: PointerEvent) {
    if (menuOpen && event.target instanceof Node && !example.contains(event.target)) cancelGesture();
  }

  function dismissWithEscape(event: KeyboardEvent) {
    if (event.key !== "Escape" || (phase === "idle" && !editing)) return;
    cancelGesture();
    cancelEdit();
  }

  function oncontextmenu(event: MouseEvent) {
    if (!numeric && !canHold) return;
    event.preventDefault();
    if (event.button === 2 && numeric) {
      stopPreview();
      cancelGesture();
      activate(indexOf(event));
      openMenu();
      buttons[active].focus();
    }
  }

  async function showPreview() {
    cancelGesture();
    editing = false;
    stopPreview();
    if (variant === "courier") {
      const points = [0, 1, 2, 3, 4, 5, 1].map(courierPoint);
      courierPath =
        `M ${points[0].x} ${points[0].y}` +
        points
          .slice(1)
          .map((point, index) => {
            const from = points[index];
            return ` C ${from.x} ${from.y - 14} ${point.x} ${point.y - 14} ${point.x} ${point.y}`;
          })
          .join("");
      courierVersion += 1;
    }
    previewVersion += 1;
    preview = true;
    await routeMenu();
    previewTimer = setTimeout(() => (preview = false), 1800);
  }

  function onblur() {
    if (!pointer && !menuOpen) cancelGesture();
  }

  function syncPaths() {
    if (menuOpen || previewMenu) void routeMenu();
    if (variant === "courier" && courierPath) {
      const point = courierPoint(active);
      courierPath = `M ${point.x} ${point.y}`;
    }
  }

  function watchSize(element: HTMLDivElement) {
    const observer = new ResizeObserver(syncPaths);
    observer.observe(element);
    return () => observer.disconnect();
  }

  function rememberButton(element: HTMLButtonElement, index: number) {
    buttons[index] = element;
    return () => {
      if (buttons[index] === element) delete buttons[index];
    };
  }

  onDestroy(() => {
    clearHold();
    clearTimeout(previewTimer);
  });
</script>

<svelte:window onblur={cancelGesture} onkeydown={dismissWithEscape} />
<svelte:document onvisibilitychange={cancelGesture} onpointerdown={dismissMenu} />

{#snippet menuContent(item: Direction)}
  {#if item === "up" || item === "down"}<span>{menuLabels[item]}</span>
  {:else if item === "right"}<span class="small-icon i-material-symbols:edit-outline" aria-hidden="true"></span>
  {:else}<span class="small-icon i-material-symbols:restart-alt" aria-hidden="true"></span>{/if}
{/snippet}

<div
  class={["example", preview && "preview"]}
  bind:this={example}
  {@attach watchSize}
  data-variant={variant}
  data-size={size}
  data-phase={phase}
  style:--duration-hold={`${holdDuration}ms`}
>
  <div class="row-top"><span>{numeric ? "Survivor attributes" : "Dashboard shortcuts"}</span><span class="density">6 across</span></div>
  {#key previewVersion}
    <div class="fields">
      {#each labels as label, index (label)}
        <div class="field" data-phase={index === active ? phase : "idle"} data-direction={index === active ? direction : null}>
          <span class="field-label">{shortLabels[index]}</span>
          <div class="arena" style:--distance-loop={`${index === active ? loopDistance : 0}%`} style:--delay-preview={`${index * 100}ms`}>
            {#if numeric}
              <div class="rails" aria-hidden="true">
                <span class="rail up"><span class="tiny-icon i-material-symbols:keyboard-arrow-up"></span></span><span class="rail down"
                  ><span class="tiny-icon i-material-symbols:keyboard-arrow-down"></span></span
                >
              </div>
              <div class="compass" aria-hidden="true">
                <span class="cue up">+1</span><span class="cue down">−1</span><span class="cue left">−5</span><span class="cue right"
                  >+5</span
                >
              </div>
            {/if}
            <button
              class={["control", numeric && "numeric"]}
              {@attach (element) => rememberButton(element, index)}
              data-index={index}
              data-ready={!numeric && phase === "ready"}
              data-active={index === active && (menuOpen || editing)}
              aria-label={numeric
                ? `Decrease ${label}, current value ${values[index]}`
                : `${panels[index] ? "Collapse" : "Expand"} ${label} dashboard`}
              aria-describedby={`${id}-help`}
              aria-pressed={!numeric ? panels[index] : undefined}
              aria-expanded={numeric ? index === active && menuOpen : undefined}
              aria-controls={numeric && index === active && menuOpen ? `${id}-menu` : undefined}
              {onpointerdown}
              {onpointermove}
              {onpointerup}
              {onpointercancel}
              {onlostpointercapture}
              {onclick}
              {onkeydown}
              {onkeyup}
              {oncontextmenu}
              {onblur}
            >
              {#if numeric}<span class="value">{index === active ? previewValue : values[index]}</span>
              {:else}<span
                  class={[
                    "control-icon",
                    phase === "ready"
                      ? expanded
                        ? "i-material-symbols:unfold-less-double"
                        : "i-material-symbols:unfold-more-double"
                      : panels[index]
                        ? "i-material-symbols:unfold-less"
                        : "i-material-symbols:unfold-more",
                  ]}
                  aria-hidden="true"
                ></span>{/if}
              {#if variant === "corner"}<span class="corner" aria-hidden="true"
                  ><span class="tiny-icon i-material-symbols:more-horiz"></span></span
                >{/if}
              {#if variant === "grip"}<span class="grip" aria-hidden="true"></span>{/if}
              {#if variant === "fan"}<span class="fold" aria-hidden="true"></span>{/if}
              {#if canHold && variant !== "perimeter" && variant !== "track"}<svg class="progress" viewBox="0 0 100 100" aria-hidden="true"
                  ><circle class="track" cx="50" cy="50" r="46" pathLength="100" /><circle
                    class="fill"
                    cx="50"
                    cy="50"
                    r="46"
                    pathLength="100"
                  /></svg
                >{/if}
            </button>
            {#if variant === "perimeter"}<div class="path-stage" aria-hidden="true">
                <span class="comet"></span><span class="comet reverse"></span>
              </div>
            {:else if variant === "track"}<div class="loop-stage" aria-hidden="true">
                <svg class="loop" viewBox="0 0 44 76"
                  ><path d="M 42 38 C 48 20 36 6 22 6 C 8 6 -4 20 2 38 C -4 56 8 70 22 70 C 36 70 48 56 42 38" /></svg
                ><span class="bead"></span>
              </div>{/if}
            {#if preview && variant !== "courier"}<span class="demo-touch" aria-hidden="true"></span>{/if}
          </div>
        </div>
      {/each}
    </div>
  {/key}
  {#if variant === "courier" && courierPath}{#key courierVersion}<div class="courier" aria-hidden="true">
        <span class="spark" style:offset-path={`path("${courierPath}")`}></span><span
          class="spark tail"
          style:offset-path={`path("${courierPath}")`}
        ></span>
      </div>{/key}{/if}
  {#if editing}
    <form class="editor" {onsubmit}>
      <label class="menu-label" for={`${id}-value`}>Edit {labels[active]}</label>
      <input id={`${id}-value`} type="number" min="0" max="99" step="1" bind:this={input} bind:value={draft} {onkeydown} required />
      <button class="save" aria-label={`Save ${labels[active]} value`}
        ><span class="small-icon i-material-symbols:check" aria-hidden="true"></span></button
      >
      <button class="cancel" type="button" aria-label="Cancel editing" onclick={cancelEdit}
        ><span class="small-icon i-material-symbols:close" aria-hidden="true"></span></button
      >
    </form>
  {:else if menuOpen || previewMenu}
    <div
      class={["menu", pathMenu && "path-menu"]}
      bind:this={menu}
      id={menuOpen ? `${id}-menu` : undefined}
      data-routed={Object.keys(menuPaths).length === 4}
      data-preview={previewMenu}
      aria-hidden={previewMenu ? true : undefined}
      style:--size-choice={`${choiceWidth}px`}
    >
      <span class="menu-label">{labels[active]}<span class="menu-note">Quick actions</span></span>
      {#each directions as item (item)}<div class="slot" data-slot={item}>
          {#if menuOpen}<button
              class="choice"
              data-direction={item}
              data-selected={direction === item}
              aria-label={`${menuLabels[item]} ${labels[active]}`}
              onclick={() => selectMenu(item)}
              style:offset-path={menuPaths[item] ? `path("${menuPaths[item]}")` : undefined}>{@render menuContent(item)}</button
            >
          {:else}<span class="choice" style:offset-path={menuPaths[item] ? `path("${menuPaths[item]}")` : undefined}
              >{@render menuContent(item)}</span
            >{/if}
        </div>{/each}
    </div>
  {/if}
  <p class="result" aria-live="polite">{result}</p>
  <button class="preview-button" aria-label={`Preview ${name} gesture cues`} onclick={showPreview}
    ><span class="small-icon i-material-symbols:touch-app-outline" aria-hidden="true"></span></button
  >
  <p class="visually-hidden" id={`${id}-help`}>
    {#if !numeric}Tap or press Enter to toggle this dashboard. {#if canHold}Hold and release to toggle all six dashboards. Hold Space or
        Shift and click for the same action.{/if}
    {:else}Tap to decrease. Swipe up to increase and down to decrease. {#if mode !== "vertical"}Swipe left to decrease by five and right to
        increase by five.{/if} Arrow keys do the same. Press F2 for exact entry. {#if canHold}Hold to open quick actions, then slide up for
        plus five, down for minus five, right to edit, or left to reset. You can also release and tap an action.{/if} Right click opens quick
      actions. Escape cancels.{/if}
  </p>
</div>

<style>
  .example {
    --size-gesture: 2.875rem;
    --size-arena: 5.5rem;
    --size-icon-control: 1.375rem;
    --text-control: var(--text-lg);
    --radius-gesture: 0.5rem;
    --color-gesture: var(--accent);
    --duration-preview: 1800ms;
    position: relative;
    max-inline-size: 320px;
    margin-inline: auto;
    border: 1px solid var(--color-divider);
    border-radius: var(--radius-control);
    background: var(--background);
  }
  .row-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    block-size: 2.75rem;
    padding-inline: 0.375rem;
    font-size: var(--text-xs);
    color: var(--muted-foreground);
  }
  .density {
    font-variant-numeric: tabular-nums;
  }
  .fields {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 0.125rem;
  }
  .field-label {
    display: block;
    text-align: center;
    font-size: var(--text-xs);
    line-height: 1.4;
    color: var(--muted-foreground);
  }
  .arena {
    position: relative;
    display: grid;
    place-items: center;
    block-size: var(--size-arena);
  }
  .control {
    position: relative;
    display: grid;
    place-items: center;
    inline-size: min(var(--size-gesture), 100%);
    block-size: var(--size-gesture);
    border: 1px solid var(--border-control, var(--color-divider));
    border-radius: var(--radius-gesture);
    background: var(--background-control, var(--card));
    color: var(--foreground);
    touch-action: pan-y;
    -webkit-touch-callout: none;
    &:hover,
    &[data-active="true"] {
      border-color: var(--color-gesture);
    }
    &:active {
      background: color-mix(var(--color-gesture) 12%, var(--card));
    }
    &[data-ready="true"] {
      color: var(--color-gesture);
      border-color: var(--color-gesture);
    }
    &[aria-pressed="true"] {
      background: color-mix(var(--color-gesture) 15%, var(--card));
    }
    &.numeric {
      touch-action: none;
    }
  }
  .value {
    font-size: var(--text-control);
    font-weight: var(--font-bold);
    font-variant-numeric: tabular-nums;
  }
  .small-icon {
    --size-icon: 1.125rem;
  }
  .tiny-icon {
    --size-icon: 0.875rem;
  }
  .progress {
    position: absolute;
    inset: 0.0625rem;
    inline-size: calc(100% - 0.125rem);
    block-size: calc(100% - 0.125rem);
    pointer-events: none;
    rotate: -90deg;
    opacity: var(--opacity-progress, 0);
  }
  .track,
  .fill {
    fill: none;
    stroke-width: 2;
  }
  .track {
    stroke: var(--color-divider);
    stroke-dasharray: var(--dash-progress, none);
  }
  .fill {
    stroke: var(--color-gesture);
    stroke-dasharray: 100;
    stroke-dashoffset: 100;
    stroke-linecap: round;
  }
  .field:is([data-phase="pressing"], [data-phase="ready"], [data-phase="menu"]) .progress {
    opacity: 1;
  }
  .field:is([data-phase="ready"], [data-phase="menu"]) .fill {
    stroke-dashoffset: 0;
  }
  .corner {
    position: absolute;
    inset-block-end: -0.25rem;
    inset-inline-end: -0.25rem;
    display: grid;
    place-items: center;
    inline-size: 1.125rem;
    block-size: 1.125rem;
    border: 2px solid var(--background);
    border-radius: 50%;
    background: var(--color-gesture);
    color: var(--contrast);
  }
  .grip {
    position: absolute;
    inset-block-start: 0.375rem;
    inline-size: 0.875rem;
    block-size: 0.25rem;
    border-block: 1px solid var(--muted-foreground);
  }
  .fold {
    position: absolute;
    inset-block-start: 0.375rem;
    inline-size: 0.75rem;
    block-size: 0.375rem;
    border-block-start: 1px solid var(--color-gesture);
    border-inline: 1px solid var(--color-gesture);
    border-radius: 50% 50% 0 0;
  }
  .rails,
  .compass {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .rail,
  .cue {
    position: absolute;
    display: grid;
    place-items: center;
    inline-size: 1.25rem;
    block-size: 0.875rem;
    color: var(--muted-foreground);
  }
  .rail {
    opacity: var(--opacity-rail, 0);
  }
  .cue {
    font-size: var(--text-xs);
    opacity: var(--opacity-cue, 0);
  }
  .up,
  .down {
    inset-inline-start: calc(50% - 0.625rem);
  }
  .up {
    inset-block-start: 0.125rem;
  }
  .down {
    inset-block-end: 0.125rem;
  }
  .left,
  .right {
    inset-block-start: calc(50% + 0.75rem);
    inline-size: 1rem;
  }
  .left {
    inset-inline-end: calc(50% + 0.25rem);
  }
  .right {
    inset-inline-start: calc(50% + 0.25rem);
  }
  .field[data-phase="pressing"] .cue,
  .preview .cue {
    opacity: var(--opacity-cue-press, var(--opacity-cue, 0));
  }
  .field[data-direction="up"] .up,
  .field[data-direction="down"] .down,
  .field[data-direction="left"] .left,
  .field[data-direction="right"] .right {
    opacity: 1;
    color: var(--color-gesture);
  }
  .field[data-phase="menu"] :is(.rails, .compass, .loop-stage) {
    visibility: hidden;
  }
  .path-stage {
    position: absolute;
    inline-size: min(var(--size-gesture), 100%);
    block-size: var(--size-gesture);
    border: 1px solid var(--color-divider);
    border-radius: var(--radius-gesture);
    pointer-events: none;
  }
  .comet,
  .bead,
  .spark {
    position: absolute;
    inset-block-start: 0;
    inset-inline-start: 0;
    inline-size: 0.375rem;
    block-size: 0.375rem;
    border-radius: 50%;
    background: var(--color-gesture);
    offset-anchor: 50% 50%;
    offset-rotate: 0deg;
  }
  .comet {
    offset-path: inset(3px round var(--radius-gesture));
    offset-distance: 0%;
    &.reverse {
      offset-distance: 50%;
      background: var(--foreground);
      opacity: 0.7;
    }
  }
  .example[data-phase="ready"] .path-stage {
    border-color: var(--color-gesture);
  }
  .loop-stage {
    position: absolute;
    inline-size: 44px;
    block-size: 76px;
    pointer-events: none;
  }
  .loop {
    inline-size: 44px;
    block-size: 76px;
    fill: none;
    stroke: var(--color-divider);
    stroke-width: 1;
  }
  .bead {
    offset-path: path("M 42 38 C 48 20 36 6 22 6 C 8 6 -4 20 2 38 C -4 56 8 70 22 70 C 36 70 48 56 42 38");
    offset-distance: var(--distance-loop);
  }
  .courier {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .spark {
    offset-distance: 100%;
    box-shadow: 0 0 0.5rem color-mix(var(--color-gesture) 50%, transparent);
    &.tail {
      inline-size: 0.25rem;
      block-size: 0.25rem;
      opacity: 0.35;
    }
  }
  .menu,
  .editor {
    position: absolute;
    inset-block-start: 0.25rem;
    inset-inline: 0.375rem;
    z-index: 1;
    display: grid;
    gap: 0.125rem 0.25rem;
    padding: 0.25rem;
    border: 1px solid var(--color-gesture);
    border-radius: var(--radius-control);
    background: var(--panel);
  }
  .menu {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .menu-label {
    grid-column: 1 / -1;
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    font-size: var(--text-xs);
    line-height: 1.4;
    color: var(--foreground);
  }
  .menu-note {
    color: var(--muted-foreground);
  }
  .slot {
    display: grid;
    min-block-size: 2.75rem;
  }
  .choice,
  .save,
  .cancel {
    display: grid;
    place-items: center;
    min-block-size: 2.75rem;
    border: 1px solid var(--color-divider);
    border-radius: var(--radius-control);
    background: var(--card);
    color: var(--foreground);
    font-size: var(--text-sm);
    &:hover,
    &[data-selected="true"] {
      border-color: var(--color-gesture);
      background: color-mix(var(--color-gesture) 15%, var(--card));
    }
  }
  .menu[data-preview="true"] {
    pointer-events: none;
  }
  @supports (offset-path: path("M 0 0 L 0 1")) {
    .path-menu[data-routed="false"] .choice {
      visibility: hidden;
    }
    .path-menu[data-routed="true"] .choice {
      position: absolute;
      inset-block-start: 0;
      inset-inline-start: 0;
      inline-size: var(--size-choice);
      block-size: 2.75rem;
      offset-position: auto;
      offset-anchor: 50% 50%;
      offset-rotate: 0deg;
      offset-distance: 100%;
    }
  }
  .editor {
    grid-template-columns: 1fr 2.75rem 2.75rem;
  }
  input {
    min-inline-size: 0;
    min-block-size: 2.75rem;
    padding-inline: 0.5rem;
    border: 1px solid var(--color-divider);
    border-radius: var(--radius-control);
    background: var(--card);
    font-size: var(--text-lg);
    text-align: center;
  }
  .save {
    border-color: var(--color-gesture);
  }
  .result {
    display: grid;
    align-items: center;
    min-block-size: 2.75rem;
    padding-inline: 0.375rem 2.75rem;
    font-size: var(--text-xs);
    line-height: 1.4;
    color: var(--muted-foreground);
  }
  .preview-button {
    position: absolute;
    inset-block-end: 0;
    inset-inline-end: 0;
    display: grid;
    place-items: center;
    inline-size: 2.75rem;
    block-size: 2.75rem;
    border-radius: var(--radius-control);
    color: var(--muted-foreground);
    &:hover {
      color: var(--foreground);
      background: var(--card);
    }
  }
  .demo-touch {
    position: absolute;
    inline-size: 0.625rem;
    block-size: 0.625rem;
    border: 1px solid var(--foreground);
    border-radius: 50%;
    background: color-mix(var(--foreground) 25%, transparent);
    pointer-events: none;
  }
  .example[data-variant="plain"] {
    --color-gesture: var(--foreground);
    --radius-gesture: 0.5rem;
  }
  .example[data-size="compact"] {
    --size-gesture: 2.75rem;
    --size-arena: 5rem;
    --size-icon-control: 1.125rem;
    --text-control: calc(var(--text-lg) - 0.125rem);
  }
  .example[data-size="comfy"] {
    --size-gesture: 3rem;
    --size-arena: 6rem;
    --size-icon-control: 1.5rem;
    --text-control: calc(var(--text-lg) + 0.125rem);
  }
  .example[data-variant="halo"] {
    --radius-gesture: 50%;
    --opacity-progress: 1;
    --dash-progress: 2 7;
  }
  .example[data-variant="corner"] {
    --color-gesture: var(--accent-purple);
  }
  .example[data-variant="rails"] {
    --color-gesture: var(--accent-green);
    --opacity-rail: 0.65;
  }
  .example[data-variant="compass"] {
    --opacity-cue: 0.65;
  }
  .example[data-variant="orbit"] {
    --color-gesture: var(--secondary);
    --radius-gesture: 50%;
    --opacity-progress: 1;
  }
  .example[data-variant="grip"] {
    --color-gesture: var(--accent-purple);
    --opacity-rail: 0.4;
  }
  .example[data-variant="reveal"] {
    --color-gesture: var(--accent-green);
    --background-control: color-mix(var(--color-gesture) 10%, var(--panel));
    --border-control: color-mix(var(--color-gesture) 35%, var(--card));
    --opacity-cue-press: 1;
  }
  .example[data-variant="perimeter"] {
    --radius-gesture: 0.625rem;
  }
  .example[data-variant="track"] {
    --color-gesture: var(--accent-green);
    --radius-gesture: 50%;
  }
  .example[data-variant="fan"] {
    --color-gesture: var(--accent-purple);
  }
  .example[data-variant="courier"] {
    --color-gesture: var(--secondary);
    --radius-gesture: 0.5rem;
  }
  @keyframes hold-fill {
    to {
      stroke-dashoffset: 0;
    }
  }
  @keyframes comet-lap {
    from {
      offset-distance: 0%;
    }
    to {
      offset-distance: 100%;
    }
  }
  @keyframes reverse-lap {
    from {
      offset-distance: 50%;
    }
    to {
      offset-distance: -50%;
    }
  }
  @keyframes loop-preview {
    0%,
    10%,
    100% {
      offset-distance: 0%;
    }
    40% {
      offset-distance: 25%;
    }
    75% {
      offset-distance: -25%;
    }
  }
  @keyframes lift-actions {
    from {
      offset-distance: 0%;
      opacity: 0;
    }
    to {
      offset-distance: 100%;
      opacity: 1;
    }
  }
  @keyframes lift-preview {
    0%,
    30% {
      offset-distance: 0%;
      opacity: 0;
    }
    65%,
    85% {
      offset-distance: 100%;
      opacity: 1;
    }
    100% {
      offset-distance: 100%;
      opacity: 0;
    }
  }
  @keyframes pass-spark {
    from {
      offset-distance: 0%;
    }
    to {
      offset-distance: 100%;
    }
  }
  @keyframes demo-tap {
    0%,
    100% {
      opacity: 0;
      scale: 1.5;
    }
    20%,
    70% {
      opacity: 1;
      scale: 1;
    }
  }
  @keyframes demo-swipe {
    0%,
    100% {
      opacity: 0;
      translate: 0 0.75rem;
    }
    20% {
      opacity: 1;
      translate: 0 0.75rem;
    }
    65%,
    85% {
      opacity: 1;
      translate: 0 -2rem;
    }
  }
  @media (prefers-reduced-motion: no-preference) {
    .field[data-phase="pressing"] .fill {
      animation: hold-fill var(--duration-hold) linear forwards;
    }
    .field[data-phase="pressing"] .comet {
      animation: comet-lap var(--duration-hold) linear forwards;
      &.reverse {
        animation-name: reverse-lap;
      }
    }
    .preview .comet {
      animation: comet-lap 1100ms var(--delay-preview) ease-in-out both;
      &.reverse {
        animation-name: reverse-lap;
      }
    }
    .preview .bead {
      animation: loop-preview var(--duration-preview) ease-in-out;
    }
    .preview .fill {
      animation: hold-fill 1100ms var(--delay-preview) ease-in-out both;
    }
    .spark {
      animation: pass-spark 260ms ease-in-out both;
      &.tail {
        animation-delay: 70ms;
      }
    }
    .preview .spark {
      animation-duration: 1500ms;
    }
    @supports (offset-path: path("M 0 0 L 0 1")) {
      .path-menu[data-routed="true"] .choice {
        animation: lift-actions 320ms ease-out both;
      }
      .path-menu[data-preview="true"] .choice {
        animation: lift-preview var(--duration-preview) ease-in-out both;
      }
    }
    .preview .demo-touch {
      animation: demo-tap var(--duration-preview) var(--delay-preview) ease-in-out both;
    }
    .example:has(.numeric) .demo-touch {
      animation-name: demo-swipe;
    }
    .control,
    .choice {
      transition:
        background var(--duration-fast),
        border-color var(--duration-fast),
        color var(--duration-fast);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .field[data-phase="pressing"] .fill {
      stroke-dashoffset: 50;
    }
    .demo-touch {
      display: none;
    }
  }
</style>
