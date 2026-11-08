import {
  ArrowLeftIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ListTodoIcon,
  MessageSquarePlusIcon,
  SendIcon,
  SettingsIcon,
  Trash2Icon,
} from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";

import { RelativeTime } from "~/components/RelativeTime";
import { cn } from "~/lib/utils";
import type { SidebarProjectSnapshot } from "~/sidebarProjectGrouping";
import {
  buildTodoDelegationPrompt,
  type TodoItem,
  type TodoPatch,
  type TodoThreadTarget,
  todoProjectKey,
  useTodoMenuStore,
  useTodoStore,
} from "~/todoStore";
import { ProjectFavicon } from "../ProjectFavicon";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import { SidebarMenuButton } from "../ui/sidebar";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";
import { toastManager } from "../ui/toast";
import { Toggle, ToggleGroup } from "../ui/toggle-group";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

type TodoScope = "project" | "all";

interface TodoEntry {
  readonly projectKey: string;
  readonly item: TodoItem;
  readonly project: SidebarProjectSnapshot | null;
}

/** The to-do button under the sidebar's search, opening the list as a popover. */
export function SidebarTodoMenu(props: {
  readonly projectGroups: ReadonlyArray<SidebarProjectSnapshot>;
}) {
  const open = useTodoMenuStore((state) => state.open);
  const target = useTodoMenuStore((state) => state.target);
  const byProjectKey = useTodoStore((state) => state.byProjectKey);
  const settings = useTodoStore((state) => state.settings);
  const [scope, setScope] = useState<TodoScope>(settings.defaultScope);
  const [view, setView] = useState<"list" | "settings">("list");
  const [draft, setDraft] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // A to-do key names one project in one environment; the sidebar may group
  // several of those (scratch folders, the same repo on two machines) as one.
  const projectByKey = new Map<string, SidebarProjectSnapshot>();
  for (const group of props.projectGroups) {
    for (const member of group.memberProjects) {
      projectByKey.set(todoProjectKey(member.environmentId, member.id), group);
    }
  }
  const currentProject = target ? (projectByKey.get(target.projectKey) ?? null) : null;
  const isCurrentProject = (key: string) =>
    target !== null &&
    (key === target.projectKey ||
      (currentProject !== null && projectByKey.get(key) === currentProject));

  const entries: TodoEntry[] = Object.entries(byProjectKey).flatMap(([projectKey, items]) =>
    items.map((item) => ({ projectKey, item, project: projectByKey.get(projectKey) ?? null })),
  );
  const projectEntries = entries.filter((entry) => isCurrentProject(entry.projectKey));
  const effectiveScope: TodoScope = target === null ? "all" : scope;
  const scoped = effectiveScope === "project" ? projectEntries : entries;
  const visible = settings.showCompleted ? scoped : scoped.filter((entry) => !entry.item.done);
  const doneEntries = scoped.filter((entry) => entry.item.done);
  const badgeCount = (target === null ? entries : projectEntries).filter(
    (entry) => !entry.item.done,
  ).length;

  const setOpen = (next: boolean) => {
    if (next) {
      setScope(settings.defaultScope);
      setView("list");
    }
    useTodoMenuStore.getState().setOpen(next);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!target || !draft.trim()) return;
    useTodoStore.getState().add(target.projectKey, draft);
    setDraft("");
  };

  const clearCompleted = () => {
    const store = useTodoStore.getState();
    for (const key of new Set(doneEntries.map((entry) => entry.projectKey))) store.clearDone(key);
  };

  const projectName = currentProject?.displayName ?? "this project";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        data-testid="sidebar-todos-trigger"
        render={<SidebarMenuButton isActive={open} className="mt-0.5" />}
      >
        <ListTodoIcon />
        <span className="min-w-0 flex-1">To-dos</span>
        {settings.badge === "open" && badgeCount > 0 ? (
          <span
            className="shrink-0 rounded-full bg-accent px-1.5 text-2xs text-foreground tabular-nums"
            aria-label={`${badgeCount} open`}
          >
            {badgeCount}
          </span>
        ) : null}
        <ChevronDownIcon className="size-3.5 shrink-0 opacity-70" />
      </PopoverTrigger>
      <PopoverPopup
        align="start"
        padding="none"
        className="w-[22rem] max-w-[calc(100vw-1rem)]"
        data-testid="sidebar-todos-popup"
      >
        {view === "settings" ? (
          <TodoMenuSettings onBack={() => setView("list")} />
        ) : (
          <div className="flex max-h-[min(32rem,70vh)] flex-col">
            <div className="flex shrink-0 items-center gap-1.5 p-2 pb-1.5">
              <ToggleGroup
                aria-label="Which to-dos to show"
                variant="segmented"
                className="min-w-0 flex-1"
                value={[effectiveScope]}
                onValueChange={(value) => {
                  const next = value[0];
                  if (next === "project" || next === "all") setScope(next);
                }}
              >
                <Toggle value="project" className="flex-1" disabled={target === null}>
                  This project
                </Toggle>
                <Toggle value="all" className="flex-1">
                  All projects
                </Toggle>
              </ToggleGroup>
              <Button
                size="icon-xs"
                variant="ghost-muted"
                aria-label="To-do settings"
                onClick={() => setView("settings")}
              >
                <SettingsIcon />
              </Button>
            </div>
            <form onSubmit={submit} className="flex shrink-0 gap-1.5 px-2 pb-2">
              <Input
                size="sm"
                value={draft}
                disabled={target === null}
                onChange={(event) => setDraft(event.currentTarget.value)}
                placeholder={
                  target === null
                    ? "Open a thread to add to-dos"
                    : effectiveScope === "all"
                      ? `Add to ${projectName}…`
                      : "Add a to-do…"
                }
                aria-label="New to-do"
                className="min-w-0 flex-1"
              />
              <Button type="submit" size="sm" variant="outline" disabled={!target || !draft.trim()}>
                Add
              </Button>
            </form>
            <div className="min-h-0 flex-1 overflow-y-auto border-t border-border">
              {visible.length === 0 ? (
                <p className="px-4 py-6 text-center text-muted-foreground text-sm">
                  {scoped.length > 0
                    ? "Everything here is done."
                    : effectiveScope === "project"
                      ? `No to-dos for ${projectName} yet.`
                      : "No to-dos yet."}
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {visible.map((entry) => (
                    <TodoRow
                      key={entry.item.id}
                      item={entry.item}
                      projectKey={entry.projectKey}
                      leading={
                        effectiveScope === "all" && entry.project ? (
                          <ProjectFavicon project={entry.project} className="size-3.5 shrink-0" />
                        ) : null
                      }
                      projectLabel={
                        effectiveScope === "all" ? entry.project?.displayName : undefined
                      }
                      expanded={expandedId === entry.item.id}
                      onToggleExpanded={() =>
                        setExpandedId((current) =>
                          current === entry.item.id ? null : entry.item.id,
                        )
                      }
                      target={target}
                      inTargetProject={isCurrentProject(entry.projectKey)}
                      targetProjectName={entry.project?.displayName ?? "its project"}
                    />
                  ))}
                </ul>
              )}
            </div>
            {doneEntries.length > 0 ? (
              <div className="flex shrink-0 items-center justify-between border-t border-border px-2 py-1.5 text-muted-foreground text-xs">
                <span>{doneEntries.length} done</span>
                <Button size="xs" variant="ghost-muted" onClick={clearCompleted}>
                  Clear completed
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </PopoverPopup>
    </Popover>
  );
}

function TodoMenuSettings(props: { readonly onBack: () => void }) {
  const settings = useTodoStore((state) => state.settings);
  const setSettings = useTodoStore((state) => state.setSettings);
  return (
    <div className="flex flex-col p-2" data-testid="sidebar-todos-settings">
      <div className="flex items-center gap-1.5 pb-1.5">
        <Button
          size="icon-xs"
          variant="ghost-muted"
          aria-label="Back to to-dos"
          onClick={props.onBack}
        >
          <ArrowLeftIcon />
        </Button>
        <span className="font-medium text-sm">To-do settings</span>
      </div>
      <div className="flex flex-col divide-y divide-border text-sm">
        <div className="flex items-center justify-between gap-3 py-2">
          <span>Open on</span>
          <ToggleGroup
            aria-label="Tab the menu opens on"
            variant="segmented"
            value={[settings.defaultScope]}
            onValueChange={(value) => {
              const next = value[0];
              if (next === "project" || next === "all") setSettings({ defaultScope: next });
            }}
          >
            <Toggle value="project">This project</Toggle>
            <Toggle value="all">All projects</Toggle>
          </ToggleGroup>
        </div>
        <label className="flex items-center justify-between gap-3 py-2">
          <span>Show completed</span>
          <Switch
            size="sm"
            checked={settings.showCompleted}
            onCheckedChange={(checked) => setSettings({ showCompleted: checked })}
          />
        </label>
        <label className="flex items-center justify-between gap-3 py-2">
          <span>Count open to-dos on the button</span>
          <Switch
            size="sm"
            checked={settings.badge === "open"}
            onCheckedChange={(checked) => setSettings({ badge: checked ? "open" : "none" })}
          />
        </label>
      </div>
    </div>
  );
}

function TodoRow(props: {
  readonly item: TodoItem;
  readonly projectKey: string;
  readonly leading: ReactNode;
  readonly projectLabel: string | undefined;
  readonly expanded: boolean;
  readonly onToggleExpanded: () => void;
  readonly target: TodoThreadTarget | null;
  readonly inTargetProject: boolean;
  readonly targetProjectName: string;
}) {
  const { item, projectKey, target } = props;
  const [delegating, setDelegating] = useState(false);
  const update = (patch: TodoPatch) => useTodoStore.getState().update(projectKey, item.id, patch);
  const onDelegate = props.inTargetProject ? target?.onDelegate : undefined;
  const delegateHint =
    target === null
      ? "Open a thread to delegate"
      : !props.inTargetProject
        ? `Open a thread in ${props.targetProjectName} to delegate`
        : onDelegate
          ? "Send to this thread's agent to delegate"
          : "Send a first message to start this thread, then delegate";

  const delegate = async () => {
    if (!onDelegate || delegating) return;
    setDelegating(true);
    try {
      await onDelegate(buildTodoDelegationPrompt(item));
      update({ delegatedAt: new Date().toISOString() });
      toastManager.add({ type: "success", title: "Sent to the agent to delegate" });
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Could not delegate this to-do",
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setDelegating(false);
    }
  };

  const addToComposer = () => {
    if (!target?.onAddToComposer(buildTodoDelegationPrompt(item))) {
      toastManager.add({
        type: "error",
        title: "Unable to add to chat",
        description: "The composer is busy; try again once it is ready.",
      });
    }
  };

  return (
    <li data-testid="todo-row" data-done={item.done || undefined}>
      <div className="flex items-center gap-2 px-2 py-1.5">
        <Checkbox
          checked={item.done}
          onCheckedChange={(checked) => update({ done: checked === true })}
          aria-label={item.done ? "Mark not done" : "Mark done"}
        />
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          aria-expanded={props.expanded}
          onClick={props.onToggleExpanded}
        >
          <ChevronRightIcon
            className={cn("size-3.5 shrink-0 text-muted-foreground", props.expanded && "rotate-90")}
          />
          {props.leading}
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-sm",
              item.done && "text-muted-foreground line-through",
            )}
          >
            {item.title}
          </span>
          {item.notes.trim() && !props.expanded ? (
            <span className="shrink-0 text-muted-foreground text-xs">notes</span>
          ) : null}
        </button>
        {item.delegatedAt ? (
          <span className="shrink-0 rounded-sm bg-accent px-1.5 text-2xs text-muted-foreground">
            Delegated
          </span>
        ) : null}
        <Tooltip>
          <TooltipTrigger render={<span className="inline-flex" />}>
            <Button
              size="icon-xs"
              variant="ghost-muted"
              aria-label="Delegate to orchestrator"
              disabled={!onDelegate || delegating}
              onClick={() => void delegate()}
            >
              <SendIcon />
            </Button>
          </TooltipTrigger>
          <TooltipPopup side="right">{delegateHint}</TooltipPopup>
        </Tooltip>
      </div>
      {props.expanded ? (
        <div className="flex flex-col gap-2 px-3 pt-0.5 pb-3 pl-8">
          <Input
            size="sm"
            defaultValue={item.title}
            aria-label="To-do title"
            onBlur={(event) => {
              const title = event.currentTarget.value.trim();
              if (title && title !== item.title) update({ title });
              else event.currentTarget.value = item.title;
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
          />
          <Textarea
            size="sm"
            value={item.notes}
            aria-label="To-do details"
            placeholder="Details, acceptance criteria, links…"
            onChange={(event) => update({ notes: event.currentTarget.value })}
          />
          {props.projectLabel ? (
            <p className="text-muted-foreground text-xs">Project: {props.projectLabel}</p>
          ) : null}
          {item.delegatedAt ? (
            <p className="text-muted-foreground text-xs">
              Delegated <RelativeTime timestamp={item.delegatedAt} />
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              size="xs"
              variant="outline"
              disabled={!onDelegate || delegating}
              onClick={() => void delegate()}
            >
              <SendIcon />
              {item.delegatedAt ? "Delegate again" : "Delegate to orchestrator"}
            </Button>
            <Button
              size="xs"
              variant="ghost-muted"
              disabled={target === null}
              onClick={addToComposer}
            >
              <MessageSquarePlusIcon />
              Add to composer
            </Button>
            <Button
              size="xs"
              variant="ghost-destructive"
              className="ml-auto"
              onClick={() => useTodoStore.getState().remove(projectKey, item.id)}
            >
              <Trash2Icon />
              Delete
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
