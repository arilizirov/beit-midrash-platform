// Public surface of the files domain. Export ONLY what other
// domains may use. Everything else stays internal to this folder.
export {
  confirmUpload,
  downloadUrl,
  linkContent,
  listAttachments,
  startUpload,
} from "./service";
export { kindFor, MAX_BYTES } from "./model";
