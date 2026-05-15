import { BBox } from '../../scene/bbox';
import type { Padding } from '../../util/padding';
import type { DatumIndexType, ISeries } from '../series/seriesTypes';
export declare class SeriesLabelLayoutManager {
    private readonly labelData;
    updateLabels(placedLabelSeries: ISeries<DatumIndexType, unknown, unknown>[], padding: Padding, seriesRect?: BBox): void;
}
