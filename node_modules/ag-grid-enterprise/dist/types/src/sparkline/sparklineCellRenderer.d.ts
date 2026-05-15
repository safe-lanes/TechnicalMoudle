import type { ICellRenderer, ISparklineCellRendererParams } from 'ag-grid-community';
import { Component } from 'ag-grid-community';
export declare class SparklineCellRenderer extends Component implements ICellRenderer {
    private readonly eSparkline;
    private sparklineInstance?;
    private sparklineOptions;
    private params;
    private cachedWidth;
    private cachedHeight;
    private dataRef;
    private processedData;
    private env;
    constructor();
    postConstruct(): void;
    private createListener;
    private initGridObserver;
    private updateSize;
    init(params: ISparklineCellRendererParams): void;
    refresh(params?: ISparklineCellRendererParams): boolean;
    private processData;
    private createContext;
    private getDefaultTooltipRenderer;
    private wrapItemStyler;
    private wrapTooltipRenderer;
    destroy(): void;
}
