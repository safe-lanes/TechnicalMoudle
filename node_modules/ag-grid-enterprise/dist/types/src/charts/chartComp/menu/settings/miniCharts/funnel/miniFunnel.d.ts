import type { Shape } from 'ag-charts-types/scene';
import type { AgChartsExports } from '../../../../../agChartsExports';
import type { ChartTranslationKey } from '../../../../services/chartTranslationService';
import type { MiniChartSelector } from '../../miniChartsContainer';
import { MiniChart } from '../miniChart';
import type { XYCoordShape } from '../miniChartApi';
export declare class MiniFunnelClass extends MiniChart {
    protected shapes: Shape[];
    constructor(container: HTMLElement, agChartsExports: AgChartsExports, fills: string[], strokes: string[], _isCustomTheme: boolean, tooltipName?: ChartTranslationKey, data?: XYCoordShape[]);
    updateColors(fills: string[], strokes: string[]): void;
}
export declare const MiniFunnel: MiniChartSelector;
