"use client";

import { useEffect, useState } from "react";
import { subscribeGroupOpponents, subscribeGroupPlans, subscribeSharedPlans } from "@/lib/firebase";
import { mergeGroupOpponent, withSharedPlan } from "@/lib/groupOpponents";
import { normalizeOpponent } from "@/lib/opponent";
import { sortByListOrder } from "./useOpponentActions";
import { useAuth } from "./useAuth";
import type { GroupPlanDoc, Opponent, PrepGroup, SharedOpponent, SharedPlanDoc } from "@/types";

/**
 * Every prep group's opponents at once, each with your private plan — read
 * only, for overviews like the Team Report's Matchups tab. (The Matchup
 * Planner edits one group at a time through useGroupOpponents.) A
 * collaborative team's group shows that team's shared plan.
 */
export function useAllGroupOpponents(groups: PrepGroup[]) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  // Each group's id, and the team id of a collaborative team's group ("id:teamId").
  const groupIds = groups
    .map((group) => (group.teamId ? `${group.id}:${group.teamId}` : group.id))
    .join(",");
  const [loaded, setLoaded] = useState<{ key: string; byGroup: Record<string, Opponent[]> } | null>(
    null,
  );
  const key = `${uid}|${groupIds}`;

  useEffect(() => {
    if (!uid) return;
    const entries = groupIds ? groupIds.split(",").map((entry) => entry.split(":")) : [];
    const ids = entries.map(([id]) => id);
    const teamIdOf = Object.fromEntries(entries.map(([id, teamId]) => [id, teamId]));
    const shared: Record<string, SharedOpponent[] | undefined> = {};
    const plans: Record<string, GroupPlanDoc[] | undefined> = {};
    const sharedPlans: Record<string, SharedPlanDoc[] | undefined> = {};

    function publish() {
      // Shown once every group has answered, so the list doesn't fill in piece by piece.
      if (ids.some((id) => !shared[id] || !plans[id] || (teamIdOf[id] && !sharedPlans[id]))) {
        return;
      }
      const byGroup: Record<string, Opponent[]> = {};
      for (const id of ids) {
        const planFor = new Map(plans[id]!.map((plan) => [plan.opponentId, plan]));
        const sharedPlanFor = new Map((sharedPlans[id] ?? []).map((p) => [p.opponentId, p]));
        const teamId = teamIdOf[id];
        byGroup[id] = sortByListOrder(
          shared[id]!.map((opponent) => {
            const merged = mergeGroupOpponent(opponent, planFor.get(opponent.id));
            return normalizeOpponent(
              teamId ? withSharedPlan(merged, teamId, sharedPlanFor.get(opponent.id)) : merged,
            );
          }),
        );
      }
      setLoaded({ key: `${uid}|${groupIds}`, byGroup });
    }

    if (ids.length === 0) {
      publish();
      return;
    }
    const onError = (error: Error) => console.error("[prep group] listener failed:", error);
    const stops = ids.flatMap((id) => [
      subscribeGroupOpponents(
        id,
        (list) => {
          shared[id] = list;
          publish();
        },
        onError,
      ),
      subscribeGroupPlans(
        uid,
        id,
        (list) => {
          plans[id] = list;
          publish();
        },
        onError,
      ),
      ...(teamIdOf[id]
        ? [
            subscribeSharedPlans(
              id,
              (list) => {
                sharedPlans[id] = list;
                publish();
              },
              onError,
            ),
          ]
        : []),
    ]);
    return () => stops.forEach((stop) => stop());
  }, [uid, groupIds]);

  const current = loaded?.key === key ? loaded.byGroup : null;
  return {
    lists: groups.map((group) => ({ group, opponents: current?.[group.id] ?? [] })),
    isLoading: !!uid && !current,
  };
}
