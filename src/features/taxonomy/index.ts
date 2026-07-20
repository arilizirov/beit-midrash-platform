// Public surface of the taxonomy domain. Export ONLY what other
// domains may use. Everything else stays internal to this folder.
export {
  addTagToTopic,
  createCategory,
  createTag,
  createTopic,
  listTopics,
  removeTagFromTopic,
  MAX_CATEGORY_DEPTH,
  type TopicStatus,
} from "./service";
