export { firebaseApp } from "./config";
export { getFirebaseAnalytics } from "./analytics";
export { auth, signInWithGoogle, signOutUser } from "./auth";
export { db } from "./firestore";
export { createCollectionSync, pushMetaDoc, pullMetaDoc, type SyncableRecord } from "./cloudSync";
export { getSeasons, saveSeason, deleteSeason } from "./seasons";
export { getMeta, getMetaTournament } from "./meta";
export { getPublicSets, savePublicSet, deletePublicSet } from "./publicSets";
export { getFeatureFlags, saveFeatureFlags } from "./featureFlags";
export { getLearnsetOverrides, saveLearnsetOverride } from "./learnsetOverrides";
export { publishSharedTeam, unpublishSharedTeam, getSharedTeam } from "./sharedTeams";
export {
  createGroup,
  renameGroup,
  setGroupArchived,
  resetInviteCode,
  getInvite,
  joinGroup,
  removeGroupMember,
  subscribeMyGroups,
  subscribeGroupOpponents,
  subscribeGroupPlans,
  saveGroupOpponent,
  deleteGroupOpponent,
  saveGroupPlan,
  deleteGroupPlan,
} from "./groups";
