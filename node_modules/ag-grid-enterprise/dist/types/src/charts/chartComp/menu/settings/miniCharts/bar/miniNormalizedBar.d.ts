import type { AgChartsExports } from '../../../../../agChartsExports';
import type { MiniChartSelector } from '../../miniChartsContainer';
import { MiniStackedBarClass } from './miniStackedBar';
export declare class MiniNormalizedBarClass extends MiniStackedBarClass {
    constructor(container: HTMLElement, agChartsExports: AgChartsExports, fills: string[], strokes: string[], isCustomTheme: boolean);
}
export declare const MiniNormalizedBar: MiniChartSelector;
