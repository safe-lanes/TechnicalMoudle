import type { AgChartsExports } from '../../../../../agChartsExports';
import type { MiniChartSelector } from '../../miniChartsContainer';
import { MiniChartWithPolarAxes } from '../miniChartWithPolarAxes';
export declare class MiniRadarLineClass extends MiniChartWithPolarAxes {
    private readonly lines;
    private readonly markers;
    private readonly markerSize;
    private data;
    constructor(container: HTMLElement, agChartsExports: AgChartsExports, fills: string[], strokes: string[]);
    updateColors(fills: string[], strokes: string[]): void;
}
export declare const MiniRadarLine: MiniChartSelector;
