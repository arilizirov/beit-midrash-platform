// Public surface of the discussions domain. Export ONLY what other
// domains may use. Everything else stays internal to this folder.
export {
  addContribution,
  addSummary,
  canEditContribution,
  createDiscussion,
  listContributions,
  listDiscussions,
  listSummaries,
  setDiscussionStatus,
  type ContributionStatus,
  type DiscussionStatus,
} from "./service";
