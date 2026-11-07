import { beforeEach, describe, expect, it } from "vite-plus/test";

import { buildTodoDelegationPrompt, useTodoStore } from "./todoStore";

const KEY = "env-1:project-1";
const items = () => useTodoStore.getState().byProjectKey[KEY] ?? [];

describe("todoStore", () => {
  beforeEach(() => {
    useTodoStore.setState({ byProjectKey: {} });
  });

  it("keeps a separate list per project and ignores blank titles", () => {
    const store = useTodoStore.getState();
    store.add(KEY, "  Write tests  ");
    store.add(KEY, "   ");
    store.add("env-1:project-2", "Other project");

    expect(items().map((item) => item.title)).toEqual(["Write tests"]);
    expect(useTodoStore.getState().byProjectKey["env-1:project-2"]).toHaveLength(1);
  });

  it("updates, clears completed and drops an emptied project", () => {
    const store = useTodoStore.getState();
    store.add(KEY, "First");
    store.add(KEY, "Second");
    const [first, second] = items();
    store.update(KEY, first!.id, { done: true, notes: "done" });
    store.clearDone(KEY);

    expect(items().map((item) => item.id)).toEqual([second!.id]);
    store.remove(KEY, second!.id);
    expect(KEY in useTodoStore.getState().byProjectKey).toBe(false);
  });
});

describe("buildTodoDelegationPrompt", () => {
  it("asks the agent to delegate through the orchestrator and carries the details", () => {
    const prompt = buildTodoDelegationPrompt({ title: " Fix login ", notes: "Repro: tap twice\n" });
    expect(prompt).toContain("`delegate_task`");
    expect(prompt).toContain("To-do: Fix login");
    expect(prompt.endsWith("Details:\nRepro: tap twice")).toBe(true);
  });

  it("omits the details section when there are no notes", () => {
    expect(buildTodoDelegationPrompt({ title: "Ship", notes: "  " })).not.toContain("Details:");
  });
});
