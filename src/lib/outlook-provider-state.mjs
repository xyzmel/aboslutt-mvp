export function getOutlookDisplayState({ state, connected, configured }) {
  if (state === "loading") {
    return "loading";
  }

  if (state === "connecting") {
    return "connecting";
  }

  if (state === "scanning") {
    return "scanning";
  }

  if (state === "expired") {
    return "expired";
  }

  if (state === "unavailable") {
    return "unavailable";
  }

  if (state === "scan_failed" || state === "error") {
    return "error";
  }

  if (connected && (state === "connected" || state === "review_results" || state === "no_candidates")) {
    return "connected";
  }

  if (!configured) {
    return "unavailable";
  }

  return "disconnected";
}

export function shouldApplyConnectionResponse(requestId, latestRequestId) {
  return requestId === latestRequestId;
}
