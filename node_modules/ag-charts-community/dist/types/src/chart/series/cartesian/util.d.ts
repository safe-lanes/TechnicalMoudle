import { type Size } from 'ag-charts-core';
import type { AgCartesianSeriesOptions, AgSeriesSegmentation, DatumDefault } from 'ag-charts-types';
import type { SeriesPredictAxis } from '../../../module/coreModules';
import { BBox } from '../../../scene/bbox';
import type { ChartAxis } from '../../chartAxis';
import { ChartAxisDirection } from '../../chartAxisDirection';
import { CARTESIAN_AXIS_TYPE } from '../../themes/constants';
export declare function calculateSegments(segmentation: AgSeriesSegmentation, xAxis: ChartAxis, yAxis: ChartAxis, seriesRect: BBox, chartSize: Size, applyOffset?: boolean): {
    stroke?: string | undefined;
    strokeWidth?: number | undefined;
    strokeOpacity?: number | undefined;
    lineDash?: number[] | undefined;
    lineDashOffset?: number | undefined;
    fill?: import("ag-charts-types").AgColorType | undefined;
    fillOpacity?: number | undefined;
    clipRect: {
        x0: any;
        y0: any;
        x1: any;
        y1: any;
    };
}[] | undefined;
export declare const TIME_AXIS_KEYS: Set<string>;
export declare function predictCartesianAxis<SeriesOptions extends AgCartesianSeriesOptions>(direction: ChartAxisDirection, datum: DatumDefault, seriesOptions: SeriesOptions): SeriesPredictAxis<SeriesOptions['type']> | undefined;
export declare function predictCartesianTimeAxis<SeriesOptions extends AgCartesianSeriesOptions>(direction: ChartAxisDirection, datum: DatumDefault, seriesOptions: SeriesOptions): SeriesPredictAxis<SeriesOptions['type']> | undefined;
export declare function predictTimeAxisType(key: string, value: unknown): CARTESIAN_AXIS_TYPE.TIME | undefined;
