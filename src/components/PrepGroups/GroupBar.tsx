"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { Modal, ModalDescription, ModalTitle } from "../Modal";
import { Icon } from "../Icon";
import { RowActionsMenu, type RowAction } from "../RowActionsMenu";
import { toast } from "../Toast";
import { IconName } from "@/enums";
import { useMessages } from "@/hooks/useLanguage";
import type { GroupMember, PrepGroup } from "@/types";

const PRIMARY_BUTTON =
  "rounded-full bg-chrome-600 px-5 py-2 text-sm font-medium text-white hover:bg-chrome-700 disabled:cursor-not-allowed disabled:opacity-50";
const SECONDARY_BUTTON =
  "rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100";

interface GroupBarProps {
  group: PrepGroup;
  uid: string;
  onRename: (name: string) => Promise<void>;
  onSetArchived: (archived: boolean) => Promise<void>;
  /** Resolves to the new invite code. */
  onResetInvite: () => Promise<string>;
  onRemoveMember: (uid: string) => Promise<void>;
  onLeave: () => Promise<void>;
}

export function inviteLink(code: string): string {
  return `${window.location.origin}/groups/join/${code}`;
}

function MemberAvatar({ member, size = 28 }: { member: GroupMember; size?: number }) {
  return (
    <span
      title={member.name}
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-zinc-50 bg-zinc-300 text-xs font-semibold text-zinc-700"
      style={{ width: size, height: size }}
    >
      {member.photoURL ? (
        <Image
          src={member.photoURL}
          alt=""
          fill
          unoptimized
          sizes={`${size}px`}
          referrerPolicy="no-referrer"
          className="object-cover"
        />
      ) : (
        member.name.charAt(0).toUpperCase()
      )}
    </span>
  );
}

/**
 * Under the planner's heading while a prep group is open: who's in it, the
 * invite link, and the group's options — the owner manages the group, a
 * member can leave (see docs/prep-groups.md).
 */
export function GroupBar({
  group,
  uid,
  onRename,
  onSetArchived,
  onResetInvite,
  onRemoveMember,
  onLeave,
}: GroupBarProps) {
  const t = useMessages();
  const isOwner = group.ownerUid === uid;
  const [dialog, setDialog] = useState<"rename" | "members" | "leave" | null>(null);
  const [name, setName] = useState(group.name);
  const [isBusy, setIsBusy] = useState(false);
  const members = group.memberUids
    .map((memberUid) => ({ uid: memberUid, member: group.members[memberUid] }))
    .filter((entry): entry is { uid: string; member: GroupMember } => !!entry.member);

  async function run(action: () => Promise<unknown>, after?: () => void) {
    setIsBusy(true);
    try {
      await action();
      after?.();
    } catch (cause) {
      console.error("[prep group] action failed:", cause);
      toast.error(t.groups.actionFailed);
    } finally {
      setIsBusy(false);
    }
  }

  async function copyInvite(code: string, message: string) {
    try {
      await navigator.clipboard.writeText(inviteLink(code));
      toast.success(message);
    } catch {
      toast.error(t.groups.copyFailed);
    }
  }

  const actions: RowAction[] = [
    { label: t.groups.manageMembers, icon: IconName.Group, onClick: () => setDialog("members") },
    ...(isOwner
      ? [
          {
            label: t.groups.rename,
            icon: IconName.Edit,
            onClick: () => {
              setName(group.name);
              setDialog("rename");
            },
          },
          {
            label: t.groups.resetInvite,
            icon: IconName.Link,
            onClick: () =>
              void run(async () => {
                const code = await onResetInvite();
                await copyInvite(code, t.groups.resetInviteDone);
              }),
          },
          {
            label: group.archivedAt ? t.groups.unarchive : t.groups.archive,
            icon: group.archivedAt ? IconName.Unarchive : IconName.Archive,
            onClick: () => void run(() => onSetArchived(!group.archivedAt)),
          },
        ]
      : [{ label: t.groups.leave, icon: IconName.Logout, onClick: () => setDialog("leave") }]),
  ];

  function submitRename(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    void run(
      () => onRename(name),
      () => setDialog(null),
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setDialog("members")}
            className="flex shrink-0 -space-x-2"
            aria-label={t.groups.manageMembers}
          >
            {members.slice(0, 5).map(({ uid: memberUid, member }) => (
              <MemberAvatar key={memberUid} member={member} />
            ))}
          </button>
          <span className="truncate text-sm text-zinc-600">
            {t.groups.members(members.length)} · {t.groups.privateHint}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => void copyInvite(group.inviteCode, t.groups.inviteCopied)}
            className="flex items-center gap-1.5 rounded-full border border-zinc-300 px-3 py-1 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          >
            <Icon name={IconName.PersonAdd} size={16} />
            {t.groups.invite}
          </button>
          <RowActionsMenu label={t.groups.groupOptions} extraActions={actions} />
        </div>
      </div>
      {group.archivedAt && (
        <p className="rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm text-zinc-600">
          {t.groups.archivedNotice}
        </p>
      )}

      {dialog === "rename" && (
        <Modal onClose={() => setDialog(null)} labelledBy="rename-group-title">
          <form onSubmit={submitRename} className="flex flex-col gap-3">
            <h2 id="rename-group-title" className="text-lg font-semibold text-zinc-900">
              {t.groups.renameTitle}
            </h2>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-label={t.groups.create.name}
              autoFocus
              className="w-full rounded-lg border border-zinc-300 bg-zinc-50 p-2 text-sm text-zinc-900 focus:ring-2 focus:ring-zinc-400 focus:outline-none"
            />
            <div className="flex gap-2">
              <button type="submit" disabled={!name.trim() || isBusy} className={PRIMARY_BUTTON}>
                {t.common.save}
              </button>
              <button type="button" onClick={() => setDialog(null)} className={SECONDARY_BUTTON}>
                {t.common.cancel}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {dialog === "members" && (
        <Modal onClose={() => setDialog(null)} labelledBy="group-members-title">
          <ModalTitle id="group-members-title" className="mb-3">
            {t.groups.membersTitle(group.name)}
          </ModalTitle>
          <ul className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200">
            {members.map(({ uid: memberUid, member }) => (
              <li key={memberUid} className="flex items-center gap-3 px-3 py-2">
                <MemberAvatar member={member} size={32} />
                <span className="min-w-0 flex-1 truncate text-sm text-zinc-900">
                  {member.name}
                  {memberUid === uid && <span className="text-zinc-500"> ({t.groups.you})</span>}
                </span>
                {memberUid === group.ownerUid ? (
                  <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[11px] font-semibold text-zinc-600">
                    {t.groups.owner}
                  </span>
                ) : (
                  isOwner && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void run(() => onRemoveMember(memberUid))}
                      aria-label={t.groups.removeMember(member.name)}
                      title={t.groups.removeMember(member.name)}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                    >
                      <Icon name={IconName.Delete} size={16} />
                    </button>
                  )
                )}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => void copyInvite(group.inviteCode, t.groups.inviteCopied)}
              className={PRIMARY_BUTTON}
            >
              {t.groups.invite}
            </button>
            <button type="button" onClick={() => setDialog(null)} className={SECONDARY_BUTTON}>
              {t.common.close}
            </button>
          </div>
        </Modal>
      )}

      {dialog === "leave" && (
        <Modal onClose={() => setDialog(null)} labelledBy="leave-group-title">
          <ModalTitle id="leave-group-title" className="mb-2">
            {t.groups.leaveTitle(group.name)}
          </ModalTitle>
          <ModalDescription>{t.groups.leaveBody}</ModalDescription>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void run(onLeave, () => setDialog(null))}
              className="rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {t.groups.leave}
            </button>
            <button type="button" onClick={() => setDialog(null)} className={SECONDARY_BUTTON}>
              {t.common.cancel}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
