export type MicrosoftImportState =
  | "loading"
  | "not_connected"
  | "connecting"
  | "connected"
  | "scanning"
  | "scan_failed"
  | "error"
  | "no_candidates"
  | "review_results"
  | "disconnected"
  | "expired"
  | "unavailable";

export type OutlookDisplayState =
  | "loading"
  | "disconnected"
  | "connecting"
  | "connected"
  | "scanning"
  | "expired"
  | "unavailable"
  | "error";

export function getOutlookDisplayState(input: {
  state: MicrosoftImportState;
  connected: boolean;
  configured: boolean;
}): OutlookDisplayState;

export function shouldApplyConnectionResponse(requestId: number, latestRequestId: number): boolean;
