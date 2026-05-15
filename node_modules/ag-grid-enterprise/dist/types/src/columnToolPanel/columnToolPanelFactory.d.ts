import type { BeanName, Component, NamedBean } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
import { PivotDropZonePanel } from '../rowGrouping/columnDropZones/pivotDropZonePanel';
import { RowGroupDropZonePanel } from '../rowGrouping/columnDropZones/rowGroupDropZonePanel';
import { ValuesDropZonePanel } from '../rowGrouping/columnDropZones/valueDropZonePanel';
import { PivotModePanel } from './pivotModePanel';
export declare class ColumnToolPanelFactory extends BeanStub implements NamedBean {
    beanName: BeanName;
    setPanelVisible<C extends RowGroupDropZonePanel | ValuesDropZonePanel | PivotDropZonePanel | PivotModePanel>(existingPanel: C | undefined, visible: boolean, createFunc: () => C): C | undefined;
    createRowGroupPanel(parent: Component, destroyFuncs: (() => void)[]): RowGroupDropZonePanel;
    createValuesPanel(parent: Component, destroyFuncs: (() => void)[]): ValuesDropZonePanel;
    createPivotPanel(parent: Component, destroyFuncs: (() => void)[]): PivotDropZonePanel;
    createPivotModePanel(parent: Component, destroyFuncs: (() => void)[], prepend?: boolean): PivotModePanel;
    private createPanel;
}
