import { ChevronRightIcon, MessageSquarePlusIcon, SendIcon, Trash2Icon } from "lucide-react";
import { type FormEvent, useState } from "react";

import { RelativeTime } from "~/components/RelativeTime";
import { cn } from "~/lib/utils";
import {
  buildTodoDelegationPrompt,
  type TodoItem,
  useProjectTodos,
  useTodoStore,
} from "~/todoStore";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { toastManager } from "../ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

export interface TodoPanelProps {
  readonly projectKey: string;
  /** Queues a message on this thread; absent until the thread has started. */
  readonly onDelegate: ((text: string) => Promise<void>) | undefined;
  /** Puts text in this thread's composer; returns false when the composer is busy. */
  readonly onAddToComposer: (text: string) => boolean;
}

/** The project's to-do list, shown as a right-panel surface. */
export function TodoPanel(props: TodoPanelProps) {
  const items = useProjectTodos(props.projectKey);
  const [draft, setDraft] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const doneCount = items.filter((item) => item.done).length;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    useTodoStore.getState().add(props.projectKey, draft);
    setDraft("");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="todo-panel">
      <form onSubmit={submit} className="flex shrink-0 gap-1.5 border-b border-border p-2">
        <Input
          size="sm"
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
          placeholder="Add a to-do…"
          aria-label="New to-do"
          className="min-w-0 flex-1"
        />
        <Button type="submit" size="sm" variant="outline" disabled={!draft.trim()}>
          Add
        </Button>
      </form>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-muted-foreground text-sm">
            No to-dos for this project yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <TodoRow
                key={item.id}
                item={item}
                projectKey={props.projectKey}
                expanded={expandedId === item.id}
                onToggleExpanded={() =>
                  setExpandedId((current) => (current === item.id ? null : item.id))
                }
                onDelegate={props.onDelegate}
                onAddToComposer={props.onAddToComposer}
              />
            ))}
          </ul>
        )}
      </div>
      {doneCount > 0 ? (
        <div className="flex shrink-0 justify-end border-t border-border p-1.5">
          <Button
            size="xs"
            variant="ghost-muted"
            onClick={() => useTodoStore.getState().clearDone(props.projectKey)}
          >
            Clear {doneCount} completed
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function TodoRow(props: {
  readonly item: TodoItem;
  readonly projectKey: string;
  readonly expanded: boolean;
  readonly onToggleExpanded: () => void;
  readonly onDelegate: TodoPanelProps["onDelegate"];
  readonly onAddToComposer: TodoPanelProps["onAddToComposer"];
}) {
  const { item, projectKey } = props;
  const [delegating, setDelegating] = useState(false);
  const update = (patch: Parameters<ReturnType<typeof useTodoStore.getState>["update"]>[2]) =>
    useTodoStore.getState().update(projectKey, item.id, patch);

  const delegate = async () => {
    if (!props.onDelegate || delegating) return;
    setDelegating(true);
    try {
      await props.onDelegate(buildTodoDelegationPrompt(item));
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
    if (!props.onAddToComposer(buildTodoDelegationPrompt(item))) {
      toastManager.add({
        type: "error",
        title: "Unable to add to chat",
        description: "The composer is busy; try again once it is ready.",
      });
    }
  };

  const delegateButton = (
    <Button
      size="icon-xs"
      variant="ghost-muted"
      aria-label="Delegate to orchestrator"
      disabled={!props.onDelegate || delegating}
      onClick={() => void delegate()}
    >
      <SendIcon />
    </Button>
  );

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
          className="flex min-w-0 flex-1 items-center gap-1 text-left"
          aria-expanded={props.expanded}
          onClick={props.onToggleExpanded}
        >
          <ChevronRightIcon
            className={cn("size-3.5 shrink-0 text-muted-foreground", props.expanded && "rotate-90")}
          />
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
            {delegateButton}
          </TooltipTrigger>
          <TooltipPopup side="left">
            {props.onDelegate
              ? "Send to this thread's agent to delegate"
              : "Send a first message to start this thread, then delegate"}
          </TooltipPopup>
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
          {item.delegatedAt ? (
            <p className="text-muted-foreground text-xs">
              Delegated <RelativeTime timestamp={item.delegatedAt} />
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              size="xs"
              variant="outline"
              disabled={!props.onDelegate || delegating}
              onClick={() => void delegate()}
            >
              <SendIcon />
              {item.delegatedAt ? "Delegate again" : "Delegate to orchestrator"}
            </Button>
            <Button size="xs" variant="ghost-muted" onClick={addToComposer}>
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
