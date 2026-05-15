import type { Group, Scene } from 'ag-charts-types/scene';
import type { BeanCollection } from 'ag-grid-community';
import { Component } from 'ag-grid-community';
import type { AgChartsExports } from '../../../../agChartsExports';
import type { ChartTranslationKey } from '../../../services/chartTranslationService';
export declare abstract class MiniChart extends Component {
    protected readonly agChartsExports: AgChartsExports;
    protected tooltipName: ChartTranslationKey;
    private chartTranslation;
    wireBeans(beans: BeanCollection): void;
    protected readonly size: number;
    protected readonly padding: number;
    protected readonly root: Group;
    protected readonly scene: Scene;
    constructor(container: HTMLElement, agChartsExports: AgChartsExports, tooltipName: ChartTranslationKey);
    postConstruct(): void;
    abstract updateColors(fills: string[], strokes: string[]): void;
}
