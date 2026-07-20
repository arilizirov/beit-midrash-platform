// Public surface of the taxonomy domain. Export ONLY what other
// domains may use. Everything else stays internal to this folder.
export {
  addTagToTopic,
  createCategory,
  createTag,
  createTopic,
  listTopics,
  removeTagFromTopic,
} from "./service";
export { MAX_CATEGORY_DEPTH, type TopicStatus } from "./model";
