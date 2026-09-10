import { useState, useEffect } from "react";

const TOAST_TIMEOUT = 3000;

let memoryState = [];
let listeners = [];

export function toast({ title, description, variant = "default" }) {
  const id = Math.random().toString(36).slice(2, 9);
  const newToast = { id, title, description, variant };
  memoryState = [...memoryState, newToast];
  listeners.forEach((listener) => listener(memoryState));

  setTimeout(() => {
    memoryState = memoryState.filter((t) => t.id !== id);
    listeners.forEach((listener) => listener(memoryState));
  }, TOAST_TIMEOUT);
}

export function useToast() {
  const [toasts, setToasts] = useState(memoryState);

  useEffect(() => {
    listeners.push(setToasts);
    return () => {
      listeners = listeners.filter((l) => l !== setToasts);
    };
  }, []);

  return { toasts };
}
