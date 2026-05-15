import type { AgChartsExports } from '../../../../../agChartsExports';
import type { MiniChartSelector } from '../../miniChartsContainer';
import { MiniChart } from '../miniChart';
export declare class MiniHeatmapClass extends MiniChart {
    private readonly rects;
    constructor(container: HTMLElement, agChartsExports: AgChartsExports, fills: string[], strokes: string[], isCustomTheme: boolean);
    updateColors(fills: string[], strokes: string[], isCustomTheme?: boolean): void;
}
export declare const MiniHeatmap: MiniChartSelector;
