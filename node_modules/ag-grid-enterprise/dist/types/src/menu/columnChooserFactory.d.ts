import type { AgColumn, ColumnChooserParams, HeaderPosition, NamedBean } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
import { AgPrimaryCols } from '../columnToolPanel/agPrimaryCols';
interface ShowColumnChooserParams {
    column?: AgColumn | null;
    chooserParams?: ColumnChooserParams;
    eventSource?: HTMLElement;
    headerPosition?: HeaderPosition | null;
}
export declare class ColumnChooserFactory extends BeanStub implements NamedBean {
    beanName: "colChooserFactory";
    private activeColumnChooser;
    private activeColumnChooserDialog;
    createColumnSelectPanel(parent: BeanStub<any>, column?: AgColumn | null, draggable?: boolean, params?: ColumnChooserParams): AgPrimaryCols;
    showColumnChooser({ column, chooserParams, eventSource, headerPosition: providedHeaderPosition, }: ShowColumnChooserParams): void;
    hideActiveColumnChooser(): void;
    private dispatchVisibleChangedEvent;
}
export {};
