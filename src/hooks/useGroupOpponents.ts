"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  deleteGroupOpponent,
  deleteGroupPlan,
  saveGroupOpponent,
  saveGroupPlan,
  subscribeGroupOpponents,
  subscribeGroupPlans,
} from "@/lib/firebase";
import {
  canRemoveGroupOpponent,
  groupPlanId,
  mergeGroupOpponent,
  planChanged,
  sharedChanged,
  splitGroupOpponent,
} from "@/lib/groupOpponents";
import { normalizeOpponent } from "@/lib/opponent";
import { createKeyedDebouncer } from "@/lib/keyedDebounce";
import { useAuth } from "./useAuth";
import { sortByListOrder, useOpponentActions, type OpponentStore } from "./useOpponentActions";
import type { GroupPlanDoc, Opponent, PrepGroup, SharedOpponent } from "@/types";

/** Edits (typing notes, dragging) are written after a pause, like the personal list's cloud push. */
const WRITE_DELAY_MS = 800;

/**
 * A prep group's opponents for the Matchup Planner (see
 * docs/prep-groups.md): the group's shared opponents, live from Firestore,
 * each merged with your private plan doc — the same `Opponent` shape and
 * actions as useOpponents, so the planner works the same on either list.
 * Saving splits them again: shared fields to the group, plans to your account.
 *
 * Writes are debounced; until one goes out, its value stays layered over
 * what Firestore last reported, so a teammate's unrelated change arriving
 * meanwhile can't undo what you're typing.
 */
export function useGroupOpponents(group: PrepGroup | null) {
  const { user } = useAuth();
  const groupId = group?.id ?? null;
  const uid = user?.uid ?? null;
  const [opponents, setOpponents] = useState<Opponent[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  // Keyed by group, so switching groups doesn't carry over the last one's error.
  const [failure, setFailure] = useState<{ groupId: string; error: Error } | null>(null);
  const error = failure && failure.groupId === groupId ? failure.error : null;

  const snapshot = useRef<{ shared: SharedOpponent[]; plans: GroupPlanDoc[] }>({
    shared: [],
    plans: [],
  });
  const pendingShared = useRef(new Map<string, SharedOpponent>());
  const pendingPlans = useRef(new Map<string, GroupPlanDoc>());
  const debouncer = useMemo(() => createKeyedDebouncer(WRITE_DELAY_MS), []);

  useEffect(() => {
    if (!groupId || !uid) return;
    let sharedReady = false;
    let plansReady = false;
    snapshot.current = { shared: [], plans: [] };

    function publish() {
      if (!sharedReady || !plansReady) return;
      const shared = new Map(snapshot.current.shared.map((opponent) => [opponent.id, opponent]));
      pendingShared.current.forEach((opponent, id) => shared.set(id, opponent));
      const plans = new Map(snapshot.current.plans.map((plan) => [plan.opponentId, plan]));
      pendingPlans.current.forEach((plan) => plans.set(plan.opponentId, plan));
      setOpponents(
        [...shared.values()].map((opponent) =>
          normalizeOpponent(mergeGroupOpponent(opponent, plans.get(opponent.id))),
        ),
      );
      setLoadedFor(groupId);
    }

    const onError = (cause: Error) => {
      console.error("[prep group] listener failed:", cause);
      setFailure({ groupId, error: cause });
    };
    const stopShared = subscribeGroupOpponents(
      groupId,
      (shared) => {
        snapshot.current.shared = shared;
        sharedReady = true;
        publish();
      },
      onError,
    );
    const stopPlans = subscribeGroupPlans(
      uid,
      groupId,
      (plans) => {
        snapshot.current.plans = plans;
        plansReady = true;
        publish();
      },
      onError,
    );
    return () => {
      stopShared();
      stopPlans();
    };
  }, [groupId, uid]);

  const store: OpponentStore = {
    save: (changes) => {
      if (!groupId || !uid) return;
      for (const { before, after } of changes) {
        // A new opponent is credited to whoever adds it (they and the owner can remove it).
        const opponent: Opponent = before
          ? after
          : {
              ...after,
              addedBy: after.addedBy ?? uid,
              addedByName: after.addedByName ?? user?.displayName ?? undefined,
            };
        const { shared, plan } = splitGroupOpponent(opponent, groupId);
        if (sharedChanged(before, opponent, groupId)) {
          if (!before) {
            void saveGroupOpponent(groupId, shared).catch(logWriteError);
          } else {
            pendingShared.current.set(shared.id, shared);
            debouncer.schedule(`shared:${shared.id}`, () => {
              pendingShared.current.delete(shared.id);
              void saveGroupOpponent(groupId, shared).catch(logWriteError);
            });
          }
        }
        if (planChanged(before, opponent)) {
          pendingPlans.current.set(plan.id, plan);
          debouncer.schedule(`plan:${plan.id}`, () => {
            pendingPlans.current.delete(plan.id);
            void saveGroupPlan(uid, plan).catch(logWriteError);
          });
        }
      }
    },
    remove: (ids) => {
      if (!groupId || !uid) return;
      for (const id of ids) {
        const planId = groupPlanId(groupId, id);
        debouncer.cancel(`shared:${id}`);
        debouncer.cancel(`plan:${planId}`);
        pendingShared.current.delete(id);
        pendingPlans.current.delete(planId);
        void deleteGroupOpponent(groupId, id).catch(logWriteError);
        void deleteGroupPlan(uid, planId).catch(logWriteError);
      }
    },
  };

  const actions = useOpponentActions(opponents, setOpponents, store);
  const isLoading = !!groupId && loadedFor !== groupId && !error;

  return {
    opponents: groupId && loadedFor === groupId ? sortByListOrder(opponents) : [],
    isLoading,
    error,
    ...actions,
    /** Only whoever added an opponent, and the group's owner, may remove it. */
    canRemove: (opponent: Opponent) => !!group && canRemoveGroupOpponent(opponent, group, uid),
  };
}

function logWriteError(error: unknown) {
  console.error("[prep group] write failed:", error);
}
