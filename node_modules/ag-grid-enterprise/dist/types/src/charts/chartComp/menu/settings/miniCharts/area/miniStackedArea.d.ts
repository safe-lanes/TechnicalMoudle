import type { AgChartsExports } from '../../../../../agChartsExports';
import type { ChartTranslationKey } from '../../../../services/chartTranslationService';
import type { MiniChartSelector } from '../../miniChartsContainer';
import { MiniAreaClass } from './miniArea';
export declare const miniStackedAreaData: number[][];
export declare class MiniStackedAreaClass extends MiniAreaClass {
    constructor(container: HTMLElement, agChartsExports: AgChartsExports, fills: string[], strokes: string[], _isCustomTheme: boolean, data?: number[][], tooltipName?: ChartTranslationKey);
    updateColors(fills: string[], strokes: string[]): void;
}
export declare const MiniStackedArea: MiniChartSelector;
