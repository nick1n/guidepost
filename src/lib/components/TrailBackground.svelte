<script module lang="ts">
  type Point = { x: number; y: number };
  type Trail = { id: number; d: string; marker: string };

  const maxTrails = 7;

  function curve(points: Point[], closed = false) {
    const at = (index: number) =>
      points[closed ? (index + points.length) % points.length : Math.max(0, Math.min(points.length - 1, index))];
    let d = `M${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - (closed ? 0 : 1); i++) {
      const previous = at(i - 1);
      const start = at(i);
      const end = at(i + 1);
      const next = at(i + 2);
      d += ` C${start.x + (end.x - previous.x) / 6},${start.y + (end.y - previous.y) / 6}`;
      d += ` ${end.x - (next.x - start.x) / 6},${end.y - (next.y - start.y) / 6} ${end.x},${end.y}`;
    }
    return closed ? `${d}Z` : d;
  }

  function createTerrain(random = Math.random) {
    // Separate regions keep randomized contours apart and the mountain circuit on screen.
    const mountain = { x: 480 + random() * 440, y: 400 + random() * 100, width: 180, height: 145, phase: 2.1, levels: 6 };
    const contours = [
      { x: 200 + random() * 900, y: 10 + random() * 20, width: 430, height: 150, phase: 0.4, levels: 3 },
      mountain,
      { x: 250 + random() * 900, y: 960 + random() * 60, width: 480, height: 130, phase: 4.2, levels: 3 },
      { x: 1350 + random() * 90, y: 340 + random() * 300, width: 100, height: 450, phase: 1.3, levels: 4 },
      { x: 120 + random() * 35, y: 420 + random() * 180, width: 75, height: 95, phase: 3.4, levels: 4 },
    ].flatMap((hill) => {
      const gaps = Array.from({ length: hill.levels - 1 }, () => 0.4 + random() * 1.6);
      const totalGap = gaps.reduce((sum, gap) => sum + gap, 0);
      const depthRange = hill.levels === 6 ? 0.8 : (hill.levels - 1) * 0.18;
      const phase = hill.phase + random() * Math.PI * 2;
      const slopePhase = random() * Math.PI * 2;
      const relief = 0.08 + random() * 0.08;
      const detail = 0.03 + random() * 0.03;
      let depth = 0;

      return Array.from({ length: hill.levels }, (_, level) => {
        if (level > 0) depth += (gaps[level - 1] / totalGap) * depthRange;
        const points = Array.from({ length: 32 }, (_, i) => {
          const angle = (i / 32) * Math.PI * 2;
          // Shared waves preserve nesting while gaps widen and tighten around each slope.
          const radius = 1 + relief * Math.sin(angle * 3 + phase) + detail * Math.cos(angle * 5 - phase);
          const slope = 0.9 + 0.18 * Math.sin(angle + slopePhase) + 0.04 * Math.cos(angle * 2 + phase);
          const scale = 1 - depth * slope;
          return {
            x: hill.x + Math.cos(angle) * hill.width * radius * scale,
            y: hill.y + Math.sin(angle) * hill.height * radius * scale,
          };
        });
        return curve(points, true);
      });
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
      marker: `${circuit[12].x},${circuit[12].y}`,
    };
    return { contours, openingTrail };
  }
</script>

<script lang="ts">
  import { onMount } from "svelte";
  import { draw, fade } from "svelte/transition";

  const maskId = $props.id();
  // A deterministic first render keeps SSR and hydration aligned until client initialization.
  let terrain = $state.raw(createTerrain(() => 0.5));
  let trails = $state.raw<Trail[]>([]);
  let reducedMotion = $state(false);
  let nextId = $state(0);

  function drawTrail(node: SVGGElement, { duration, marker }: { duration: number; marker: string }) {
    const path = node.querySelector("mask path") as SVGPathElement;
    const prefix = path.cloneNode() as SVGPathElement;
    const d = path.getAttribute("d")!;
    const markerStart = d.indexOf(` ${marker} C`);
    prefix.setAttribute("d", markerStart === -1 ? d : d.slice(0, markerStart + marker.length + 1));
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
    const point = (along: number, across: number) =>
      vertical ? `${across},${reverse ? length - along : along}` : `${reverse ? length - along : along},${across}`;
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

  onMount(() => {
    terrain = createTerrain();
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setTimeout> | undefined;

    function syncMotion() {
      clearTimeout(timer);
      reducedMotion = motion.matches;
      trails = [
        { id: ++nextId, ...terrain.openingTrail },
        ...Array.from({ length: reducedMotion ? maxTrails - 1 : 0 }, () => createTrail(++nextId)),
      ];
      if (!reducedMotion) {
        timer = setTimeout(function addTrail() {
          if (!document.hidden) trails = [...trails.slice(1 - maxTrails), createTrail(++nextId)];
          timer = setTimeout(addTrail, 14000);
        }, 22000);
      }
    }

    syncMotion();
    motion.addEventListener("change", syncMotion);
    return () => {
      clearTimeout(timer);
      motion.removeEventListener("change", syncMotion);
    };
  });
</script>

<svg viewBox="0 0 1600 1000" preserveAspectRatio="none" aria-hidden="true" focusable="false">
  {#each terrain.contours as d (d)}
    <path {d} />
  {/each}
  {#each trails as trail (trail.id)}
    {@const trailMask = `${maskId}-${trail.id}`}
    <g in:drawTrail={{ duration: reducedMotion ? 0 : 22000, marker: trail.marker }} out:fade={{ duration: reducedMotion ? 0 : 4000 }}>
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

<style>
  svg {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    opacity: 0.1;
    mix-blend-mode: color-dodge;
    fill: none;
    stroke: var(--color-trail);
    stroke-width: 1.5;
    stroke-linecap: round;
  }

  .marker {
    opacity: var(--opacity-marker, 1);
    fill: var(--background);
    stroke-width: 1;
  }

  .reveal {
    stroke: white;
  }
</style>
