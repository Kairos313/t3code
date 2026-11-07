/**
 * The right panel's to-do list, kept per project so every thread in a
 * project shares one list. It lives in this client's storage only.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { resolveStorage } from "./lib/storage";
import { randomUUID } from "./lib/utils";

export interface TodoItem {
  readonly id: string;
  readonly title: string;
  readonly notes: string;
  readonly done: boolean;
  readonly createdAt: string;
  /** When the item was last handed to a thread's agent to delegate. */
  readonly delegatedAt?: string;
}

export type TodoPatch = Partial<Pick<TodoItem, "title" | "notes" | "done" | "delegatedAt">>;

const TODO_STORAGE_KEY = "t3code:todos:v1";
const EMPTY_TODOS: ReadonlyArray<TodoItem> = [];

interface TodoStoreState {
  byProjectKey: Record<string, ReadonlyArray<TodoItem>>;
  add: (projectKey: string, title: string) => void;
  update: (projectKey: string, id: string, patch: TodoPatch) => void;
  remove: (projectKey: string, id: string) => void;
  clearDone: (projectKey: string) => void;
}

export function todoProjectKey(environmentId: string, projectId: string): string {
  return `${environmentId}:${projectId}`;
}

/** The message a thread's agent receives when the user delegates a to-do. */
export function buildTodoDelegationPrompt(item: Pick<TodoItem, "title" | "notes">): string {
  const notes = item.notes.trim();
  return [
    "Delegate this to-do from my T3 Code to-do list. Hand it to a subagent through the T3 orchestrator (`delegate_task`), keep track of the task it returns, and report back here with the outcome.",
    "",
    `To-do: ${item.title.trim()}`,
    ...(notes ? ["", "Details:", notes] : []),
  ].join("\n");
}

const updateList = (
  state: TodoStoreState,
  projectKey: string,
  updater: (items: ReadonlyArray<TodoItem>) => ReadonlyArray<TodoItem>,
): Partial<TodoStoreState> => {
  const current = state.byProjectKey[projectKey] ?? EMPTY_TODOS;
  const next = updater(current);
  if (next === current) return {};
  const byProjectKey = { ...state.byProjectKey };
  if (next.length === 0) delete byProjectKey[projectKey];
  else byProjectKey[projectKey] = next;
  return { byProjectKey };
};

export const useTodoStore = create<TodoStoreState>()(
  persist(
    (set) => ({
      byProjectKey: {},
      add: (projectKey, title) => {
        const trimmed = title.trim();
        if (!trimmed) return;
        set((state) =>
          updateList(state, projectKey, (items) => [
            ...items,
            {
              id: randomUUID(),
              title: trimmed,
              notes: "",
              done: false,
              createdAt: new Date().toISOString(),
            },
          ]),
        );
      },
      update: (projectKey, id, patch) =>
        set((state) =>
          updateList(state, projectKey, (items) =>
            items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
          ),
        ),
      remove: (projectKey, id) =>
        set((state) =>
          updateList(state, projectKey, (items) => items.filter((item) => item.id !== id)),
        ),
      clearDone: (projectKey) =>
        set((state) =>
          updateList(state, projectKey, (items) =>
            items.some((item) => item.done) ? items.filter((item) => !item.done) : items,
          ),
        ),
    }),
    {
      name: TODO_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() =>
        resolveStorage(typeof window !== "undefined" ? window.localStorage : undefined),
      ),
      partialize: (state) => ({ byProjectKey: state.byProjectKey }),
    },
  ),
);

export function useProjectTodos(projectKey: string): ReadonlyArray<TodoItem> {
  return useTodoStore((state) => state.byProjectKey[projectKey] ?? EMPTY_TODOS);
}
