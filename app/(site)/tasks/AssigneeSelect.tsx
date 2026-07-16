"use client";

import {
  TASK_ASSIGNEES,
  isKnownTaskAssignee,
  normalizeTaskAssignee,
} from "@/lib/tasksAssignees";

type Props = {
  value: string | null;
  onChange: (assignee: string | null) => void;
  className?: string;
  id?: string;
  /** When true, show a free-text field for custom assignee names. */
  allowCustom?: boolean;
};

/**
 * Assignee picker: Ann, Tim, Bot, unassigned, and optional custom name.
 */
export default function AssigneeSelect({
  value,
  onChange,
  className,
  id,
  allowCustom = true,
}: Props) {
  const normalized = normalizeTaskAssignee(value);
  const isCustom =
    allowCustom && normalized != null && !isKnownTaskAssignee(normalized);
  const selectValue =
    normalized == null ? "" : isKnownTaskAssignee(normalized) ? normalized : "__custom__";

  return (
    <div className="space-y-2">
      <select
        id={id}
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "") onChange(null);
          else if (v === "__custom__") {
            if (!isCustom) onChange("");
          } else onChange(v);
        }}
        className={className}
      >
        <option value="">Unassigned</option>
        {TASK_ASSIGNEES.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
        {allowCustom ? <option value="__custom__">Other…</option> : null}
      </select>
      {allowCustom && (selectValue === "__custom__" || isCustom) ? (
        <input
          type="text"
          value={isCustom ? normalized : value ?? ""}
          onChange={(e) => onChange(e.target.value.trim() || null)}
          placeholder="Custom assignee"
          className={className}
        />
      ) : null}
    </div>
  );
}

export function AssigneeBadge({ assignee }: { assignee: string | null }) {
  if (!assignee) return <>—</>;
  const normalized = normalizeTaskAssignee(assignee);
  const isBot = normalized?.toLowerCase() === "bot";
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      {isBot ? (
        <span
          className="neo-chip !min-h-0 !px-1.5 !py-0.5 text-[0.65rem] uppercase tracking-wide"
          title="Assigned to Bot"
        >
          Bot
        </span>
      ) : (
        <span className="neo-chip !min-h-0 !px-2 !py-0.5 text-xs font-medium">
          {normalized ?? assignee}
        </span>
      )}
    </span>
  );
}
