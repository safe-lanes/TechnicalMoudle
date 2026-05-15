import type { Path } from 'ag-charts-types/scene';
import type { AgChartsExports } from '../../../../../agChartsExports';
import type { ChartTranslationKey } from '../../../../services/chartTranslationService';
import type { MiniChartSelector } from '../../miniChartsContainer';
import { MiniChartWithAxes } from '../miniChartWithAxes';
export declare const miniAreaData: number[][];
export declare class MiniAreaClass extends MiniChartWithAxes {
    protected readonly areas: Path[];
    constructor(container: HTMLElement, agChartsExports: AgChartsExports, fills: string[], strokes: string[], _isCustomTheme: boolean, data?: number[][], tooltipName?: ChartTranslationKey, stacked?: boolean);
    updateColors(fills: string[], strokes: string[]): void;
}
export declare const MiniArea: MiniChartSelector;
