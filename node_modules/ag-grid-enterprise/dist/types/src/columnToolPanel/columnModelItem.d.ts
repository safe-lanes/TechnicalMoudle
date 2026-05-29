import type { AgColumn, AgProvidedColumnGroup, IEventEmitter, IEventListener } from 'ag-grid-community';
type ColumnModelItemEvent = 'expandedChanged';
export declare class ColumnModelItem implements IEventEmitter<ColumnModelItemEvent> {
    readonly displayName: string | null;
    readonly depth: number;
    readonly group: boolean;
    private localEventService;
    readonly columnGroup: AgProvidedColumnGroup;
    readonly column: AgColumn;
    readonly children: ColumnModelItem[];
    private _expanded;
    passesFilter: boolean;
    constructor(displayName: string | null, columnOrGroup: AgColumn | AgProvidedColumnGroup, depth: number, group?: boolean, expanded?: boolean);
    get expanded(): boolean;
    set expanded(expanded: boolean);
    addEventListener<T extends ColumnModelItemEvent>(eventType: T, listener: IEventListener<ColumnModelItemEvent>): void;
    removeEventListener<T extends ColumnModelItemEvent>(eventType: T, listener: IEventListener<ColumnModelItemEvent>): void;
}
export {};
