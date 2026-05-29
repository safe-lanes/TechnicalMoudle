import { BeanStub } from 'ag-grid-community';
import type { AgColumn, AgColumnGroup, IHeaderCellComp } from 'ag-grid-community';
export declare class RangeHeaderHighlightFeature extends BeanStub {
    private column;
    private comp;
    private columnMap;
    private isActive;
    constructor(column: AgColumn | AgColumnGroup, comp: IHeaderCellComp);
    postConstruct(): void;
    private resetColumnMap;
    private refreshActive;
    private setupRangeHeaderHighlight;
    onRangeSelectionChanged(): void;
    destroy(): void;
}
