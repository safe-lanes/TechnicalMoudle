import type { AgChartsExports } from '../../../../../agChartsExports';
import type { MiniChartSelector } from '../../miniChartsContainer';
import { MiniStackedColumnClass } from './miniStackedColumn';
export declare const miniNormalizedColumnData: number[][];
export declare class MiniNormalizedColumnClass extends MiniStackedColumnClass {
    constructor(container: HTMLElement, agChartsExports: AgChartsExports, fills: string[], strokes: string[], isCustomTheme: boolean);
}
export declare const MiniNormalizedColumn: MiniChartSelector;
