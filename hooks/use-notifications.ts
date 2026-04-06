"use client";

import { useState, useEffect, useCallback } from "react";

export type NotificationPermission = "default" | "granted" | "denied" | "unsupported";

export interface UseNotificationsReturn {
  permission: NotificationPermission;
  isSubscribed: boolean;
  isLoading: boolean;
  requestPermission: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  sendPush: (title: string, body: string, tag?: string) => Promise<void>;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function useNotifications(): UseNotificationsReturn {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  // Check initial state
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPermission("unsupported");
      return;
    }

    setPermission(Notification.permission as NotificationPermission);

    // Register service worker and check existing subscription
    navigator.serviceWorker
      .register("/sw.js")
      .then(async (reg) => {
        const existingSub = await reg.pushManager.getSubscription();
        if (existingSub) {
          setSubscription(existingSub);
          setIsSubscribed(true);
        }
      })
      .catch((err) => console.error("[notifications] SW register failed:", err));
  }, []);

  const requestPermission = useCallback(async () => {
    if (permission === "unsupported") return;
    setIsLoading(true);

    try {
      const result = await Notification.requestPermission();
      setPermission(result as NotificationPermission);

      if (result !== "granted") {
        setIsLoading(false);
        return;
      }

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        console.error("[notifications] NEXT_PUBLIC_VAPID_PUBLIC_KEY not set");
        setIsLoading(false);
        return;
      }

      // Subscribe to push
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      // Send subscription to server
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });

      setSubscription(sub);
      setIsSubscribed(true);
    } catch (err) {
      console.error("[notifications] subscribe failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, [permission]);

  const unsubscribe = useCallback(async () => {
    if (!subscription) return;
    setIsLoading(true);
    try {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      await subscription.unsubscribe();
      setSubscription(null);
      setIsSubscribed(false);
    } catch (err) {
      console.error("[notifications] unsubscribe failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, [subscription]);

  const sendPush = useCallback(async (title: string, body: string, tag = "trading-alert") => {
    try {
      await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, tag, url: "/" }),
      });
    } catch (err) {
      console.error("[notifications] send push failed:", err);
    }
  }, []);

  return { permission, isSubscribed, isLoading, requestPermission, unsubscribe, sendPush };
}
