"use client";
import { useEffect } from "react";
import { captureUTMParams } from "@/lib/tracking";

// Invisible component added to layout — captures UTM/gclid on first page load
export default function TrackingInit() {
  useEffect(() => { captureUTMParams(); }, []);
  return null;
}
