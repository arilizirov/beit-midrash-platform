// Public surface of the content domain. Export ONLY what other domains may
// use; everything else stays internal to this folder.
export {
  addNote,
  canEditNote,
  deleteNote,
  getNote,
  listNotes,
  updateNote,
  type NoteVisibility,
} from "./service";
