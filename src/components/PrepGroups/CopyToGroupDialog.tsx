"use client";

import { useState } from "react";
import { Modal, ModalDescription, ModalTitle } from "../Modal";
import { Icon } from "../Icon";
import { IconName } from "@/enums";
import { useMessages } from "@/hooks/useLanguage";
import type { Opponent, PrepGroup } from "@/types";
import { Button } from "@/components/Button";

interface CopyToGroupDialogProps {
  opponent: Opponent;
  /** Your active groups for the opponent's regulation. */
  groups: PrepGroup[];
  /** A rejection shows an error and keeps the dialog open. */
  onCopy: (group: PrepGroup) => Promise<void>;
  onClose: () => void;
}

/** Picks which prep group gets a copy of one of your opponents (with your plans for it). */
export function CopyToGroupDialog({ opponent, groups, onCopy, onClose }: CopyToGroupDialogProps) {
  const t = useMessages();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function copy(group: PrepGroup) {
    setBusyId(group.id);
    setError(null);
    try {
      await onCopy(group);
    } catch (cause) {
      console.error("[prep group] copy failed:", cause);
      setError(t.groups.actionFailed);
      setBusyId(null);
    }
  }

  return (
    <Modal onClose={onClose} labelledBy="copy-to-group-title">
      <ModalTitle id="copy-to-group-title">{t.groups.copyTitle(opponent.label)}</ModalTitle>
      <ModalDescription className="mb-3">{t.groups.copyIntro}</ModalDescription>
      {groups.length === 0 ? (
        <p className="text-sm text-zinc-500">{t.groups.noGroupsForRegulation}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200">
          {groups.map((group) => (
            <li key={group.id}>
              <button
                type="button"
                disabled={busyId !== null}
                onClick={() => void copy(group)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-zinc-800 hover:bg-zinc-100 disabled:opacity-50"
              >
                <Icon name={IconName.Group} size={16} className="shrink-0 text-zinc-500" />
                <span className="min-w-0 flex-1 truncate">{group.name}</span>
                <span className="text-xs text-zinc-400">
                  {t.groups.members(group.memberUids.length)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
      <Button variant="outline" onClick={onClose} className="mt-4">
        {t.common.cancel}
      </Button>
    </Modal>
  );
}
