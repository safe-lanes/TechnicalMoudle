import { _ModuleSupport } from 'ag-charts-community';
declare const Chart: typeof _ModuleSupport.Chart;
export declare class TopologyChart extends Chart {
    static readonly className = "TopologyChart";
    static readonly type: "topology";
    private readonly xAxis;
    private readonly yAxis;
    topology?: _ModuleSupport.FeatureCollection;
    constructor(options: _ModuleSupport.ChartOptions, resources?: _ModuleSupport.TransferableResources);
    getChartType(): "topology";
    updateData(): Promise<void>;
    protected performLayout(ctx: _ModuleSupport.LayoutContext): void;
}
export {};
