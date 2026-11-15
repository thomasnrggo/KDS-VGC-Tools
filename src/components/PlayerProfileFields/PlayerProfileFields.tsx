"use client";

import type { ReactNode } from "react";
import { TogglePill } from "../Button";
import { useMessages } from "@/hooks/useLanguage";
import { cn } from "@/lib/utils";
import type { AgeDivision, PlayerProfile } from "@/lib/playerProfile";

const DIVISIONS: AgeDivision[] = ["juniors", "seniors", "masters"];
export const PROFILE_INPUT_CLASSES =
  "w-full rounded-lg border border-zinc-300 bg-zinc-50 p-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400";

type TextKey = "playerName" | "trainerName" | "switchProfile" | "playerId" | "supportId";

interface PlayerProfileFieldsProps {
  value: PlayerProfile;
  onChange: (next: PlayerProfile) => void;
  /** Player ID, date of birth and Support ID — only the staff page asks for them. */
  showStaffFields?: boolean;
  /** Extra fields after Trainer name (the team list's Battle Team number / name). */
  children?: ReactNode;
}

/** The player profile's fields — on /profile and in the team list PDF dialog. */
export function PlayerProfileFields({
  value,
  onChange,
  showStaffFields = true,
  children,
}: PlayerProfileFieldsProps) {
  const t = useMessages();

  function update<K extends keyof PlayerProfile>(key: K, next: PlayerProfile[K]) {
    onChange({ ...value, [key]: next });
  }

  function field(key: TextKey, label: string, optional?: boolean) {
    return (
      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
        <span>
          {label}
          {optional && <span className="font-normal text-zinc-400"> ({t.teamList.optional})</span>}
        </span>
        <input
          value={value[key]}
          onChange={(event) => update(key, event.target.value)}
          maxLength={100}
          className={PROFILE_INPUT_CLASSES}
        />
      </label>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className={cn("grid gap-3", children ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
        {field("playerName", t.teamList.playerName)}
        {field("trainerName", t.teamList.trainerName)}
        {children}
        {field("switchProfile", t.teamList.switchProfile)}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-zinc-600">{t.teamList.division}</span>
        <div className="flex flex-wrap gap-1.5">
          {DIVISIONS.map((division) => (
            <TogglePill
              key={division}
              active={value.division === division}
              onClick={() => update("division", value.division === division ? null : division)}
            >
              {t.teamList.divisions[division]}
            </TogglePill>
          ))}
        </div>
      </div>

      {showStaffFields && (
        <div className="grid gap-3 sm:grid-cols-3">
          {field("playerId", t.teamList.playerId)}
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
            {t.teamList.birthDate}
            <input
              type="date"
              value={value.birthDate}
              onChange={(event) => update("birthDate", event.target.value)}
              className={PROFILE_INPUT_CLASSES}
            />
          </label>
          {field("supportId", t.teamList.supportId, true)}
        </div>
      )}
    </div>
  );
}
