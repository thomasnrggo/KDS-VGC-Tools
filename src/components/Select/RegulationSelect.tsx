"use client";

import { REGULATIONS } from "@/data/regulations";
import { useMessages } from "@/hooks/useLanguage";
import { Select } from "./Select";

interface RegulationSelectProps {
  value: string;
  onChange: (regulationId: string) => void;
}

/** The "Regulation M-C ⌄" pill the list pages (My Teams, Matchup Planner, Tournaments, Speed Tiers) filter by. */
export function RegulationSelect({ value, onChange }: RegulationSelectProps) {
  const t = useMessages();
  return (
    <Select
      value={value}
      onChange={onChange}
      ariaLabel={t.common.regulation}
      options={REGULATIONS.map((regulation) => ({
        value: regulation.id,
        label: t.common.regulationLabel(regulation.label),
      }))}
    />
  );
}
