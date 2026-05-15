import type { AgChartsExports } from '../../../../../agChartsExports';
import type { ChartTranslationKey } from '../../../../services/chartTranslationService';
import type { MiniChartSelector } from '../../miniChartsContainer';
import { MiniLineClass } from './miniLine';
export declare const miniNormalizedLineData: number[][];
export declare class MiniNormalizedLineClass extends MiniLineClass {
    constructor(container: HTMLElement, agChartsExports: AgChartsExports, fills: string[], strokes: string[], isCustomTheme: boolean, data?: number[][], tooltipName?: ChartTranslationKey);
}
export declare const MiniNormalizedLine: MiniChartSelector;
