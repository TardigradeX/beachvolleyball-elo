import { writable } from "svelte/store";

type SnackbarType = "success" | "error" | "info";

interface SnackbarMessage {
  id: number;
  text: string;
  type: SnackbarType;
}

export const snackbarMessages = writable<SnackbarMessage[]>([]);

let nextId = 0;

export function showSnackbar(text: string, type: SnackbarType = "info", durationMs = 4000) {
  const id = nextId++;
  snackbarMessages.update((msgs) => [...msgs, { id, text, type }]);
  setTimeout(() => {
    snackbarMessages.update((msgs) => msgs.filter((m) => m.id !== id));
  }, durationMs);
}
