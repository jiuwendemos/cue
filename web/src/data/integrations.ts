import type { Integration } from "../types";

/**
 * The app's integration registry.
 *
 * These are services CUE can exchange with, not content of a show. They are
 * app-level so a new tour still shows the same truthful status. The status is
 * the reference status for the demo; on site, delivery records and the
 * configured environment are authoritative. See docs/integrations.md.
 */
export const INTEGRATIONS: Integration[] = [
  { id: "depence", name: "Depence²", protocol: "Previz exchange", kind: "previz", status: "simulated", detail: "Stage, rig and look exchange. No adapter attached; MVR is the only file path.", direction: "both" },
  { id: "capture", name: "Capture", protocol: "Previz exchange", kind: "previz", status: "simulated", detail: "Mapping and look exchange. No adapter attached.", direction: "export" },
  { id: "wysiwyg", name: "WYSIWYG", protocol: "Previz exchange", kind: "previz", status: "simulated", detail: "Rig and patch exchange. No adapter attached.", direction: "import" },
  { id: "vectorworks", name: "Vectorworks Spotlight", protocol: "VWX / CSV", kind: "previz", status: "available", detail: "Fixture CSV import and export. DWG/VWX exchange is not attached.", direction: "both" },
  { id: "grandma3", name: "grandMA3", protocol: "MVR / XML", kind: "console", status: "available", detail: "Cue CSV/XML export and CSV import. Not vendor-certified.", direction: "both" },
  { id: "disguise", name: "disguise", protocol: "Media server", kind: "video", status: "simulated", detail: "Screen mapping and clip list. No adapter attached.", direction: "both" },
  { id: "resolume", name: "Resolume", protocol: "Arena / OSC", kind: "video", status: "available", detail: "Clip and layer CSV export. No live control.", direction: "export" },
  { id: "notch", name: "Notch", protocol: "Block export", kind: "video", status: "simulated", detail: "Content block handoff. No adapter attached.", direction: "import" },
  { id: "dam", name: "Dropbox / DAM", protocol: "Asset links", kind: "dam", status: "simulated", detail: "Local folder checksum scan only. No cloud DAM attached.", direction: "import" },
  { id: "calendar", name: "Google Calendar", protocol: "Calendar sync", kind: "calendar", status: "available", detail: "iCalendar export of the tour. No calendar sync attached.", direction: "export" },
  { id: "xero", name: "Xero", protocol: "Budget export", kind: "finance", status: "available", detail: "Budget CSV export. No Xero API attached.", direction: "export" },
  { id: "slack", name: "Slack", protocol: "Webhook + HMAC", kind: "chat", status: "simulated", detail: "Webhook delivery adapter. No webhook configured.", direction: "both" },
  { id: "teams", name: "Microsoft Teams", protocol: "Webhook", kind: "chat", status: "simulated", detail: "Webhook delivery adapter. No webhook configured.", direction: "export" },
];
