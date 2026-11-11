"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  deleteGroupOpponent,
  deleteGroupPlan,
  saveGroupOpponent,
  saveGroupPlan,
  subscribeGroupOpponents,
  subscribeGroupPlans,
  subscribeSharedPlans,
  saveSharedPlan,
  deleteSharedPlan,
  logTeamActivity,
} from "@/lib/firebase";
import { planActivity } from "@/lib/teamActivity";
import {
  canRemoveGroupOpponent,
  groupPlanId,
  mergeGroupOpponent,
  planChanged,
  sharedChanged,
  sharedPlanChanged,
  splitGroupOpponent,
  toSharedPlanDoc,
  withSharedPlan,
  withoutSharedPlan,
} from "@/lib/groupOpponents";
import { normalizeOpponent } from "@/lib/opponent";
import { publishOpponentToShares, removeOpponentsFromShares } from "@/lib/storage/db";
import { createKeyedDebouncer } from "@/lib/keyedDebounce";
import { useAuth } from "./useAuth";
import { sortByListOrder, useOpponentActions, type OpponentStore } from "./useOpponentActions";
import type {
  GroupPlanDoc,
  MatchupPlan,
  Opponent,
  PrepGroup,
  SharedOpponent,
  SharedPlanDoc,
} from "@/types";

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
 *
 * On a collaborative team's group (PrepGroup.teamId), that team's plan is
 * the one every member shares (`groups/{id}/plans`, see
 * docs/collaborative-teams.md); plans for your other teams stay private.
 */
export function useGroupOpponents(group: PrepGroup | null) {
  const { user } = useAuth();
  const groupId = group?.id ?? null;
  const teamId = group?.teamId ?? null;
  const uid = user?.uid ?? null;
  const [opponents, setOpponents] = useState<Opponent[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  // Keyed by group, so switching groups doesn't carry over the last one's error.
  const [failure, setFailure] = useState<{ groupId: string; error: Error } | null>(null);
  const error = failure && failure.groupId === groupId ? failure.error : null;

  const snapshot = useRef<{
    shared: SharedOpponent[];
    plans: GroupPlanDoc[];
    sharedPlans: SharedPlanDoc[];
  }>({ shared: [], plans: [], sharedPlans: [] });
  const pendingShared = useRef(new Map<string, SharedOpponent>());
  const pendingPlans = useRef(new Map<string, GroupPlanDoc>());
  const pendingSharedPlans = useRef(new Map<string, SharedPlanDoc>());
  // Each pending shared plan as it was before its first unsaved edit, for the team's activity log.
  const sharedPlansBefore = useRef(new Map<string, MatchupPlan | undefined>());
  const debouncer = useMemo(() => createKeyedDebouncer(WRITE_DELAY_MS), []);

  useEffect(() => {
    if (!groupId || !uid) return;
    let sharedReady = false;
    let plansReady = false;
    // Only a collaborative team's group has shared plans to wait for.
    let sharedPlansReady = !teamId;
    snapshot.current = { shared: [], plans: [], sharedPlans: [] };

    function publish() {
      if (!sharedReady || !plansReady || !sharedPlansReady) return;
      const shared = new Map(snapshot.current.shared.map((opponent) => [opponent.id, opponent]));
      pendingShared.current.forEach((opponent, id) => shared.set(id, opponent));
      const plans = new Map(snapshot.current.plans.map((plan) => [plan.opponentId, plan]));
      pendingPlans.current.forEach((plan) => plans.set(plan.opponentId, plan));
      const sharedPlans = new Map(
        snapshot.current.sharedPlans.map((plan) => [plan.opponentId, plan]),
      );
      pendingSharedPlans.current.forEach((plan, id) => sharedPlans.set(id, plan));
      setOpponents(
        [...shared.values()].map((opponent) => {
          const merged = mergeGroupOpponent(opponent, plans.get(opponent.id));
          return normalizeOpponent(
            teamId ? withSharedPlan(merged, teamId, sharedPlans.get(opponent.id)) : merged,
          );
        }),
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
    const stopSharedPlans = teamId
      ? subscribeSharedPlans(
          groupId,
          (sharedPlans) => {
            snapshot.current.sharedPlans = sharedPlans;
            sharedPlansReady = true;
            publish();
          },
          onError,
        )
      : () => {};
    return () => {
      stopShared();
      stopPlans();
      stopSharedPlans();
    };
  }, [groupId, teamId, uid]);

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
        // A collaborative team's plan is shared, not kept with your private ones.
        const { shared, plan } = splitGroupOpponent(
          teamId ? withoutSharedPlan(opponent, teamId) : opponent,
          groupId,
        );
        if (teamId && sharedPlanChanged(before, opponent, teamId)) {
          const by = { uid, name: user?.displayName ?? user?.email ?? "?" };
          const doc = toSharedPlanDoc(
            opponent.id,
            opponent.plansByTeamId[teamId],
            by,
            new Date().toISOString(),
          );
          pendingSharedPlans.current.set(opponent.id, doc);
          if (!sharedPlansBefore.current.has(opponent.id)) {
            sharedPlansBefore.current.set(opponent.id, before?.plansByTeamId[teamId]);
          }
          debouncer.schedule(`sharedPlan:${opponent.id}`, () => {
            pendingSharedPlans.current.delete(opponent.id);
            const previous = sharedPlansBefore.current.get(opponent.id);
            sharedPlansBefore.current.delete(opponent.id);
            void saveSharedPlan(groupId, doc).catch(logWriteError);
            void logTeamActivity(
              teamId,
              planActivity(opponent.id, opponent.label, previous, doc.plan),
              by,
            ).catch(logWriteError);
          });
        }
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
        if (
          planChanged(before && (teamId ? withoutSharedPlan(before, teamId) : before), {
            ...opponent,
            plansByTeamId: plan.plansByTeamId,
          })
        ) {
          pendingPlans.current.set(plan.id, plan);
          debouncer.schedule(`plan:${plan.id}`, () => {
            pendingPlans.current.delete(plan.id);
            void saveGroupPlan(uid, plan).catch(logWriteError);
          });
        }
        // Your shared teams' matchups follow it too (docs/full-share.md).
        debouncer.schedule(`share:${opponent.id}`, () => {
          void publishOpponentToShares(opponent).catch(logWriteError);
        });
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
        debouncer.cancel(`share:${id}`);
        debouncer.cancel(`sharedPlan:${id}`);
        pendingSharedPlans.current.delete(id);
        void deleteGroupOpponent(groupId, id).catch(logWriteError);
        void deleteGroupPlan(uid, planId).catch(logWriteError);
        if (teamId) void deleteSharedPlan(groupId, id).catch(logWriteError);
      }
      void removeOpponentsFromShares(ids).catch(logWriteError);
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
