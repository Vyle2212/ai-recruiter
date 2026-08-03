"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type {
  RecruiterWorkflowNotificationFeed,
} from "@/lib/recruiterWorkflowNotifications";

export type WorkflowNotificationBadgeProps = {
  compact?: boolean;
  showCritical?: boolean;
  className?: string;
};

export function WorkflowNotificationBadge({
  compact = false,
  showCritical = true,
  className = "",
}: WorkflowNotificationBadgeProps) {
  const [data, setData] =
    useState<RecruiterWorkflowNotificationFeed | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(false);

  useEffect(() => {
    const controller =
      new AbortController();

    async function load() {
      setLoading(true);
      setError(false);

      try {
        const response = await fetch(
          "/api/recruiter/workflow/notifications?limit=100&includeHealthy=false",
          {
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error(
            "Unable to load workflow notification count",
          );
        }

        const result =
          await response.json();

        setData(result);
      } catch (loadError) {
        if (
          loadError instanceof Error &&
          loadError.name === "AbortError"
        ) {
          return;
        }

        setError(true);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    load();

    return () =>
      controller.abort();
  }, []);

  const total =
    data?.summary.unread || 0;

  const critical =
    data?.summary.critical || 0;

  const hasCritical =
    critical > 0;

  const tone =
    hasCritical
      ? "border-red-500/30 bg-red-500/10 text-red-100"
      : total > 0
        ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
        : "border-slate-700 bg-slate-900 text-slate-300";

  if (loading) {
    return (
      <span
        className={`inline-flex items-center rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-500 ${className}`}
      >
        Notifications…
      </span>
    );
  }

  if (error) {
    return (
      <Link
        className={`inline-flex items-center rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-400 ${className}`}
        href="/recruiter/workflow/notifications"
      >
        Notifications
      </Link>
    );
  }

  if (compact) {
    return (
      <Link
        aria-label={`${total} workflow notifications`}
        className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold ${tone} ${className}`}
        href="/recruiter/workflow/notifications"
      >
        <span>Notifications</span>

        <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px]">
          {total}
        </span>
      </Link>
    );
  }

  return (
    <Link
      className={`inline-flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold ${tone} ${className}`}
      href="/recruiter/workflow/notifications"
    >
      <span>Notifications</span>

      <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px]">
        {total}
      </span>

      {showCritical && critical > 0 ? (
        <span className="text-[10px] font-bold uppercase tracking-[0.08em]">
          Critical {critical}
        </span>
      ) : null}
    </Link>
  );
}