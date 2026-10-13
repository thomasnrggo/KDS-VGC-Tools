"use client";

import { useState } from "react";
import { Modal } from "../Modal";
import { Icon } from "../Icon";
import { IconName } from "@/enums";
import { publishTeamShare, unpublishTeamShare } from "@/lib/storage/db";
import { sharedTeamPath } from "@/lib/sharedTeam";
import type { Team, TeamSheetMode } from "@/types";
import { useMessages } from "@/hooks/useLanguage";

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

/** Private / Shareable, and for shareable an open or closed team sheet — see TeamShare/SharedTeam. */
export function ShareDialog({
  team,
  onUpdate,
  isSignedIn,
  onSignIn,
  onClose,
}: {
  team: Team;
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
  const [status, setStatus] = useState<{ kind: "saving" | "error"; message: string } | null>(
    null,
  );
  const url =
    typeof window === "undefined" ? "" : `${window.location.origin}${sharedTeamPath(team.id)}`;

  // Saves the choice locally right away, then publishes/unpublishes the
  // public copy and waits for it — a failure (e.g. firestore.rules not
  // deployed) shows here instead of only in the console.
  async function apply(sheet: TeamSheetMode | null) {
    const next: Team = { ...team, share: sheet ? { sheet } : undefined };
    onUpdate((t) => ({ ...t, share: next.share }));
    setStatus({ kind: "saving", message: sheet ? t.share.publishing : t.share.makingPrivate });
    try {
      if (sheet) await publishTeamShare(next);
      else await unpublishTeamShare(team.id);
      setStatus(null);
    } catch (error) {
      console.error("[share] failed:", error);
      setStatus({
        kind: "error",
        message: sheet ? t.share.publishFailed : t.share.unpublishFailed,
      });
    }
  }

  const isShared = !!team.share;

  return (
    <Modal onClose={onClose} labelledBy="share-team-title">
      <div className="flex flex-col gap-4">
        <h2 id="share-team-title" className="text-lg font-semibold text-zinc-900">
          {t.share.title(team.name)}
        </h2>

        {!isSignedIn ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-zinc-600">
              {t.share.signInPrompt}
            </p>
            <button
              type="button"
              onClick={onSignIn}
              className="rounded-full bg-zinc-600 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-400 dark:hover:bg-zinc-300"
            >
              {t.auth.signIn}
            </button>
          </div>
        ) : (
          <>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
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
                    onChange={() => void apply(option.shared ? "open" : null)}
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
                  <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {t.share.whatItShows}
                  </legend>
                  {sheetOptions.map((option) => (
                    <label key={option.value} className="flex cursor-pointer items-start gap-2">
                      <input
                        type="radio"
                        name="sheet"
                        checked={team.share?.sheet === option.value}
                        onChange={() => void apply(option.value)}
                        className="mt-1"
                      />
                      <span className="flex flex-col">
                        <span className="text-sm font-medium text-zinc-900">{option.label}</span>
                        <span className="text-xs text-zinc-500">{option.description}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>

                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {t.share.link}
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      readOnly
                      value={url}
                      onFocus={(event) => event.target.select()}
                      aria-label={t.share.linkLabel}
                      className={`${INPUT_CLASSES} font-mono text-xs`}
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
                  <p className="text-xs text-zinc-500">
                    {t.share.updatesHint}
                  </p>
                </div>
              </>
            )}

            {status && (
              <p
                role={status.kind === "error" ? "alert" : "status"}
                className={`text-sm ${status.kind === "error" ? "text-red-600" : "text-zinc-500"}`}
              >
                {status.message}
              </p>
            )}
          </>
        )}

        <button
          type="button"
          onClick={onClose}
          className="self-start rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
        >
          {t.share.done}
        </button>
      </div>
    </Modal>
  );
}
