import type { AgChartsExports } from '../../../../../agChartsExports';
import type { ChartTranslationKey } from '../../../../services/chartTranslationService';
import type { MiniChartSelector } from '../../miniChartsContainer';
import { MiniStackedAreaClass } from './miniStackedArea';
export declare const miniNormalizedAreaData: number[][];
export declare class MiniNormalizedAreaClass extends MiniStackedAreaClass {
    constructor(container: HTMLElement, agChartsExports: AgChartsExports, fills: string[], strokes: string[], isCustomTheme: boolean, data?: number[][], tooltipName?: ChartTranslationKey);
}
export declare const MiniNormalizedArea: MiniChartSelector;
