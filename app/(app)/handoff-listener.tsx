"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { HandWaving, X } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";

type Alert = { conversationId: string };

// Avisa al dueño (vía Supabase Realtime) cuando una conversación pasa a requerir atención humana.
// TODO: complementar con notificaciones por email / push.
export function HandoffListener({
  organizationId,
  initialInactiveIds,
}: {
  organizationId: string;
  initialInactiveIds: string[];
}) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const inactive = useRef(new Set(initialInactiveIds));

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`handoffs:${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          const row = payload.new as { id: string; bot_active: boolean | null };
          if (row.bot_active === false && !inactive.current.has(row.id)) {
            inactive.current.add(row.id);
            setAlerts((prev) => [...prev, { conversationId: row.id }]);
          } else if (row.bot_active) {
            inactive.current.delete(row.id);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId]);

  if (alerts.length === 0) return null;

  return (
    <div aria-live="polite" className="fixed right-4 bottom-4 z-50 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
      {alerts.map((alert) => (
        <div
          key={alert.conversationId}
          className="flex items-start gap-3 rounded-xl border border-amber/30 bg-amber-soft p-4 text-sm text-ink shadow-lg shadow-amber/10"
        >
          <HandWaving size={22} weight="fill" className="mt-0.5 shrink-0 text-amber" />
          <div className="flex-1">
            <p className="font-medium">Un cliente necesita hablar con una persona</p>
            <Link
              href={`/conversaciones/${alert.conversationId}`}
              onClick={() => setAlerts((prev) => prev.filter((a) => a !== alert))}
              className="mt-1 inline-block font-medium text-amber underline underline-offset-4"
            >
              Abrir conversación
            </Link>
          </div>
          <button
            type="button"
            onClick={() => setAlerts((prev) => prev.filter((a) => a !== alert))}
            className="rounded p-1 text-ink-soft hover:text-ink"
          >
            <X size={16} />
            <span className="sr-only">Cerrar aviso</span>
          </button>
        </div>
      ))}
    </div>
  );
}
