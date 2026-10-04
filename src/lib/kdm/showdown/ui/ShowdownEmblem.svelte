<script lang="ts">
  let { variant, awakening = 0 }: { variant: number; awakening?: number } = $props();
</script>

<div class="emblem" aria-hidden="true">
  {#key awakening}
    <svg class={[awakening > 0 && "awakening"]} viewBox="0 0 120 120" fill="none" focusable="false">
      {#if variant === 2}
        <!-- A small light held inside a much larger maw. -->
        <path class="faint" d="M22 94V52a38 38 0 0 1 76 0v42M16 99h88M27 104h66" />
        <path class="maw" d="M30 86V52a30 30 0 0 1 60 0v34M30 53l10 9-8-22 15 12-5-22 14 16 4-24 5 24 14-16-6 22 15-12-8 22 10-9" />
        <path class="jaw" d="m31 86 11-12-3 19 14-12 7 17 7-17 14 12-3-19 11 12" />
        <path d="M49 59h22l-3 22H52ZM47 84h26M50 55l10-7 10 7M60 48v-5" />
        <path class="solid flame" d="M60 76c-12-7 0-12 1-19 1 8 9 13-1 19Z" />
        <path class="faint" d="M42 66h-5m46 0h-5M45 39l-3-5m33 5 3-5" />
      {:else if variant === 3}
        <!-- The eye awakens only when the parent starts a new round. -->
        <path class="faint" d="M16 41V24h18m52 0h18v17M16 76v17h18m52 0h18V76M9 59h12m78 0h12" />
        <path class="solid" d="m60 16 9 22 22-9-9 22 22 9-22 9 9 22-22-9-9 22-9-22-22 9 9-22-22-9 22-9-9-22 22 9Z" />
        <g class="eye">
          <path class="cutout" d="M35 60q25-28 50 0-25 28-50 0Z" />
          <path class="solid pupil" d="m60 45 6 15-6 15-6-15Z" />
        </g>
      {:else}
        <!-- A broken blade inside an interrupted ring of teeth. -->
        <path class="faint ring" d="M45 16a46 46 0 0 0-25 67m9 12a46 46 0 0 0 62-1m10-14a46 46 0 0 0-26-64" />
        <path class="teeth" d="m29 34 8 15-15-5 12 16-14 3 15 9-10 10 17-1m49-47-8 15 15-5-12 16 14 3-15 9 10 10-17-1" />
        <path class="solid blade" d="m60 13 9 31-13 8 10 7-6 15-9-18 9-9-8-4ZM43 78l17 5 17-5-3 8-11 3v13l-3 6-3-6V89l-11-3Z" />
        <path class="faint" d="m45 58-5-9m34 10 6-7M38 97l4 5m8-1 2 6m16 0 2-6m8 1 4-5" />
      {/if}
    </svg>
  {/key}
</div>

<style>
  .emblem {
    --duration-awakening: 2400ms;
    inline-size: 12rem;
    block-size: 12rem;
    margin: -2rem auto -1.5rem;
    color: var(--identity);
  }
  svg {
    inline-size: 100%;
    block-size: 100%;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .solid {
    fill: currentColor;
    stroke: none;
  }
  .faint {
    opacity: 0.4;
  }
  .cutout {
    fill: var(--panel);
    stroke: none;
  }

  .awakening {
    animation: blood-awakening var(--duration-awakening) ease-out;
  }

  @keyframes blood-awakening {
    0%,
    100% {
      color: var(--identity);
    }
    18% {
      color: var(--background);
    }
    36%,
    65% {
      color: var(--accent-red);
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    .awakening {
      animation-name: blood-awakening, looming;
    }
    .awakening .eye {
      transform-origin: 60px 60px;
      animation: eye-opening var(--duration-awakening) ease-out;
    }
    .awakening .pupil {
      transform-origin: 60px 60px;
      animation: dilating var(--duration-awakening) ease-out;
    }
    .awakening :is(.maw, .jaw, .flame, .ring, .teeth, .blade) {
      transform-origin: 60px 60px;
      animation-duration: var(--duration-awakening);
      animation-timing-function: ease-out;
    }
    .awakening .maw {
      animation-name: maw-closing;
    }
    .awakening .jaw {
      animation-name: jaw-closing;
    }
    .awakening .flame {
      transform-origin: 60px 76px;
      animation-name: flame-dying;
    }
    .awakening .ring {
      animation-name: ring-turning;
    }
    .awakening .teeth {
      animation-name: teeth-clenching;
    }
    .awakening .blade {
      animation-name: blade-shuddering;
    }
  }

  @keyframes maw-closing {
    0%,
    100% {
      transform: translateY(0);
    }
    18% {
      transform: translateY(-3px);
    }
    36%,
    65% {
      transform: translateY(9px);
    }
  }

  @keyframes jaw-closing {
    0%,
    100% {
      transform: translateY(0);
    }
    18% {
      transform: translateY(3px);
    }
    36%,
    65% {
      transform: translateY(-10px);
    }
  }

  @keyframes flame-dying {
    0%,
    100% {
      transform: scale(1);
      opacity: 1;
    }
    18% {
      transform: scale(0.8, 1.2) skewX(-10deg);
      opacity: 0.7;
    }
    36%,
    65% {
      transform: scale(0.35, 0.15);
      opacity: 0.15;
    }
    82% {
      transform: scale(0.7, 1.25) skewX(8deg);
      opacity: 0.8;
    }
  }

  @keyframes ring-turning {
    0%,
    100% {
      transform: rotate(0);
    }
    18% {
      transform: rotate(-12deg);
    }
    36%,
    65% {
      transform: rotate(22deg);
    }
  }

  @keyframes teeth-clenching {
    0%,
    100% {
      transform: scaleX(1);
    }
    18% {
      transform: scaleX(1.1);
    }
    36%,
    65% {
      transform: scaleX(0.72);
    }
  }

  @keyframes blade-shuddering {
    0%,
    100% {
      transform: translateY(0) rotate(0);
    }
    18% {
      transform: translateY(4px) rotate(-4deg);
    }
    36% {
      transform: translateY(-4px) rotate(5deg);
    }
    44% {
      transform: translateY(-3px) rotate(-3deg);
    }
    54% {
      transform: translateY(-2px) rotate(2deg);
    }
    65% {
      transform: translateY(-2px) rotate(0);
    }
  }

  @keyframes looming {
    0%,
    100% {
      transform: scale(1);
      filter: drop-shadow(0 0 0 transparent);
    }
    18% {
      transform: scale(0.92) rotate(-3deg);
    }
    36% {
      transform: scale(1.12) rotate(2deg);
      filter: drop-shadow(0 0 9px var(--accent-red));
    }
    65% {
      transform: scale(1.04);
      filter: drop-shadow(0 0 3px var(--accent-red));
    }
  }

  @keyframes eye-opening {
    0%,
    100% {
      transform: scaleY(1);
    }
    18% {
      transform: scaleY(0.04);
    }
    36% {
      transform: scaleY(1.45);
    }
    65% {
      transform: scaleY(1.15);
    }
  }

  @keyframes dilating {
    0%,
    100% {
      transform: scaleX(1);
    }
    36% {
      transform: scaleX(2.8);
    }
    65% {
      transform: scaleX(1.8);
    }
  }
</style>
