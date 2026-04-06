import { NextRequest, NextResponse } from "next/server";

// In-memory store for subscriptions (resets on server restart)
// For production, replace with a database
const subscriptions = new Map<string, PushSubscriptionJSON>();

interface PushSubscriptionJSON {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    const sub: PushSubscriptionJSON = await req.json();
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }
    subscriptions.set(sub.endpoint, sub);
    return NextResponse.json({ ok: true, count: subscriptions.size });
  } catch {
    return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { endpoint } = await req.json();
    subscriptions.delete(endpoint);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to remove subscription" }, { status: 500 });
  }
}

// Export for use by the send route
export { subscriptions };
