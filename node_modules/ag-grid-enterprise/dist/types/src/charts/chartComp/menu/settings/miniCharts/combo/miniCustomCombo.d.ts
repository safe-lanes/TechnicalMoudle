import type { AgChartsExports } from '../../../../../agChartsExports';
import type { MiniChartSelector } from '../../miniChartsContainer';
import { MiniChart } from '../miniChart';
export declare class MiniCustomComboClass extends MiniChart {
    private readonly columns;
    private readonly lines;
    private readonly columnData;
    private readonly lineData;
    constructor(container: HTMLElement, agChartsExports: AgChartsExports, fills: string[], strokes: string[]);
    updateColors(fills: string[], strokes: string[]): void;
    buildPenIconPath(penIcon: any): void;
}
export declare const MiniCustomCombo: MiniChartSelector;
