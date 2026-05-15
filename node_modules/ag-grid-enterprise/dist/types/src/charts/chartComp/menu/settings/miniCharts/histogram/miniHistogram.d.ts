import type { AgChartsExports } from '../../../../../agChartsExports';
import type { MiniChartSelector } from '../../miniChartsContainer';
import { MiniChartWithAxes } from '../miniChartWithAxes';
export declare class MiniHistogramClass extends MiniChartWithAxes {
    private readonly bars;
    constructor(container: HTMLElement, agChartsExports: AgChartsExports, fills: string[], strokes: string[]);
    updateColors([fill]: string[], [stroke]: string[]): void;
}
export declare const MiniHistogram: MiniChartSelector;
