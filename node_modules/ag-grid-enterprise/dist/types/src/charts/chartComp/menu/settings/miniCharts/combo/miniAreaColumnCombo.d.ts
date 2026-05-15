import type { AgChartsExports } from '../../../../../agChartsExports';
import type { MiniChartSelector } from '../../miniChartsContainer';
import { MiniChartWithAxes } from '../miniChartWithAxes';
export interface Coordinate {
    x: number;
    y: number;
}
export declare class MiniAreaColumnComboClass extends MiniChartWithAxes {
    private readonly columns;
    private readonly areas;
    private readonly columnData;
    private readonly areaData;
    constructor(container: HTMLElement, agChartsExports: AgChartsExports, fills: string[], strokes: string[]);
    updateColors(fills: string[], strokes: string[]): void;
}
export declare const MiniAreaColumnCombo: MiniChartSelector;
