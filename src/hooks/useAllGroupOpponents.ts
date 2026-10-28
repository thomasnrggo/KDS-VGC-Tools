"use client";

import { useEffect, useState } from "react";
import { subscribeGroupOpponents, subscribeGroupPlans } from "@/lib/firebase";
import { mergeGroupOpponent } from "@/lib/groupOpponents";
import { normalizeOpponent } from "@/lib/opponent";
import { sortByListOrder } from "./useOpponentActions";
import { useAuth } from "./useAuth";
import type { GroupPlanDoc, Opponent, PrepGroup, SharedOpponent } from "@/types";

/**
 * Every prep group's opponents at once, each with your private plan — read
 * only, for overviews like the Team Report's Matchups tab. (The Matchup
 * Planner edits one group at a time through useGroupOpponents.)
 */
export function useAllGroupOpponents(groups: PrepGroup[]) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const groupIds = groups.map((group) => group.id).join(",");
  const [loaded, setLoaded] = useState<{ key: string; byGroup: Record<string, Opponent[]> } | null>(
    null,
  );
  const key = `${uid}|${groupIds}`;

  useEffect(() => {
    if (!uid) return;
    const ids = groupIds ? groupIds.split(",") : [];
    const shared: Record<string, SharedOpponent[] | undefined> = {};
    const plans: Record<string, GroupPlanDoc[] | undefined> = {};

    function publish() {
      // Shown once every group has answered, so the list doesn't fill in piece by piece.
      if (ids.some((id) => !shared[id] || !plans[id])) return;
      const byGroup: Record<string, Opponent[]> = {};
      for (const id of ids) {
        const planFor = new Map(plans[id]!.map((plan) => [plan.opponentId, plan]));
        byGroup[id] = sortByListOrder(
          shared[id]!.map((opponent) =>
            normalizeOpponent(mergeGroupOpponent(opponent, planFor.get(opponent.id))),
          ),
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
    ]);
    return () => stops.forEach((stop) => stop());
  }, [uid, groupIds]);

  const current = loaded?.key === key ? loaded.byGroup : null;
  return {
    lists: groups.map((group) => ({ group, opponents: current?.[group.id] ?? [] })),
    isLoading: !!uid && !current,
  };
}
