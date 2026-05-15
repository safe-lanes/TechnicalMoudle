import type { AgChartsExports } from '../../../../../agChartsExports';
import type { ChartTranslationKey } from '../../../../services/chartTranslationService';
import type { MiniChartSelector } from '../../miniChartsContainer';
import { MiniFunnelClass } from './miniFunnel';
export declare class MiniConeFunnelClass extends MiniFunnelClass {
    constructor(container: HTMLElement, agChartsExports: AgChartsExports, fills: string[], strokes: string[], _isCustomTheme: boolean, tooltipName?: ChartTranslationKey);
    updateColors(fills: string[], strokes: string[]): void;
}
export declare const MiniConeFunnel: MiniChartSelector;
