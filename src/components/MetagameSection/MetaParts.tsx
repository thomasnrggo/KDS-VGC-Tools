"use client";

/** Small pieces the Metagame's dialogs and rows share: a dialog's header, a figure, a share list, moves. */

import { useMessages, usePokemonText } from "@/hooks/useLanguage";
import { normalizeSpeciesKey } from "@/lib/species/normalize";
import { cn } from "@/lib/utils";
import type { Share } from "@/lib/meta/aggregateMeta";
import { IconName } from "@/enums";
import { Icon } from "../Icon";
import { PokemonSprite } from "../PokemonSprite";
import { ModalTitle } from "../Modal";
import { IconButton } from "../Button";
import { TypeIcon } from "../TypeIcon";
import { DETAIL_TITLE, MOVES, percent } from "./metaShared";

/** A dialog's header: sprites, a title, the close button. */
export function DetailHeader({
  id,
  species,
  title,
  subtitle,
  onClose,
}: {
  id: string;
  species: string[];
  title: string;
  subtitle: string;
  onClose: () => void;
}) {
  const t = useMessages();
  return (
    <div className="flex shrink-0 items-center gap-3 pb-3">
      <span className="flex shrink-0 gap-0.5">
        {species.map((name) => (
          <span
            key={name}
            className={cn("relative", species.length > 1 ? "h-10 w-10" : "h-14 w-14")}
          >
            <PokemonSprite species={name} fill />
          </span>
        ))}
      </span>
      <div className="min-w-0 flex-1">
        <ModalTitle id={id} className="mb-0 truncate">
          {title}
        </ModalTitle>
        <p className="text-sm text-zinc-500">{subtitle}</p>
      </div>
      <IconButton
        variant="round"
        onClick={onClose}
        aria-label={t.common.close}
        className="h-9 w-9 self-start"
      >
        <Icon name={IconName.Close} size={18} />
      </IconButton>
    </div>
  );
}

/** One figure in a dialog's row of stats. */
export function Stat({
  label,
  value,
  caption,
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  /** What the figure covers, always shown (phones can't hover for the hint). */
  caption?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div title={hint} className="flex flex-col gap-0.5 rounded-lg bg-zinc-100 px-3 py-2">
      <span className="text-[10px] font-semibold tracking-wide text-zinc-500 uppercase">
        {label}
      </span>
      <span className={cn("text-base font-semibold text-zinc-900 tabular-nums", className)}>
        {value}
      </span>
      {caption && <span className="truncate text-[11px] text-zinc-500">{caption}</span>}
    </div>
  );
}

/** A titled list of names with the share of this Pokémon's teams that have each. */
export function ShareList({
  title,
  shares,
  render,
}: {
  title: string;
  shares: Share[];
  render: (name: string) => React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className={DETAIL_TITLE}>{title}</h3>
      <ul className="flex flex-col gap-1">
        {shares.map(({ name, share }) => (
          <li key={name} className="flex flex-col gap-0.5 text-sm text-zinc-800">
            <span className="flex items-center justify-between gap-2">
              {render(name)}
              <span className="shrink-0 text-xs text-zinc-500 tabular-nums">{percent(share)}</span>
            </span>
            <span className="h-1 overflow-hidden rounded-full bg-zinc-200">
              <span
                className="block h-full rounded-full bg-zinc-400"
                style={{ width: percent(share) }}
              />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MoveName({ move }: { move: string }) {
  const text = usePokemonText();
  const type = MOVES[normalizeSpeciesKey(move)]?.type;
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {type && (
        <span className="shrink-0 overflow-hidden rounded">
          <TypeIcon type={type} size={16} />
        </span>
      )}
      <span className="truncate">{text.move(move)}</span>
    </span>
  );
}

/** A move as the Pokémon cards show it: a light pill with its type icon. */
export function MovePill({ move }: { move: string }) {
  return (
    <li className="flex h-7 min-w-0 items-center rounded bg-zinc-100 px-1.5 text-[13px] text-zinc-800">
      <MoveName move={move} />
    </li>
  );
}
