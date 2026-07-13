import { type AgCandlestickSeriesOptions, _ModuleSupport } from 'ag-charts-community';
import { type OhlcNodeDatum, OhlcSeriesBase } from '../ohlc/ohlcSeriesBase';
import { CandlestickNode } from './candlestickNode';
import { CandlestickSeriesProperties } from './candlestickSeriesProperties';
export declare class CandlestickSeries extends OhlcSeriesBase<CandlestickNode, AgCandlestickSeriesOptions, CandlestickSeriesProperties<AgCandlestickSeriesOptions>> {
    static readonly className = "CandleStickSeries";
    static readonly type: "candlestick";
    properties: CandlestickSeriesProperties<AgCandlestickSeriesOptions<any, unknown>>;
    protected nodeFactory(): CandlestickNode;
    protected updateDatumNodes({ datumSelection, isHighlight, }: {
        datumSelection: _ModuleSupport.Selection<CandlestickNode, OhlcNodeDatum>;
        isHighlight: boolean;
    }): void;
    private legendItemSymbol;
    getLegendData(legendType: _ModuleSupport.ChartLegendType): _ModuleSupport.CategoryLegendDatum[];
    protected hasItemStylers(): boolean;
}
