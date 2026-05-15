import type { RichCellEditorParams } from 'ag-grid-community';
import { AgAbstractCellEditor } from 'ag-grid-community';
import { AgRichSelect } from '../widgets/agRichSelect';
export declare class RichSelectCellEditor<TData = any, TValue = any, TContext = any> extends AgAbstractCellEditor {
    protected params: RichCellEditorParams<TData, TValue>;
    private focusAfterAttached;
    protected eEditor: AgRichSelect<TValue>;
    private isAsync;
    constructor();
    initialiseEditor(_params: RichCellEditorParams<TData, TValue>): void;
    private onEditorPickerValueSelected;
    private buildRichSelectParams;
    private getSearchStringCallback;
    afterGuiAttached(): void;
    private processEventKey;
    focusIn(): void;
    getValue(): any;
    isPopup(): boolean;
    getValidationElement(): HTMLElement;
    getValidationErrors(): string[] | null;
}
