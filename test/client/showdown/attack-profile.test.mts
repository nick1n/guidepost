import { expect, it } from "vitest";
import { render } from "svelte/server";
import { attackStats } from "#lib/kdm/showdown/rules.ts";
import { makeSheet } from "#lib/kdm/showdown/sheet.ts";
import AttackProfile from "#lib/kdm/showdown/ui/AttackProfile.svelte";

it.each([
  { luck: 1, label: "−" },
  { luck: 0, label: "10" },
  { luck: -1, label: "9+" },
])("renders critical target $label for monster luck $luck", ({ luck, label }) => {
  const attack = attackStats(makeSheet(), "Founding Stone", { toughness: 6, evasion: 0, luck });
  const { body } = render(AttackProfile, { props: { title: "Founding Stone", stats: [], attack } });

  expect(body).toContain(`Crit ${label}`);
  expect(body).not.toContain("null+");
});
