import { Component } from 'ag-grid-community';
interface PillRendererParams<TValue> {
    eWrapper?: HTMLElement;
    announceItemFocus?: () => void;
    onPillMouseDown?: (e: MouseEvent) => void;
    valueFormatter?: (value: TValue | TValue[]) => string | null;
    getValue: () => TValue[] | null;
    setValue: (value: TValue[] | null) => void;
}
export declare class AgPillContainer<TValue> extends Component {
    private params;
    private pills;
    constructor();
    init(params: PillRendererParams<TValue>): void;
    refresh(): void;
    onNavigationKeyDown(e: KeyboardEvent): void;
    private clearPills;
    private onPillButtonClick;
    private onPillKeyDown;
    private deletePill;
    destroy(): void;
}
export {};
