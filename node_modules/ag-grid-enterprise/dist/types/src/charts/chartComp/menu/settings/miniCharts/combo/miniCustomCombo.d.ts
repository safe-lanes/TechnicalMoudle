import type { AgChartsExports } from '../../../../../agChartsExports';
import type { MiniChartSelector } from '../../miniChartsContainer';
import { MiniChart } from '../miniChart';
export declare class MiniCustomComboClass extends MiniChart {
    private columns;
    private lines;
    private columnData;
    private lineData;
    constructor(container: HTMLElement, agChartsExports: AgChartsExports, fills: string[], strokes: string[]);
    updateColors(fills: string[], strokes: string[]): void;
    buildPenIconPath(penIcon: any): void;
}
export declare const MiniCustomCombo: MiniChartSelector;
