import type { AgChartsExports } from '../../../../../agChartsExports';
import type { MiniChartSelector } from '../../miniChartsContainer';
import { MiniChartWithAxes } from '../miniChartWithAxes';
export interface Coordinate {
    x: number;
    y: number;
}
export declare class MiniAreaColumnComboClass extends MiniChartWithAxes {
    private columns;
    private areas;
    private columnData;
    private areaData;
    constructor(container: HTMLElement, agChartsExports: AgChartsExports, fills: string[], strokes: string[]);
    updateColors(fills: string[], strokes: string[]): void;
}
export declare const MiniAreaColumnCombo: MiniChartSelector;
