import type { BeanCollection, ChartToolbarMenuItemOptions, IconName } from 'ag-grid-community';
import { Component } from 'ag-grid-community';
interface ChartToolbarButton {
    buttonName: ChartToolbarMenuItemOptions;
    iconName: IconName;
    callback: (eventSource: HTMLElement) => void;
}
export declare class ChartToolbar extends Component {
    private chartTranslation;
    wireBeans(beans: BeanCollection): void;
    private readonly eMenu;
    private buttonListenersDestroyFuncs;
    constructor();
    updateParams(params: {
        buttons: ChartToolbarButton[];
    }): void;
    private createButtons;
    private createButton;
    destroy(): void;
}
export {};
