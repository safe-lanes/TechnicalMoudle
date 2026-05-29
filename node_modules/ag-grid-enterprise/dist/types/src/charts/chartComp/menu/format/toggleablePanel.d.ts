import { Component } from 'ag-grid-community';
import type { ChartMenuParamsFactory } from '../chartMenuParamsFactory';
interface ToggleablePanelParams {
    tag: string;
    title?: string;
    suppressEnabledCheckbox?: boolean;
    chartMenuParamsFactory: ChartMenuParamsFactory;
    cssIdentifier?: string;
}
export declare class ToggleablePanel extends Component {
    private readonly params;
    private readonly toggleableGroup;
    private readonly chartOptions;
    private activeComps;
    constructor(params: ToggleablePanelParams);
    postConstruct(): void;
    addItem(comp: Component<any>, prepend?: boolean): void;
    setEnabled(enabled: boolean): void;
    private destroyActiveComps;
    destroy(): void;
}
export {};
