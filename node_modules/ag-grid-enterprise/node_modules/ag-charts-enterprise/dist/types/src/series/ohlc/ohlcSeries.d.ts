import { type AgOhlcSeriesOptions, _ModuleSupport } from 'ag-charts-community';
import { OhlcNode } from './ohlcNode';
import { OhlcSeriesBase } from './ohlcSeriesBase';
import type { OhlcNodeDatum } from './ohlcSeriesBase';
import { OhlcSeriesProperties } from './ohlcSeriesProperties';
export declare class OhlcSeries extends OhlcSeriesBase<OhlcNode, AgOhlcSeriesOptions, OhlcSeriesProperties> {
    static readonly className = "ohlc";
    static readonly type: "ohlc";
    properties: OhlcSeriesProperties;
    protected nodeFactory(): OhlcNode;
    protected updateDatumNodes({ datumSelection, isHighlight, }: {
        datumSelection: _ModuleSupport.Selection<OhlcNode, OhlcNodeDatum>;
        isHighlight: boolean;
    }): void;
    getLegendData(legendType: _ModuleSupport.ChartLegendType): _ModuleSupport.CategoryLegendDatum[];
    protected hasItemStylers(): boolean;
}
