/** Global sync-status observable — used by SyncManager to broadcast state,
 *  consumed by the SyncIndicator badge in the UI. */

type SyncState = "idle" | "syncing" | "synced" | "error" | "offline";

type Listener = (state: SyncState) => void;

let _state: SyncState = "idle";
const _listeners = new Set<Listener>();

export const syncStatus = {
  get: () => _state,
  set: (next: SyncState) => {
    if (next === _state) return;
    _state = next;
    _listeners.forEach((fn) => fn(next));
  },
  subscribe: (fn: Listener) => {
    _listeners.add(fn);
    return () => { _listeners.delete(fn); };
  },
};
