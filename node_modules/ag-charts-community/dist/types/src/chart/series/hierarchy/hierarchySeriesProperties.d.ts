import type { AgColorType } from 'ag-charts-types';
import { SeriesProperties } from '../seriesProperties';
export declare abstract class HierarchySeriesProperties<T extends object> extends SeriesProperties<T> {
    childrenKey: string;
    sizeKey?: string;
    colorKey?: string;
    colorName?: string;
    fills: AgColorType[];
    strokes: string[];
    colorRange?: string[];
}
