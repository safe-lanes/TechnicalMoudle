import type { Column, FindCellValueParams, FindMatch, FindPart, GridApi, IFindService, IRowNode, NamedBean } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
export declare class FindService extends BeanStub implements NamedBean, IFindService {
    beanName: "findSvc";
    /**
     * Is find currently active (e.g. non-empty search value).
     * Used for performance when checking matches (part of cell rendering)
     */
    private active;
    /** pinned top matches */
    private topMatches;
    /** same nodes as keys in `topMatches`, but kept separate for performance when moving backwards and forwards through the matches */
    private topNodes;
    /** total number of matches in pinned top */
    private topNumMatches;
    private centerMatches;
    private centerNodes;
    private centerNumMatches;
    private bottomMatches;
    private bottomNodes;
    /** switches based on grid options */
    private caseFormat;
    /** cached version that has been trimmed and potentially case converted */
    private findSearchValue;
    /** whether to scroll to active match after a refresh */
    private scrollOnRefresh;
    /** keeps active match */
    private refreshDebounced;
    totalMatches: number;
    activeMatch: FindMatch | undefined;
    postConstruct(): void;
    next(): void;
    previous(): void;
    goTo(match: number, force?: boolean): void;
    clearActive(): void;
    isMatch(node: IRowNode, column: Column | null): boolean;
    getNumMatches(node: IRowNode, column: Column | null): number;
    /**
     * Get detail for cell renderer. Splits up the cell value into strings depending on
     * whether they don't match, match, or are the active match
     */
    getParts(params: FindCellValueParams): FindPart[];
    registerDetailGrid(node: IRowNode, api: GridApi): void;
    refresh(maintainActive: boolean): void;
    private resetActiveMatch;
    private refreshRows;
    private findAcrossContainers;
    private findInContainer;
    private dispatchFindChanged;
    private setActive;
    private setDetailActive;
    private refreshAndScrollToActive;
    private scrollToActive;
    private goToInContainer;
    private getMatches;
    private getRowNodes;
    private getActiveMatchNum;
    destroy(): void;
}
