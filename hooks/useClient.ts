import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function useClient() {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
