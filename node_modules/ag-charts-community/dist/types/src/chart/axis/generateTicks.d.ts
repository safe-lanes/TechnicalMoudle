import { type Scale } from '../../scale/scale';
import type { TickInterval } from './axisTick';
import { type GenerateTicksOptions, type TickData } from './generateTicksUtils';
export declare function generateTicks<TScale extends Scale<TDatum, number, TickInterval<TScale>>, TDatum>(options: GenerateTicksOptions<TScale, TDatum>): {
    tickData: TickData<any>;
    textAlign: CanvasTextAlign;
    textBaseline: CanvasTextBaseline;
    rotation: number;
};
