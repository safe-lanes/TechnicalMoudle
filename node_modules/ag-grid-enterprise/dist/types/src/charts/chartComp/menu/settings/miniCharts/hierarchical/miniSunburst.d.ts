import type { AgChartsExports } from '../../../../../agChartsExports';
import type { MiniChartSelector } from '../../miniChartsContainer';
import { MiniChartWithPolarAxes } from '../miniChartWithPolarAxes';
export declare class MiniSunburstClass extends MiniChartWithPolarAxes {
    private readonly series;
    private data;
    private angleOffset;
    private innerRadiusRatio;
    constructor(container: HTMLElement, agChartsExports: AgChartsExports, fills: string[], strokes: string[]);
    updateColors(fills: string[], strokes: string[]): void;
}
export declare const MiniSunburst: MiniChartSelector;
