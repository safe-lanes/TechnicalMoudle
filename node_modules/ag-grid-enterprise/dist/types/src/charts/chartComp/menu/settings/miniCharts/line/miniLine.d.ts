import type { Path } from 'ag-charts-types/scene';
import type { AgChartsExports } from '../../../../../agChartsExports';
import type { ChartTranslationKey } from '../../../../services/chartTranslationService';
import type { MiniChartSelector } from '../../miniChartsContainer';
import { MiniChartWithAxes } from '../miniChartWithAxes';
export declare const miniLineData: number[][];
export declare class MiniLineClass extends MiniChartWithAxes {
    protected lines: Path[];
    constructor(container: HTMLElement, agChartsExports: AgChartsExports, fills: string[], strokes: string[], _isCustomTheme: boolean, data?: number[][], tooltipName?: ChartTranslationKey);
    updateColors(fills: string[], _strokes: string[]): void;
}
export declare const MiniLine: MiniChartSelector;
