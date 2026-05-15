import { type BoxBounds, type ITextMeasurer } from 'ag-charts-core';
import type { AgTimeInterval, AgTimeIntervalUnit, DateFormatterStyle, TextOrSegments } from 'ag-charts-types';
import { type Scale, ScaleAlignment, type ScaleTickParams } from '../../scale/scale';
import type { AxisPrimaryTickCount } from '../../util/secondaryAxisTicks';
import type { ChartAxisLabel, ChartAxisLabelFlipFlag } from '../chartAxis';
import type { AxisInterval } from './axisInterval';
import type { TickInterval } from './axisTick';
import { NiceMode, type TickDatum } from './axisUtil';
export type AnyTimeInterval = AgTimeInterval | AgTimeIntervalUnit;
export interface GenerateTicksOptions<TScale extends Scale<TDatum, number, TickInterval<TScale>>, TDatum> {
    label: ChartAxisLabel;
    scale: TScale;
    domain: TDatum[];
    range: [number, number];
    visibleRange: [number, number];
    niceMode: NiceMode;
    reverse: boolean;
    primaryTickCount: AxisPrimaryTickCount | undefined;
    defaultTickMinSpacing: number;
    axisRotation: number;
    labelOffset: number;
    sideFlag: ChartAxisLabelFlipFlag;
    primaryLabel?: ChartAxisLabel;
    interval: AxisInterval<TScale>;
    minimumTimeGranularity?: AgTimeIntervalUnit;
    sizeLimit?: number;
    isVertical?: boolean;
    inRange?: (value: number) => boolean;
    tickFormatter(this: void, domain: TDatum[], ticks: TDatum[], primary: boolean, fractionDigits: number | undefined, timeInterval: AnyTimeInterval | undefined, dateStyle: DateFormatterStyle): (value: any, index: number) => TextOrSegments | undefined;
}
export interface TickData<D = any> {
    niceDomain: D[];
    tickDomain: D[];
    rawTicks: D[];
    rawTickCount: number | undefined;
    fractionDigits: number;
    ticks: TickDatum[];
    timeInterval: AnyTimeInterval | undefined;
}
export declare function axisLabelsOverlap(data: readonly BoxBounds[], padding?: number): boolean;
export declare function ticksEqual(a: unknown[], b: unknown[]): boolean;
export declare function ticksSpacing(ticks: TickDatum[]): number;
export declare function formatTicks<S extends Scale<D, number, TickInterval<S>>, D>(options: GenerateTicksOptions<S, D>, { niceDomain, rawTicks, rawFirstTickIndex, generatePrimaryTicks, primaryTicksIndices, alignment, fractionDigits, timeInterval, }: {
    niceDomain: D[];
    rawTicks: any[];
    rawFirstTickIndex: number | undefined;
    generatePrimaryTicks: boolean;
    primaryTicksIndices: Set<number> | undefined;
    alignment: ScaleAlignment | undefined;
    fractionDigits: number;
    timeInterval: AnyTimeInterval | undefined;
}): TickDatum[];
export declare function withTemporaryDomain<S extends Scale<D, number, TickInterval<S>>, D>(scale: S, temporaryDomain: D[], callback: () => void): void;
export declare function getTimeIntervalTicks<S extends Scale<D, number, TickInterval<S>>, D>(scale: S, visibleRange: [number, number], tickCount: number, maxTickCount: number, tickParams: Readonly<ScaleTickParams<any>>, timeInterval: AnyTimeInterval, reverse: boolean, minimumTimeGranularity?: AgTimeIntervalUnit): {
    ticks: Date[];
    primaryTicksIndices: Set<number> | undefined;
    alignment: ScaleAlignment | undefined;
} | undefined;
export declare function timeIntervalMaxLabelSize(label: ChartAxisLabel, primaryLabel: ChartAxisLabel | undefined, domain: Date[], timeInterval: AgTimeInterval | AgTimeIntervalUnit, textMeasurer: ITextMeasurer): {
    width: number;
    height: number;
};
export declare function getTextBaseline(parallel: boolean, labelRotation: number, sideFlag: ChartAxisLabelFlipFlag, parallelFlipFlag: ChartAxisLabelFlipFlag): CanvasTextBaseline;
export declare function getTextAlign(parallel: boolean, labelRotation: number, labelAutoRotation: number, sideFlag: ChartAxisLabelFlipFlag, regularFlipFlag: ChartAxisLabelFlipFlag): CanvasTextAlign;
export declare function calculateLabelRotation(rotation?: number, parallel?: boolean, axisRotation?: number): {
    configuredRotation: number;
    defaultRotation: number;
    parallelFlipFlag: ChartAxisLabelFlipFlag;
    regularFlipFlag: ChartAxisLabelFlipFlag;
};
