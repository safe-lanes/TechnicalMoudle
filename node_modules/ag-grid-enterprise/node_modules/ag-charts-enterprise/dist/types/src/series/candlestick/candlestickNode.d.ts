import { _ModuleSupport } from 'ag-charts-community';
import { OhlcBaseNode } from '../ohlc/ohlcNode';
export declare class CandlestickNode extends OhlcBaseNode {
    private readonly wickPath;
    wickStroke: string | undefined;
    wickStrokeWidth: number | undefined;
    wickStrokeOpacity: number | undefined;
    wickLineDash: readonly number[] | undefined;
    wickLineDashOffset: number | undefined;
    protected computeDefaultGradientFillBBox(): _ModuleSupport.BBox | undefined;
    updatePath(): void;
    drawPath(ctx: _ModuleSupport.CanvasContext): void;
}
