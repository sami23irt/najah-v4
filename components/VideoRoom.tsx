"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  LiveKitRoom,
  VideoConference,
  useLocalParticipant,
  useRoomContext,
} from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import "@livekit/components-styles";

type TokenResponse = { token: string; livekitUrl: string; roomName: string };

/**
 * Video/audio study room, backed by LiveKit — this is what section 3.5 of the
 * project doc ("غرف المذاكرة المرئية المباشرة") describes and what the
 * previous implementation completely lacked (it only had text chat).
 *
 * <VideoConference /> from @livekit/components-react already gives us:
 * grid layout, per-participant mute state, screen share tiles, and
 * independent camera/mic toggles — matching the "التصميم المقترح" column
 * in the doc's functional table without hand-rolling WebRTC.
 */
export function VideoRoom({ roomId, focusPhase }: { roomId: number; focusPhase: "focus" | "break" | "paused" }) {
  const [connection, setConnection] = useState<TokenResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/rooms/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roomId }),
    })
      .then(async res => {
        if (!res.ok) throw new Error((await res.json()).error ?? "Impossible de se connecter à la salle.");
        return res.json() as Promise<TokenResponse>;
      })
      .then(data => !cancelled && setConnection(data))
      .catch(err => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  if (error) {
    return <div className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900">{error}</div>;
  }
  if (!connection) {
    return <div className="grid h-[70vh] place-items-center text-sm text-slate-500">Connexion à la salle…</div>;
  }

  return (
    <LiveKitRoom
      token={connection.token}
      serverUrl={connection.livekitUrl}
      connect
      video
      audio
      data-lk-theme="default"
      style={{ height: "70vh", borderRadius: "1.5rem", overflow: "hidden" }}
    >
      <div className="grid h-full min-h-0 lg:grid-cols-[1fr_360px]">
        <VideoConference />
        <StudyWhiteboard />
      </div>
      <FocusModeControls phase={focusPhase} />
    </LiveKitRoom>
  );
}

/**
 * Mutes the microphone during focus phases. The microphone is never enabled
 * automatically when a break starts; the user must explicitly enable it again.
 * The pomodoro phase is supplied by the room page's Supabase Realtime timer state.
 */
export function FocusModeControls({ phase }: { phase: "focus" | "break" | "paused" }) {
  const { localParticipant } = useLocalParticipant();

  useEffect(() => {
    if (phase === "focus") {
      void localParticipant.setMicrophoneEnabled(false);
    }
  }, [phase, localParticipant]);

  return null;
}


function StudyWhiteboard() {
  const room = useRoomContext();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const strokePoints = useRef<{ x: number; y: number }[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const old = canvas.toDataURL();
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (old !== "data:,") {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
        img.src = old;
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    const onData = (payload: Uint8Array) => {
      try {
        const message = JSON.parse(new TextDecoder().decode(payload)) as
          | { type: "stroke"; points: { x: number; y: number }[] }
          | { type: "clear" };
        if (message.type === "clear") return clearCanvas(false);
        if (message.type === "stroke") drawStroke(message.points, false);
      } catch { /* ignore malformed room data */ }
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => { room.off(RoomEvent.DataReceived, onData); };
  }, [room]);

  const drawStroke = (points: { x: number; y: number }[], broadcast: boolean) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || points.length < 1) return;
    const rect = canvas.getBoundingClientRect();
    ctx.strokeStyle = "#064e3b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(points[0].x * rect.width, points[0].y * rect.height);
    for (const p of points.slice(1)) ctx.lineTo(p.x * rect.width, p.y * rect.height);
    ctx.stroke();
    if (broadcast) void room.localParticipant.publishData(
      new TextEncoder().encode(JSON.stringify({ type: "stroke", points })),
      { reliable: true }
    );
  };

  const clearCanvas = (broadcast: boolean) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (broadcast) void room.localParticipant.publishData(
      new TextEncoder().encode(JSON.stringify({ type: "clear" })),
      { reliable: true }
    );
  };

  const pointFromEvent = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
  };

  const start = (e: PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    const p = pointFromEvent(e);
    lastPoint.current = p;
    strokePoints.current = [p];
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !lastPoint.current) return;
    const next = pointFromEvent(e);
    drawStroke([lastPoint.current, next], false);
    strokePoints.current.push(next);
    lastPoint.current = next;
  };
  const end = () => {
    if (drawing.current && strokePoints.current.length > 1) {
      void room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ type: "stroke", points: strokePoints.current })),
        { reliable: true }
      );
    }
    drawing.current = false;
    lastPoint.current = null;
    strokePoints.current = [];
  };

  return (
    <aside className="flex min-h-0 flex-col border-r border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-black text-emerald-950">Tableau blanc interactif</h2>
        <button onClick={() => clearCanvas(true)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold">Effacer</button>
      </div>
      <canvas
        ref={canvasRef}
        className="min-h-[240px] flex-1 touch-none rounded-xl border border-slate-200 bg-white"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      />
      <p className="mt-2 text-xs text-slate-500">Le dessin est synchronisé en direct avec les membres de la salle.</p>
    </aside>
  );
}
