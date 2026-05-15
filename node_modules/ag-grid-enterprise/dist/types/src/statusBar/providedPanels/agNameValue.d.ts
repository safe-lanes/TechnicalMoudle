import type { ComponentSelector, IStatusPanelValueFormatterParams } from 'ag-grid-community';
import { Component } from 'ag-grid-community';
export declare class AgNameValue extends Component {
    private readonly eLabel;
    private readonly eValue;
    valueFormatter: (params: IStatusPanelValueFormatterParams) => string;
    key: string;
    constructor();
    setLabel(key: string, defaultValue: string): void;
    setValue(value: number, totalRows: number): void;
}
export declare const AgNameValueSelector: ComponentSelector;
