"use client";

import { useState } from "react";
import { Modal, ModalActions, ModalDescription, ModalTitle } from "../Modal";
import { Button, IconButton } from "../Button";
import { Icon } from "../Icon";
import { MemberAvatar, inviteLink } from "../PrepGroups";
import { CopyButton } from "../TeamPost/ShareDialog";
import { IconName } from "@/enums";
import { useMessages } from "@/hooks/useLanguage";
import { REGULATIONS } from "@/data/regulations";
import { cn } from "@/lib/utils";
import type { GroupMember, PrepGroup, Team } from "@/types";

const INPUT_CLASSES =
  "w-full rounded-lg border border-zinc-300 bg-field p-2 font-mono text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400";

interface CollabDialogProps {
  team: Team;
  /** A collaborative team's group (null while it loads, or for a personal team). */
  group: PrepGroup | null;
  uid: string | null;
  onSignIn: () => void;
  /** How many of your matchups "Make collaborative" can bring along. */
  matchupCount: number;
  onMake: (bringMatchups: boolean) => Promise<void>;
  onKeepCopy: () => Promise<void>;
  onLeave: () => Promise<void>;
  onStop: () => Promise<void>;
  onRemoveMember: (uid: string) => Promise<void>;
  onClose: () => void;
}

/**
 * The Team Report's Collaborate dialog (docs/collaborative-teams.md): for
 * your own team, making it collaborative; for a collaborative one, its
 * invite link and members, and keeping a copy, leaving (editors) or
 * stopping (its owner).
 */
export function CollabDialog({
  team,
  group,
  uid,
  onSignIn,
  matchupCount,
  onMake,
  onKeepCopy,
  onLeave,
  onStop,
  onRemoveMember,
  onClose,
}: CollabDialogProps) {
  const t = useMessages();
  const [bringMatchups, setBringMatchups] = useState(true);
  const [confirming, setConfirming] = useState<"leave" | "stop" | null>(null);
  const [status, setStatus] = useState<{ kind: "busy" | "error"; message: string } | null>(null);
  const isBusy = status?.kind === "busy";

  async function run(action: () => Promise<void>, busyMessage: string, errorMessage: string) {
    setStatus({ kind: "busy", message: busyMessage });
    try {
      await action();
      setStatus(null);
    } catch (error) {
      console.error("[collab team] action failed:", error);
      setStatus({ kind: "error", message: errorMessage });
    }
  }

  const statusLine = status && (
    <p
      role={status.kind === "error" ? "alert" : "status"}
      className={cn("text-sm", status.kind === "error" ? "text-red-600" : "text-zinc-500")}
    >
      {status.message}
    </p>
  );

  // ── Your own team: make it collaborative ───────────────────────────────────
  if (!team.collab) {
    const regulation = REGULATIONS.find((reg) => reg.id === team.regulationIds[0]);
    return (
      <Modal onClose={onClose} labelledBy="collab-title">
        <div className="flex flex-col gap-4">
          <ModalTitle id="collab-title">{t.collab.makeTitle(team.name)}</ModalTitle>
          <ModalDescription className="mb-0">{t.collab.makeBody}</ModalDescription>
          {!uid ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-zinc-600">{t.collab.signInPrompt}</p>
              <Button onClick={onSignIn}>{t.auth.signIn}</Button>
            </div>
          ) : (
            <>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-zinc-600">
                <li>{t.collab.makeOnline}</li>
                {team.regulationIds.length > 1 && regulation && (
                  <li>{t.collab.oneRegulation(t.common.regulationLabel(regulation.label))}</li>
                )}
                {team.share && <li>{t.collab.sharedLinkStops}</li>}
              </ul>
              {matchupCount > 0 ? (
                <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-900">
                  <input
                    type="checkbox"
                    checked={bringMatchups}
                    onChange={() => setBringMatchups((on) => !on)}
                    className="mt-1"
                  />
                  {t.collab.bringMatchups(matchupCount)}
                </label>
              ) : (
                <p className="text-sm text-zinc-500">{t.collab.noMatchupsToBring}</p>
              )}
              {statusLine}
              <ModalActions className="mt-0">
                <Button
                  disabled={isBusy}
                  onClick={() =>
                    void run(
                      () => onMake(bringMatchups && matchupCount > 0),
                      t.collab.making,
                      t.collab.makeFailed,
                    )
                  }
                >
                  {t.collab.make}
                </Button>
                <Button variant="outline" onClick={onClose}>
                  {t.common.cancel}
                </Button>
              </ModalActions>
            </>
          )}
        </div>
      </Modal>
    );
  }

  // ── A collaborative team: invite, members, keep / leave / stop ─────────────
  const isOwner = team.collab.ownerUid === uid;
  const members = (group?.memberUids ?? [])
    .map((memberUid) => ({ uid: memberUid, member: group?.members[memberUid] }))
    .filter((entry): entry is { uid: string; member: GroupMember } => !!entry.member);
  const link = group && typeof window !== "undefined" ? inviteLink(group.inviteCode) : "";

  if (confirming) {
    const isStop = confirming === "stop";
    return (
      <Modal onClose={() => setConfirming(null)} labelledBy="collab-confirm-title">
        <ModalTitle id="collab-confirm-title" className="mb-2">
          {isStop ? t.collab.confirmStopTitle(team.name) : t.collab.confirmLeaveTitle(team.name)}
        </ModalTitle>
        <ModalDescription>
          {isStop ? t.collab.confirmStopBody : t.collab.confirmLeaveBody}
        </ModalDescription>
        {statusLine}
        <ModalActions>
          <Button
            variant="danger"
            disabled={isBusy}
            onClick={() =>
              void run(isStop ? onStop : onLeave, t.common.loading, t.collab.actionFailed)
            }
          >
            {isStop ? t.collab.stop : t.collab.leave}
          </Button>
          <Button variant="outline" onClick={() => setConfirming(null)}>
            {t.common.cancel}
          </Button>
        </ModalActions>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} labelledBy="collab-title">
      <div className="flex flex-col gap-4">
        <ModalTitle id="collab-title">{t.collab.manageTitle(team.name)}</ModalTitle>

        {group && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              {t.collab.inviteLink}
            </span>
            <div className="flex items-center gap-1">
              <input
                readOnly
                value={link}
                onFocus={(event) => event.target.select()}
                aria-label={t.collab.inviteLink}
                className={INPUT_CLASSES}
              />
              <CopyButton text={link} label={t.collab.copyInvite} />
            </div>
            <p className="text-xs text-zinc-500">{t.collab.inviteHint}</p>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            {t.collab.members}
          </span>
          <ul className="flex flex-col gap-1">
            {members.map(({ uid: memberUid, member }) => (
              <li key={memberUid} className="flex items-center gap-2 text-sm text-zinc-900">
                <MemberAvatar member={member} />
                <span className="min-w-0 flex-1 truncate">
                  {member.name}
                  {memberUid === uid && <span className="text-zinc-500"> ({t.collab.you})</span>}
                </span>
                {memberUid === team.collab?.ownerUid ? (
                  <span className="text-xs text-zinc-500">{t.collab.owner}</span>
                ) : (
                  isOwner && (
                    <IconButton
                      variant="ghost"
                      disabled={isBusy}
                      onClick={() =>
                        void run(
                          () => onRemoveMember(memberUid),
                          t.common.loading,
                          t.collab.actionFailed,
                        )
                      }
                      aria-label={t.collab.removeMember(member.name)}
                      title={t.collab.removeMember(member.name)}
                      className="hover:text-red-600"
                    >
                      <Icon name={IconName.Close} size={16} />
                    </IconButton>
                  )
                )}
              </li>
            ))}
          </ul>
        </div>

        {statusLine}

        <div className="flex flex-col gap-2 border-t border-zinc-200 pt-3">
          <Button
            variant="outline"
            disabled={isBusy}
            onClick={() => void run(onKeepCopy, t.common.loading, t.collab.actionFailed)}
            title={t.collab.keepCopyHint}
            className="flex items-center justify-center gap-1.5"
          >
            <Icon name={IconName.ContentCopy} size={16} />
            {t.collab.keepCopy}
          </Button>
          <Button
            variant="danger"
            disabled={isBusy}
            onClick={() => setConfirming(isOwner ? "stop" : "leave")}
            title={isOwner ? t.collab.stopHint : undefined}
            className="flex items-center justify-center gap-1.5"
          >
            <Icon name={IconName.Logout} size={16} />
            {isOwner ? t.collab.stop : t.collab.leave}
          </Button>
        </div>

        <Button variant="outline" onClick={onClose} className="self-start">
          {t.share.done}
        </Button>
      </div>
    </Modal>
  );
}
