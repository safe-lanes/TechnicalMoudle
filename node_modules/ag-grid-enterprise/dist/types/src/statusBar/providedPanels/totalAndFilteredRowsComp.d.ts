import type { IProvidedStatusPanelParams, IStatusPanelComp, IStatusPanelParams } from 'ag-grid-community';
import { AgNameValue } from './agNameValue';
export declare class TotalAndFilteredRowsComp extends AgNameValue implements IStatusPanelComp {
    postConstruct(): void;
    private onDataChanged;
    init(params: IStatusPanelParams & IProvidedStatusPanelParams): void;
    private updateValueFormatter;
    refresh(params: IStatusPanelParams & IProvidedStatusPanelParams): boolean;
}
