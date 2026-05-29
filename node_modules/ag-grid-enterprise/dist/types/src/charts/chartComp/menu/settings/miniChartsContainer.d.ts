import type { AgColorType } from 'ag-charts-types';
import type { BeanCollection, ChartGroupsDef, ChartType } from 'ag-grid-community';
import { Component } from 'ag-grid-community';
import type { ChartController } from '../../chartController';
import type { MiniChart } from './miniCharts/miniChart';
export type MiniChartSelector = {
    chartType: ChartType;
    miniChart: new (...args: any[]) => MiniChart;
};
export declare class MiniChartsContainer extends Component {
    private chartTranslation;
    wireBeans(beans: BeanCollection): void;
    private readonly fills;
    private readonly strokes;
    private readonly isCustomTheme;
    private wrappers;
    private chartController;
    private chartGroups;
    constructor(chartController: ChartController, fills: AgColorType[], strokes: string[], isCustomTheme: boolean, chartGroups?: ChartGroupsDef);
    postConstruct(): void;
    updateSelectedMiniChart(): void;
    destroy(): void;
}
