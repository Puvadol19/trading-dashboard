"use client";

import { useRef, useCallback } from "react";
import type { AlertEvent, AlertType } from "@/lib/types";

// Generate alert sound using Web Audio API
function playAlertSound(type: "info" | "warning" | "critical") {
  try {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);

    if (type === "critical") {
      oscillator.frequency.value = 880;
      gain.gain.value = 0.3;
      oscillator.start();
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      oscillator.frequency.setValueAtTime(660, ctx.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
      oscillator.stop(ctx.currentTime + 0.3);
    } else if (type === "warning") {
      oscillator.frequency.value = 660;
      gain.gain.value = 0.2;
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.15);
    } else {
      oscillator.frequency.value = 523;
      gain.gain.value = 0.15;
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.1);
    }

    gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
  } catch {
    // Audio not available
  }
}

// Send browser notification
function sendNotification(title: string, body: string) {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;

  if (Notification.permission === "granted") {
    new Notification(title, {
      body,
      icon: "/icon.svg",
      tag: "trading-alert",
    });
  }
}

export function useAlerts(soundEnabled: boolean, notificationsEnabled: boolean) {
  const lastAlertsRef = useRef<Map<AlertType, number>>(new Map());
  const COOLDOWN = 10000; // 10 second cooldown per alert type

  const triggerAlert = useCallback(
    (alert: AlertEvent) => {
      const now = Date.now();
      const lastTime = lastAlertsRef.current.get(alert.type) || 0;

      // Cooldown check
      if (now - lastTime < COOLDOWN) return null;
      lastAlertsRef.current.set(alert.type, now);

      // Sound alert
      if (soundEnabled) {
        playAlertSound(alert.level);
      }

      // Browser notification
      if (notificationsEnabled) {
        sendNotification(
          `Trading Alert: ${alert.type.replace(/_/g, " ")}`,
          alert.message
        );
      }

      return alert;
    },
    [soundEnabled, notificationsEnabled]
  );

  const requestNotificationPermission = useCallback(async () => {
    if (typeof window === "undefined") return false;
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    const result = await Notification.requestPermission();
    return result === "granted";
  }, []);

  return { triggerAlert, requestNotificationPermission };
}
