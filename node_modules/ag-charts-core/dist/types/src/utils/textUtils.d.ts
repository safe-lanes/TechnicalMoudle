import type { FontFamily, FontSize, FontStyle, FontWeight, TextSegment } from 'ag-charts-types';
export declare const EllipsisChar = "\u2026";
export declare const LineSplitter: RegExp;
export declare const TrimEdgeGuard = "\u200B";
export interface FontOptions {
    fontSize: FontSize;
    fontStyle?: FontStyle;
    fontWeight?: FontWeight;
    fontFamily?: FontFamily;
}
export declare function toFontString({ fontSize, fontStyle, fontWeight, fontFamily }: FontOptions): string;
export declare function calcLineHeight(fontSize: number, lineHeightRatio?: number): number;
export declare function appendEllipsis(text: string): string;
export declare function guardTextEdges(str: string): string;
export declare function unguardTextEdges(str: string): string;
export declare function isTextTruncated(str: string): boolean;
export declare function isSegmentTruncated(segment: TextSegment | undefined): boolean;
