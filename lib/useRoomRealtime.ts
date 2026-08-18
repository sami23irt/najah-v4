"use client";

import { useEffect, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase-client";

export type TimerState = { phase: "focus" | "break" | "paused"; endsAt: string | null };
export type RoomMessage = { id: number; body: string; created_at: string; user_id: string; pseudonym: string | null; show_pseudonym: boolean };
export type PresenceEntry = { userId: string; name: string };

/**
 * Supabase Realtime replaces the old dedicated Socket.io server: broadcast
 * for chat + timer events, presence for join/leave — no separate WS server
 * process needed, consistent with the rest of the app being on Next.js/Vercel.
 */
export function useRoomRealtime(roomId: number | undefined, userId: string | undefined, displayName: string) {
  const supabase = createBrowserSupabaseClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [connected, setConnected] = useState(false);
  const [timer, setTimer] = useState<TimerState>({ phase: "paused", endsAt: null });
  const [liveMessages, setLiveMessages] = useState<RoomMessage[]>([]);
  const [presence, setPresence] = useState<PresenceEntry[]>([]);

  useEffect(() => {
    if (!roomId || !userId) return;
    const channel = supabase.channel(`room:${roomId}`, { config: { private: true, presence: { key: userId } } });
    channelRef.current = channel;

    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "room_messages",
          filter: `room_id=eq.${roomId}`,
        },
        ({ new: row }) => {
          const message: RoomMessage = {
            id: row.id,
            body: row.body,
            created_at: row.created_at,
            user_id: row.user_id,
            pseudonym: null,
            show_pseudonym: false,
          };
          setLiveMessages(current =>
            current.some(m => m.id === message.id) ? current : [message, ...current].slice(0, 60)
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "study_rooms",
          filter: `id=eq.${roomId}`,
        },
        ({ new: row }) => {
          setTimer({ phase: row.timer_phase, endsAt: row.timer_ends_at });
        }
      )
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceEntry>();
        setPresence(Object.values(state).flat());
      });

    let disposed = false;
    void supabase.realtime.setAuth().then(() => {
      if (disposed) return;
      channel.subscribe(async status => {
        if (status === "SUBSCRIBED") {
          await channel.track({ userId, name: displayName });
          setConnected(true);
        }
      });
    });

    return () => {
      disposed = true;
      void channel.unsubscribe();
      channelRef.current = null;
      setConnected(false);
    };
  }, [roomId, userId, displayName]);

  return {
    connected,
    timer,
    liveMessages,
    presence,
    syncTimer: (next: TimerState) => {
      setTimer(next); // optimistic local update; persisted DB state is the source of truth
    },
  };
}
