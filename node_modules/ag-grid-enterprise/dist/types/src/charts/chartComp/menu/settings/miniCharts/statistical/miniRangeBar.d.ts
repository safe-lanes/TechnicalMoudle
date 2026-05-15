import type { AgChartsExports } from '../../../../../agChartsExports';
import type { MiniChartSelector } from '../../miniChartsContainer';
import { MiniChartWithAxes } from '../miniChartWithAxes';
export declare class MiniRangeBarClass extends MiniChartWithAxes {
    private readonly bars;
    constructor(container: HTMLElement, agChartsExports: AgChartsExports, fills: string[], strokes: string[]);
    updateColors(fills: string[], strokes: string[]): void;
    createRangeBar(root: any, data: number[], size: number, padding: number, direction: 'horizontal' | 'vertical'): any[];
}
export declare const MiniRangeBar: MiniChartSelector;
