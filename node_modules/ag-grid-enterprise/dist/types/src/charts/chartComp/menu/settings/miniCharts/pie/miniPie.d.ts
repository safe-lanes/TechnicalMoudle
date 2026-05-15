import type { AgChartsExports } from '../../../../../agChartsExports';
import type { MiniChartSelector } from '../../miniChartsContainer';
import { MiniDonutClass } from './miniDonut';
export declare class MiniPieClass extends MiniDonutClass {
    constructor(container: HTMLElement, agChartsExports: AgChartsExports, fills: string[], strokes: string[], isCustomTheme: boolean);
}
export declare const MiniPie: MiniChartSelector;
