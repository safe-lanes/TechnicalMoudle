import { Component } from 'ag-grid-community';
import type { ChartMenuParamsFactory } from '../../chartMenuParamsFactory';
export declare class TooltipPanel extends Component {
    private readonly chartMenuUtils;
    private tooltipMode;
    constructor(chartMenuUtils: ChartMenuParamsFactory);
    postConstruct(): void;
}
