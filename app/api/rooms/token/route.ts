import { NextRequest, NextResponse } from "next/server";
import { AccessToken, TrackSource } from "livekit-server-sdk";
import { z } from "zod";
import { createRequestClient } from "@/lib/supabase-server";
import { rateLimit } from "@/lib/rate-limit";
import { readJson } from "@/lib/request";

const requestSchema = z.object({ roomId: z.number().int().positive() });

export async function POST(req: NextRequest) {
  const supabase = await createRequestClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "يجب تسجيل الدخول." }, { status: 401 });
  }

  const limited = rateLimit(req, { name: "rooms-token", limit: 20, windowMs: 10 * 60_000, userId: user.id });
  if (limited) return limited;

  const parsed = requestSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }

  // Re-check membership server-side — never trust the client to only ask for
  // tokens to rooms it's actually allowed in. RLS on room_members enforces
  // this at the query level too, so a non-member gets zero rows back.
  const { data: membership } = await supabase
    .from("room_members")
    .select("role")
    .eq("room_id", parsed.data.roomId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "يجب الانضمام إلى الغرفة أولاً." }, { status: 403 });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  if (!apiKey || !apiSecret || !livekitUrl) {
    return NextResponse.json({ error: "خدمة الغرف غير مهيأة حالياً." }, { status: 503 });
  }

  const token = new AccessToken(apiKey, apiSecret, {
    identity: user.id,
    name: user.user_metadata?.name ?? "تلميذ",
    // Short-lived join tokens reduce the window for stale credentials.
    ttl: "30m",
  });

  const livekitRoomName = `najah-room-${parsed.data.roomId}`;
  token.addGrant({
    room: livekitRoomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    // Allow only the media sources the study room actually needs.
    canPublishSources: [
      TrackSource.CAMERA,
      TrackSource.MICROPHONE,
      TrackSource.SCREEN_SHARE,
      TrackSource.SCREEN_SHARE_AUDIO,
    ],
    // Moderators/hosts can use LiveKit moderation APIs; regular members cannot.
    roomAdmin: membership.role === "host" || membership.role === "moderator",
  });

  return NextResponse.json({
    token: await token.toJwt(),
    livekitUrl,
    roomName: livekitRoomName,
  });
}
