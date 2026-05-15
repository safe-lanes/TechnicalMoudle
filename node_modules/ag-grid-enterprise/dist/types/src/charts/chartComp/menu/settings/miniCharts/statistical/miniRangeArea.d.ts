import type { AgChartsExports } from '../../../../../agChartsExports';
import type { MiniChartSelector } from '../../miniChartsContainer';
import { MiniChartWithAxes } from '../miniChartWithAxes';
export declare class MiniRangeAreaClass extends MiniChartWithAxes {
    private readonly lines;
    private readonly areas;
    constructor(container: HTMLElement, agChartsExports: AgChartsExports, fills: string[], strokes: string[]);
    updateColors(fills: string[], strokes: string[]): void;
    createRangeArea(root: any, data: Array<Array<{
        x: number;
        low: number;
        high: number;
    }>>, size: number, padding: number): {
        lines: any[][];
        areas: any[];
    };
}
export declare const MiniRangeArea: MiniChartSelector;
