/** Only successful, settled responses may be treated as an empty result. */
export function resultState(query: { isError: boolean; isSuccess: boolean; isFetching: boolean }) {
  if (query.isError) return "error" as const;
  if (!query.isSuccess || query.isFetching) return "loading" as const;
  return "ready" as const;
}

export function countState(vesselId: string, query: { isError: boolean; isSuccess: boolean; isFetching: boolean }) {
  if (!vesselId) return "select-vessel" as const;
  return resultState(query);
}

export function reviewEmptyTitle(status: "resolved" | "unresolved") {
  return status === "resolved" ? "No resolved conflicts" : "No unresolved conflicts";
}