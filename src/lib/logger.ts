/**
 * Debug logger — calls are stripped from production builds via Vite define.
 * Usage: import { log } from "@/lib/logger"
 *        log.info("[parser]", "message", data)
 *        log.group("[parser]", "section name")
 *        log.groupEnd()
 */

const isDev = import.meta.env.DEV;

function noop(): void {}

export const log = {
  info: isDev ? console.log.bind(console) : noop,
  warn: isDev ? console.warn.bind(console) : noop,
  group: isDev ? console.group.bind(console) : noop,
  groupEnd: isDev ? console.groupEnd.bind(console) : noop,
};
