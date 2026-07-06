"use client";

/** Doit correspondre à Constants.nativeAppUserAgent côté app iOS (ios/GlassTime/Support/Constants.swift). */
export const NATIVE_APP_UA_MARKER = "GlassTimeNativeApp";

export function isNativeApp(): boolean {
  return typeof navigator !== "undefined" && navigator.userAgent.includes(NATIVE_APP_UA_MARKER);
}
