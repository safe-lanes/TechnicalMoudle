export declare const DEFAULT_LOCALE_TEXT: {
    readonly loadingOoo: "Loading...";
    readonly blanks: "(Blanks)";
    readonly searchOoo: "Search...";
    readonly selectAll: "(Select All)";
    readonly selectAllSearchResults: "(Select All Search Results)";
    readonly addCurrentSelectionToFilter: "Add current selection to filter";
    readonly noMatches: "No matches.";
    readonly ariaSearchFilterValues: "Search filter values";
    readonly ariaFilterList: "Filter List";
    readonly filterSummaryListInactive: "is (All)";
    readonly filterSummaryListSeparator: ", ";
    readonly filterSummaryListShort: (variableValues: string[]) => string;
    readonly filterSummaryListLong: (variableValues: string[]) => string;
};
export type SetFilterLocaleTextKey = keyof typeof DEFAULT_LOCALE_TEXT;
