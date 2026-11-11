import { beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), info: vi.fn(), error: vi.fn() }));
vi.mock("@/components/Toast", () => ({ toast }));

import { addPasteToOpponents } from "./teamExport";
import { createOpponent } from "./opponent";
import type { Opponent } from "@/types";

const SAVED = `Incineroar @ Sitrus Berry
Ability: Intimidate
EVs: 32 HP
Careful Nature
- Fake Out
- Parting Shot

Pikachu @ Light Ball
- Volt Tackle`;

// The same team: other slot order, move order, a nickname, no EVs or nature.
const SAME_TEAM = `Sparky (Pikachu) @ Light Ball
- Volt Tackle

Incineroar @ Sitrus Berry
Ability: Intimidate
- Parting Shot
- Fake Out`;

describe("addPasteToOpponents", () => {
  let opponents: Opponent[];
  const addOpponents = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    opponents = [createOpponent("Scouted", SAVED, "reg-a")];
  });

  it("skips a team already saved under the same regulation, however it's pasted", () => {
    addPasteToOpponents({
      name: "Shared",
      paste: SAME_TEAM,
      regulationId: "reg-a",
      opponents,
      addOpponents,
    });
    expect(addOpponents).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledOnce();
  });

  it("adds it under a different regulation", () => {
    addPasteToOpponents({
      name: "Shared",
      paste: SAME_TEAM,
      regulationId: "reg-b",
      opponents,
      addOpponents,
    });
    expect(addOpponents).toHaveBeenCalledOnce();
    expect(addOpponents.mock.calls[0][0][0]).toMatchObject({
      label: "Shared",
      regulationId: "reg-b",
    });
  });

  it("adds a team that differs by a move", () => {
    addPasteToOpponents({
      name: "Shared",
      paste: SAME_TEAM.replace("- Volt Tackle", "- Thunderbolt"),
      regulationId: "reg-a",
      opponents,
      addOpponents,
    });
    expect(addOpponents).toHaveBeenCalledOnce();
  });
});
