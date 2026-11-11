"use client";

import { useState } from "react";
import { Modal } from "../Modal";
import { Icon } from "../Icon";
import { IconName } from "@/enums";
import { publishTeamShare, reconcileSharedMatchups, unpublishTeamShare } from "@/lib/storage/db";
import { SHARE_SECTIONS, sharedTeamPath, sharesSection } from "@/lib/sharedTeam";
import type { Opponent, ShareSection, Team, TeamShare, TeamSheetMode } from "@/types";
import { useMessages } from "@/hooks/useLanguage";
import { cn } from "@/lib/utils";
import { Button } from "@/components/Button";

const INPUT_CLASSES =
  "w-full rounded-lg border border-zinc-300 bg-zinc-50 p-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400";

/** Copies `text`, flashing "Copied" on the button for a moment. */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const t = useMessages();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      aria-label={label}
      title={label}
      className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
    >
      <Icon name={copied ? IconName.Check : IconName.ContentCopy} size={14} />
      {copied && t.common.copied}
    </button>
  );
}

/**
 * Private / Shareable, and for shareable an open or closed team sheet and
 * which sections go with it (strategy, calcs, matchups) — see
 * TeamShare/SharedTeam and docs/full-share.md.
 */
export function ShareDialog({
  team,
  matchupOpponents,
  onUpdate,
  isSignedIn,
  onSignIn,
  onClose,
}: {
  team: Team;
  /** The opponents whose matchups a share publishes (opponentsToShare) — null while they load. */
  matchupOpponents: Opponent[] | null;
  onUpdate: (updater: (team: Team) => Team) => void;
  isSignedIn: boolean;
  onSignIn: () => void;
  onClose: () => void;
}) {
  const t = useMessages();
  const sheetOptions: { value: TeamSheetMode; label: string; description: string }[] = [
    { value: "open", label: t.share.openSheet, description: t.share.openSheetHint },
    { value: "closed", label: t.share.closedSheet, description: t.share.closedSheetHint },
  ];
  const [status, setStatus] = useState<{ kind: "saving" | "error"; message: string } | null>(null);
  const url =
    typeof window === "undefined" ? "" : `${window.location.origin}${sharedTeamPath(team.id)}`;

  // Saves the choice locally right away, then publishes/unpublishes the
  // public copy and waits for it — a failure (e.g. firestore.rules not
  // deployed) shows here instead of only in the console.
  async function apply(share: TeamShare | null) {
    const next: Team = { ...team, share: share ?? undefined };
    onUpdate((t) => ({ ...t, share: next.share }));
    setStatus({ kind: "saving", message: share ? t.share.publishing : t.share.makingPrivate });
    try {
      if (share) {
        // The team doc first: the rules check it before allowing its matchups.
        await publishTeamShare(next);
        if (matchupOpponents) await reconcileSharedMatchups(next, matchupOpponents);
      } else {
        await unpublishTeamShare(team.id);
      }
      setStatus(null);
    } catch (error) {
      console.error("[share] failed:", error);
      setStatus({
        kind: "error",
        message: share ? t.share.publishFailed : t.share.unpublishFailed,
      });
    }
  }

  const isShared = !!team.share;

  function toggleSection(section: ShareSection) {
    if (!team.share) return;
    const on = !sharesSection(team.share, section);
    const sections = SHARE_SECTIONS.filter((s) =>
      s === section ? on : sharesSection(team.share, s),
    );
    void apply({ ...team.share, sections });
  }

  return (
    <Modal onClose={onClose} labelledBy="share-team-title">
      <div className="flex flex-col gap-4">
        <h2 id="share-team-title" className="text-lg font-semibold text-zinc-900">
          {t.share.title(team.name)}
        </h2>

        {!isSignedIn ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-zinc-600">{t.share.signInPrompt}</p>
            <button
              type="button"
              onClick={onSignIn}
              className="rounded-full bg-chrome-600 px-5 py-2 text-sm font-medium text-white hover:bg-chrome-700"
            >
              {t.auth.signIn}
            </button>
          </div>
        ) : (
          <>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                {t.share.whoCanSee}
              </legend>
              {[
                { shared: false, label: t.share.private, description: t.share.privateHint },
                { shared: true, label: t.share.shareable, description: t.share.shareableHint },
              ].map((option) => (
                <label key={option.label} className="flex cursor-pointer items-start gap-2">
                  <input
                    type="radio"
                    name="visibility"
                    checked={isShared === option.shared}
                    onChange={() => void apply(option.shared ? { sheet: "open" } : null)}
                    className="mt-1"
                  />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium text-zinc-900">{option.label}</span>
                    <span className="text-xs text-zinc-500">{option.description}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            {team.share && (
              <>
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                    {t.share.whatItShows}
                  </legend>
                  {sheetOptions.map((option) => (
                    <label key={option.value} className="flex cursor-pointer items-start gap-2">
                      <input
                        type="radio"
                        name="sheet"
                        checked={team.share?.sheet === option.value}
                        onChange={() => void apply({ ...team.share, sheet: option.value })}
                        className="mt-1"
                      />
                      <span className="flex flex-col">
                        <span className="text-sm font-medium text-zinc-900">{option.label}</span>
                        <span className="text-xs text-zinc-500">{option.description}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>

                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                    {t.share.alsoShare}
                  </legend>
                  {/* Closed sheets only — see sharesSection. */}
                  {team.share.sheet === "open" ? (
                    <p className="text-xs text-zinc-500">{t.share.alsoShareClosedOnly}</p>
                  ) : (
                    SHARE_SECTIONS.map((section) => (
                      <label key={section} className="flex cursor-pointer items-start gap-2">
                        <input
                          type="checkbox"
                          checked={sharesSection(team.share, section)}
                          onChange={() => toggleSection(section)}
                          className="mt-1"
                        />
                        <span className="flex flex-col">
                          <span className="text-sm font-medium text-zinc-900">
                            {t.share.sections[section]}
                          </span>
                          <span className="text-xs text-zinc-500">
                            {t.share.sectionHints[section]}
                          </span>
                          {section === "matchups" &&
                            sharesSection(team.share, "matchups") &&
                            !matchupOpponents && (
                              <span className="text-xs text-zinc-500">
                                {t.share.matchupsLoading}
                              </span>
                            )}
                        </span>
                      </label>
                    ))
                  )}
                </fieldset>

                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                    {t.share.link}
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      readOnly
                      value={url}
                      onFocus={(event) => event.target.select()}
                      aria-label={t.share.linkLabel}
                      className={cn(INPUT_CLASSES, "font-mono text-xs")}
                    />
                    <CopyButton text={url} label={t.share.copyLink} />
                    <a
                      href={sharedTeamPath(team.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={t.share.openShared}
                      title={t.share.openShared}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                    >
                      <Icon name={IconName.OpenInNew} size={16} />
                    </a>
                  </div>
                  <p className="text-xs text-zinc-500">{t.share.updatesHint}</p>
                </div>
              </>
            )}

            {status && (
              <p
                role={status.kind === "error" ? "alert" : "status"}
                className={cn(
                  "text-sm",
                  status.kind === "error" ? "text-red-600" : "text-zinc-500",
                )}
              >
                {status.message}
              </p>
            )}
          </>
        )}

        <Button variant="outline" onClick={onClose} className="self-start">
          {t.share.done}
        </Button>
      </div>
    </Modal>
  );
}
