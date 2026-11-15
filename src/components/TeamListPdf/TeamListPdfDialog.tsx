"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, TogglePill } from "../Button";
import { Modal, ModalActions, ModalDescription, ModalTitle } from "../Modal";
import { PlayerProfileFields, PROFILE_INPUT_CLASSES } from "../PlayerProfileFields";
import { toast } from "../Toast";
import { useMessages, usePokemonText } from "@/hooks/useLanguage";
import { usePlayerProfile } from "@/hooks/usePlayerProfile";
import { samePlayerProfile, type PlayerProfile } from "@/lib/playerProfile";
import {
  loadBattleTeam,
  loadPages,
  saveBattleTeam,
  savePages,
} from "@/lib/teamListPdf/playerDetails";
import { teamListRows } from "@/lib/teamListPdf/teamListRows";
import type { TeamListPages } from "@/lib/teamListPdf/fillTeamList";
import type { ParsedPokemon } from "@/types";

const TEMPLATE_URL = "/team-list/play-pokemon-vg-team-list.pdf";
const PAGES: TeamListPages[] = ["opponents", "staff", "both"];

function fileName(teamName: string): string {
  const slug = teamName
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `team-list${slug ? `-${slug}` : ""}.pdf`;
}

function downloadBytes(bytes: Uint8Array, name: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

interface TeamListPdfDialogProps {
  teamId: string;
  teamName: string;
  pokemon: ParsedPokemon[];
  onClose: () => void;
}

/**
 * Fills Play! Pokémon's official team list with a team and downloads it —
 * the opponents' page by default (what most locals need), the staff page, or
 * both. Everything happens in the browser: pdf-lib and the blank form load
 * on Download. The player's details come from their profile (/profile,
 * src/lib/playerProfile.ts); changes made here are saved back to it.
 */
export function TeamListPdfDialog({ teamId, teamName, pokemon, onClose }: TeamListPdfDialogProps) {
  const t = useMessages();
  const text = usePokemonText();
  const { profile, isLoading, isSignedIn, save } = usePlayerProfile();
  const [pages, setPages] = useState<TeamListPages>(loadPages);
  const [battleTeam, setBattleTeam] = useState(() => loadBattleTeam(teamId));
  // Only once something is typed — until then it follows the profile as it loads.
  const [draft, setDraft] = useState<PlayerProfile | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const player = draft ?? profile;

  const incomplete = pokemon
    .slice(0, 6)
    .filter(
      (mon) =>
        !mon.ability || !mon.item || !mon.nature || (mon.moves ?? []).filter(Boolean).length < 4,
    ).length;

  async function download() {
    setIsWorking(true);
    saveBattleTeam(teamId, battleTeam);
    savePages(pages);
    if (draft && !samePlayerProfile(draft, profile)) {
      // The PDF doesn't wait on this — a failed sync only means the account keeps the old details.
      save(draft).catch((error) => console.error("[playerProfile] save failed:", error));
    }
    try {
      const [{ fillTeamList }, template] = await Promise.all([
        import("@/lib/teamListPdf/fillTeamList"),
        fetch(TEMPLATE_URL).then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.arrayBuffer();
        }),
      ]);
      const bytes = await fillTeamList(template, {
        pages,
        player: { ...player, battleTeam },
        team: teamListRows(pokemon, text),
      });
      downloadBytes(bytes, fileName(teamName));
      onClose();
    } catch (error) {
      console.error("[teamList] PDF failed:", error);
      toast.error(t.teamList.failed);
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <Modal onClose={onClose} labelledBy="team-list-pdf-title">
      <ModalTitle id="team-list-pdf-title">{t.teamList.title}</ModalTitle>
      <ModalDescription>
        {isSignedIn ? t.teamList.descriptionSignedIn : t.teamList.description}{" "}
        <Link href="/profile" className="font-medium text-zinc-800 underline">
          {t.teamList.editProfile}
        </Link>
      </ModalDescription>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-600">{t.teamList.pagesLabel}</span>
          <div className="flex flex-wrap gap-1.5">
            {PAGES.map((option) => (
              <TogglePill key={option} active={pages === option} onClick={() => setPages(option)}>
                {t.teamList.pages[option]}
              </TogglePill>
            ))}
          </div>
          <p className="text-xs text-zinc-500">{t.teamList.pagesHint[pages]}</p>
        </div>

        <PlayerProfileFields
          value={player}
          onChange={setDraft}
          showStaffFields={pages !== "opponents"}
        >
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
            {t.teamList.battleTeam}
            <input
              value={battleTeam}
              onChange={(event) => setBattleTeam(event.target.value)}
              placeholder={t.teamList.battleTeamPlaceholder}
              maxLength={100}
              className={PROFILE_INPUT_CLASSES}
            />
          </label>
        </PlayerProfileFields>

        {incomplete > 0 && (
          <p className="text-xs text-amber-700">{t.teamList.incomplete(incomplete)}</p>
        )}
      </div>

      <ModalActions className="justify-end">
        <Button variant="outline" onClick={onClose} className="px-4 py-2 text-sm">
          {t.common.cancel}
        </Button>
        <Button onClick={download} disabled={isWorking || isLoading} className="px-4 py-2 text-sm">
          {isWorking ? t.teamList.downloading : t.teamList.download}
        </Button>
      </ModalActions>
    </Modal>
  );
}
