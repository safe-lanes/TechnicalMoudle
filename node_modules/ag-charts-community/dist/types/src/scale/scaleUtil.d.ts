export declare function visibleTickSliceIndices<T = any>(ticks: T[], reversed: boolean, visibleRange: [number, number] | undefined): [number, number];
export declare function filterVisibleTicks<T = any>(ticks: T[], reversed: boolean, visibleRange: [number, number] | undefined): {
    ticks: T[];
    count: number;
    firstTickIndex: number;
};
