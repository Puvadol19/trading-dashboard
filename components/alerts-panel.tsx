"use client";

import { useState } from "react";
import { Bell, BellOff, Volume2, VolumeOff, X } from "lucide-react";
import type { AlertEvent } from "@/lib/types";

interface AlertsPanelProps {
  alerts: AlertEvent[];
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  onToggleSound: () => void;
  onToggleNotifications: () => void;
  onClearAlerts: () => void;
}

export function AlertsPanel({
  alerts,
  soundEnabled,
  notificationsEnabled,
  onToggleSound,
  onToggleNotifications,
  onClearAlerts,
}: AlertsPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const levelColors = {
    info: "border-l-primary text-primary",
    warning: "border-l-yellow-400 text-yellow-400",
    critical: "border-l-bearish text-bearish",
  };

  const recentAlerts = alerts.slice(-10).reverse();

  return (
    <div className="rounded-lg border border-border bg-card p-3 md:p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
          Alerts
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleSound}
            className={`p-1.5 rounded-md transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center ${
              soundEnabled
                ? "bg-primary/10 text-primary"
                : "bg-secondary text-muted-foreground"
            }`}
            aria-label={soundEnabled ? "Mute sound alerts" : "Enable sound alerts"}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeOff className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onToggleNotifications}
            className={`p-1.5 rounded-md transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center ${
              notificationsEnabled
                ? "bg-primary/10 text-primary"
                : "bg-secondary text-muted-foreground"
            }`}
            aria-label={notificationsEnabled ? "Disable notifications" : "Enable notifications"}
          >
            {notificationsEnabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
          </button>
          {alerts.length > 0 && (
            <button
              onClick={onClearAlerts}
              className="p-1.5 rounded-md bg-secondary text-muted-foreground hover:text-foreground transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
              aria-label="Clear all alerts"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {recentAlerts.length === 0 ? (
        <p className="text-xs text-muted-foreground font-mono">No alerts yet</p>
      ) : (
        <>
          <div className={`flex flex-col gap-1 ${expanded ? "" : "max-h-[120px] overflow-hidden"}`}>
            {recentAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`border-l-2 pl-2 py-1 ${levelColors[alert.level]}`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] font-mono font-semibold">
                    {alert.type.replace(/_/g, " ")}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-[10px] font-mono text-muted-foreground">
                  {alert.message}
                </p>
              </div>
            ))}
          </div>
          {recentAlerts.length > 3 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[10px] font-mono text-primary mt-1"
            >
              {expanded ? "Show less" : `Show all (${recentAlerts.length})`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
