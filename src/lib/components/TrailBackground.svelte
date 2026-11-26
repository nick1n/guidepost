<script module lang="ts">
  import { clamp } from "#lib/helpers.ts";
  import { draw } from "svelte/transition";

  type Point = { x: number; y: number };
  type Trail = { id: number; d: string; marker: string };

  const maxTrails = 7;

  function coordinates(x: number, y: number) {
    return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`;
  }

  function curve(points: Point[]) {
    const at = (index: number) => points[clamp(0, index, points.length - 1)];
    let d = `M${coordinates(points[0].x, points[0].y)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const previous = at(i - 1);
      const start = at(i);
      const end = at(i + 1);
      const next = at(i + 2);
      d += ` C${coordinates(start.x + (end.x - previous.x) / 6, start.y + (end.y - previous.y) / 6)}`;
      d += ` ${coordinates(end.x - (next.x - start.x) / 6, end.y - (next.y - start.y) / 6)} ${coordinates(end.x, end.y)}`;
    }
    return d;
  }

  function createContours(elevation: (x: number, y: number) => number) {
    const columns = 84;
    const rows = 54;
    const stride = columns + 1;
    const interval = 0.065;
    const contours = Array.from({ length: 23 }, (_, i) => ({ d: "", index: (i + 1) % 5 === 0 }));
    const samples = Array.from({ length: stride * (rows + 1) }, (_, i) => {
      const x = (i % stride) * 20 - 40;
      const y = Math.floor(i / stride) * 20 - 40;
      return { x, y, height: elevation(x, y) };
    });

    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const i = row * stride + column;
        const [a, b, c, d] = [samples[i], samples[i + 1], samples[i + stride + 1], samples[i + stride]];
        // Triangles give each elevation an unambiguous crossing, including at saddles.
        // Separate segments share endpoints, so no sorting or curve stitching is needed.
        for (const triangle of [
          [a, b, c],
          [a, c, d],
        ]) {
          const heights = triangle.map((point) => point.height);
          const first = Math.max(1, Math.floor(Math.min(...heights) / interval) + 1);
          const last = Math.min(contours.length, Math.floor(Math.max(...heights) / interval));
          for (let level = first; level <= last; level++) {
            const height = level * interval;
            const crossings = triangle.flatMap((start, edge) => {
              const end = triangle[(edge + 1) % 3];
              if (start.height > height === end.height > height) return [];
              const t = (height - start.height) / (end.height - start.height);
              return [coordinates(start.x + (end.x - start.x) * t, start.y + (end.y - start.y) * t)];
            });
            contours[level - 1].d += "M" + crossings.join("L");
          }
        }
      }
    }
    return contours.filter((contour) => contour.d);
  }

  function createTerrain(random = Math.random) {
    const mountain = { x: 480 + random() * 440, y: 400 + random() * 100, width: 180, height: 145 };
    const hills = [
      { ...mountain, rise: 1.3 },
      { x: 160, y: 120, width: 340, height: 220, rise: 1.1 },
      { x: 1100, y: 40, width: 420, height: 180, rise: 1.2 },
      { x: 1380, y: 670, width: 260, height: 390, rise: 1.4 },
      { x: 670, y: 1030, width: 460, height: 240, rise: 1.2 },
      { x: 80, y: 700, width: 190, height: 300, rise: 0.9 },
    ];
    const phase = random() * Math.PI * 2;
    const contours = createContours((x, y) => {
      // Broad bends and finer relief warp every elevation together, preserving natural nesting.
      const warpedX = x + 55 * Math.sin(y / 170 + phase) + 22 * Math.sin((x + y) / 45);
      const warpedY = y + 45 * Math.sin(x / 210 - phase) + 18 * Math.cos((x - y) / 38);
      return hills.reduce((height, hill) => {
        const dx = (warpedX - hill.x) / hill.width;
        const dy = (warpedY - hill.y) / hill.height;
        return height + hill.rise * Math.exp(-(dx * dx + dy * dy));
      }, 0);
    });

    // An expanding loop leaves room between the approach and departure paths.
    const circuit = Array.from({ length: 25 }, (_, i) => {
      const progress = i / 24;
      const angle = Math.PI / 2 - progress * Math.PI * 2;
      return {
        x: mountain.x + Math.cos(angle) * (mountain.width + 65 + progress * 70),
        y: mountain.y + Math.sin(angle) * (mountain.height + 65 + progress * 70),
      };
    });
    const openingTrail = {
      d: curve([
        { x: -80, y: mountain.y + 130 },
        { x: mountain.x - 400, y: mountain.y + 170 },
        ...circuit,
        { x: mountain.x + 450, y: mountain.y + 270 },
        { x: 1680, y: mountain.y + 150 },
      ]),
      marker: coordinates(circuit[12].x, circuit[12].y),
    };
    return { contours, openingTrail };
  }

  function drawTrail(node: SVGGElement, { duration, marker }: { duration: number; marker: string }) {
    const path = node.querySelector("mask path") as SVGPathElement;
    const prefix = path.cloneNode() as SVGPathElement;
    const d = path.getAttribute("d")!;
    const markerIndex = d.indexOf(`${marker} C`);
    prefix.setAttribute("d", markerIndex < 0 ? d : d.slice(0, markerIndex + marker.length));
    const markerAt = prefix.getTotalLength() / path.getTotalLength();
    const transition = draw(path, { duration });

    // The mask inherits draw's dashes; the marker shares its clock without being clipped by the narrow mask.
    return {
      ...transition,
      css(t: number, u: number) {
        return `${transition.css!(t, u)} --opacity-marker: ${t >= markerAt ? 1 : 0};`;
      },
    };
  }

  function createTrail(id: number): Trail {
    const vertical = Math.random() < 0.1;
    const length = vertical ? 1000 : 1600;
    const breadth = vertical ? 1600 : 1000;
    const reverse = Math.random() < 0.5;
    const point = (along: number, across: number) => {
      const position = reverse ? length - along : along;
      return vertical ? coordinates(across, position) : coordinates(position, across);
    };
    const center = breadth * (0.15 + Math.random() * 0.7);
    const phase = Math.random() * Math.PI * 2;
    const points = Array.from({ length: 11 }, (_, i) => ({
      along: -80 + (i * (length + 160)) / 10,
      across: center + Math.sin(i * 0.7 + phase) * breadth * 0.12 + (Math.random() - 0.5) * 65,
    }));
    let d = `M${point(points[0].along, points[0].across)}`;

    // Shared tangents keep the route flowing through each bend like a map contour.
    for (let i = 0; i < points.length - 1; i++) {
      const previous = points[Math.max(0, i - 1)];
      const start = points[i];
      const end = points[i + 1];
      const next = points[Math.min(points.length - 1, i + 2)];
      d += ` C${point(start.along + (end.along - previous.along) / 6, start.across + (end.across - previous.across) / 6)}`;
      d += ` ${point(end.along - (next.along - start.along) / 6, end.across - (next.across - start.across) / 6)}`;
      d += ` ${point(end.along, end.across)}`;
    }

    const midpoint = points[Math.floor(points.length / 2)];
    return { id, d, marker: point(midpoint.along, midpoint.across) };
  }
</script>

<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { prefersReducedMotion } from "svelte/motion";
  import { fade } from "svelte/transition";

  const maskId = $props.id();
  let terrain = $state.raw<ReturnType<typeof createTerrain>>();
  let contours = $derived(terrain?.contours ?? []);
  let trails = $state.raw<Trail[]>([]);
  let nextId = $state(0);

  onMount(() => {
    terrain = createTerrain();
  });

  // Restart the external timer when the system motion preference changes.
  $effect(() => {
    const currentTerrain = terrain;
    const reducedMotion = prefersReducedMotion.current;
    if (!currentTerrain) return;

    return untrack(() => {
      let timer: Timeout;
      trails = [
        { id: ++nextId, ...currentTerrain.openingTrail },
        ...Array.from({ length: reducedMotion ? maxTrails - 1 : 0 }, () => createTrail(++nextId)),
      ];
      if (!reducedMotion) {
        timer = setTimeout(function addTrail() {
          if (!document.hidden) trails = [...trails.slice(1 - maxTrails), createTrail(++nextId)];
          timer = setTimeout(addTrail, 14000);
        }, 22000);
      }
      return () => clearTimeout(timer);
    });
  });
</script>

{#if contours.length}
  <svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    {#each contours as contour (contour.d)}
      <path d={contour.d} class={["contour", contour.index && "index-contour"]} />
    {/each}
    {#each trails as trail (trail.id)}
      {@const trailMask = `${maskId}-${trail.id}`}
      <g
        in:drawTrail={{ duration: prefersReducedMotion.current ? 0 : 22000, marker: trail.marker }}
        out:fade={{ duration: prefersReducedMotion.current ? 0 : 4000 }}
      >
        <defs>
          <mask id={trailMask} maskUnits="userSpaceOnUse" x="-100" y="-100" width="1800" height="1200">
            <path class="reveal" d={trail.d} />
          </mask>
        </defs>
        <path d={trail.d} stroke-dasharray="5 12" stroke-dashoffset="0" mask={`url(#${trailMask})`} />
        <circle class="marker" transform={`translate(${trail.marker})`} r="3" stroke-dasharray="none" />
      </g>
    {/each}
  </svg>
{/if}

<style>
  svg {
    --color-trail: #8a6038;

    position: absolute;
    inline-size: 100%;
    block-size: 100%;
    inset: 0;
    fill: none;
    stroke: var(--color-trail);
    stroke-linecap: round;
    stroke-width: 1.5;
    mix-blend-mode: color-dodge;
    opacity: 0.1;
  }

  .contour {
    opacity: 0.5;
  }

  g {
    stroke-width: 3.5;
  }

  .marker {
    fill: var(--background);
    stroke-width: 1;
    opacity: var(--opacity-marker, 1);
  }

  .index-contour {
    stroke-width: 2.5;
  }

  .reveal {
    stroke: white;
  }

  @media (prefers-reduced-motion: no-preference) {
    svg {
      transition: opacity var(--duration-slower) var(--ease-standard);
    }

    @starting-style {
      svg {
        opacity: 0;
      }
    }
  }
</style>
