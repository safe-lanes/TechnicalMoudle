import type { TextSegment } from 'ag-charts-types';
import type { Writeable } from '../interfaces/globalTypes';
import type { Size } from './boxBounds';
import { type FontOptions } from './textUtils';
export interface TextMetricsBox {
    width: number;
    height: number;
    ascent: number;
    descent: number;
}
export interface LineMetricsBox extends TextMetricsBox {
    text: string;
}
export interface MultilineTextMetricsBox {
    width: number;
    height: number;
    lineMetrics: LineMetricsBox[];
}
export interface MeasuredSegment extends TextSegment {
    fontSize: number;
    textMetrics: TextMetricsBox;
}
export interface SegmentsLineMetrics extends Size {
    ascent: number;
    descent: number;
    segments: MeasuredSegment[];
}
export interface MultilineSegmentsMetricsBox {
    width: number;
    height: number;
    lineMetrics: SegmentsLineMetrics[];
}
export interface LegacyTextMetrics extends Writeable<TextMetrics> {
    emHeightAscent: number;
    emHeightDescent: number;
}
export interface ITextMeasurer {
    measureText(text: string): TextMetricsBox;
    measureLines(text: string | string[]): MultilineTextMetricsBox;
    baselineDistance(textBaseline: CanvasTextBaseline): number;
    textWidth(text: string, estimate?: boolean): number;
    lineHeight(): number;
}
export declare class TextMeasurer implements ITextMeasurer {
    private readonly ctx;
    private readonly measureTextCached?;
    private readonly baselineMap;
    private readonly charMap;
    private lineHeightCache;
    constructor(ctx: CanvasRenderingContext2D, measureTextCached?: ((text: string, useCache?: boolean) => LegacyTextMetrics) | undefined);
    baselineDistance(textBaseline: CanvasTextBaseline): number;
    lineHeight(): number;
    measureText(text: string): TextMetricsBox;
    measureLines(text: string | string[]): MultilineTextMetricsBox;
    textWidth(text: string, estimate?: boolean): number;
    private charWidth;
}
export declare function cachedTextMeasurer(font: string | FontOptions): TextMeasurer;
export declare namespace cachedTextMeasurer {
    var clear: () => void;
}
export declare function measureTextSegments(textSegments: TextSegment[], defaultFont: FontOptions): MultilineSegmentsMetricsBox;
