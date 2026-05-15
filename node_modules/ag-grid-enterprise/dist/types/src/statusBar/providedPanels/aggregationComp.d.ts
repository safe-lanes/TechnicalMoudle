import type { AggregationStatusPanelParams, IStatusPanelComp } from 'ag-grid-community';
import { Component } from 'ag-grid-community';
export declare class AggregationComp extends Component implements IStatusPanelComp {
    private readonly sumAggregationComp;
    private readonly countAggregationComp;
    private readonly minAggregationComp;
    private readonly maxAggregationComp;
    private readonly avgAggregationComp;
    private params;
    constructor();
    postConstruct(): void;
    init(params: AggregationStatusPanelParams): void;
    refresh(params: AggregationStatusPanelParams): boolean;
    private setAggregationComponentValue;
    private getAllowedAggregationValueComponent;
    private getAggregationValueComponent;
    private onCellSelectionChanged;
}
