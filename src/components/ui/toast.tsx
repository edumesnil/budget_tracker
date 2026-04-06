"use client";
import { Portal } from "@ark-ui/react/portal";
import { Toaster as ArkToaster, Toast } from "@ark-ui/react/toast";
import { Check, X, AlertTriangle, Info } from "lucide-react";
import { css } from "../../../styled-system/css";
import { Button } from "./button";
import { toaster } from "@/lib/toaster";

const types = {
  success: {
    icon: Check,
    fg: "income" as const,
    bg: "income.muted" as const,
    fill: "var(--colors-income)",
  },
  error: {
    icon: X,
    fg: "expense" as const,
    bg: "expense.muted" as const,
    fill: "var(--colors-expense)",
  },
  warning: {
    icon: AlertTriangle,
    fg: "gray.11" as const,
    bg: "gray.a3" as const,
    fill: "var(--colors-gray-9)",
  },
  info: {
    icon: Info,
    fg: "teal.11" as const,
    bg: "teal.a3" as const,
    fill: "var(--colors-teal-9)",
  },
};

export const Toaster = () => (
  <Portal>
    <ArkToaster toaster={toaster}>
      {(t) => {
        const cfg = types[t.type as keyof typeof types] ?? types.info;
        const Icon = cfg.icon;
        const dur = t.duration ?? 7000;

        return (
          <Toast.Root
            className={css({
              display: "flex",
              alignItems: "center",
              gap: "3",
              bg: "gray.2",
              rounded: "lg",
              shadow: "lg",
              px: "4",
              py: "3",
              minW: "72",
              maxW: "md",
              w: "auto",
              pos: "relative",
              overflow: "hidden",
              height: "var(--height)",
              opacity: "var(--opacity)",
              scale: "var(--scale)",
              translate: "var(--x) var(--y)",
              willChange: "translate, opacity, scale",
              zIndex: "var(--z-index)",
              transitionDuration: "slow",
              transitionProperty: "translate, scale, opacity, height",
              transitionTimingFunction: "default",
            })}
          >
            {/* Countdown fill */}
            <div
              className={css({
                pos: "absolute",
                top: 0,
                left: 0,
                bottom: 0,
                pointerEvents: "none",
              })}
              style={{
                backgroundColor: cfg.fill,
                opacity: 0.12,
                width: "100%",
                animation: `toast-countdown ${dur}ms linear forwards`,
              }}
            />

            {/* Icon */}
            <span
              className={css({
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                w: "7",
                h: "7",
                rounded: "md",
                flexShrink: 0,
                bg: cfg.bg,
                pos: "relative",
                zIndex: 1,
              })}
            >
              <Icon size={14} className={css({ color: cfg.fg })} />
            </span>

            {/* Text */}
            <div
              className={css({
                display: "flex",
                flexDir: "column",
                gap: "0.5",
                flex: 1,
                pos: "relative",
                zIndex: 1,
              })}
            >
              {t.title && (
                <Toast.Title
                  className={css({
                    color: "fg.default",
                    fontWeight: "medium",
                    fontSize: "sm",
                    lineHeight: "tight",
                  })}
                >
                  {t.title}
                </Toast.Title>
              )}
              {t.description && (
                <Toast.Description
                  className={css({ color: "fg.muted", fontSize: "xs", lineHeight: "tight" })}
                >
                  {t.description}
                </Toast.Description>
              )}
            </div>

            {/* Action */}
            {t.action && (
              <Toast.ActionTrigger asChild>
                <Button
                  variant="outline"
                  size="xs"
                  className={css({ pos: "relative", zIndex: 1, flexShrink: 0 })}
                  onClick={() => {
                    const a = t.action as { label: string; onClick?: () => void };
                    a.onClick?.();
                  }}
                >
                  {t.action.label}
                </Button>
              </Toast.ActionTrigger>
            )}
          </Toast.Root>
        );
      }}
    </ArkToaster>
  </Portal>
);
