import type { AgChartsExports } from '../../../../../agChartsExports';
import type { MiniChartSelector } from '../../miniChartsContainer';
import { MiniChartWithPolarAxes } from '../miniChartWithPolarAxes';
export declare class MiniRadarAreaClass extends MiniChartWithPolarAxes {
    private readonly areas;
    private data;
    constructor(container: HTMLElement, agChartsExports: AgChartsExports, fills: string[], strokes: string[]);
    updateColors(fills: string[], strokes: string[]): void;
}
export declare const MiniRadarArea: MiniChartSelector;
