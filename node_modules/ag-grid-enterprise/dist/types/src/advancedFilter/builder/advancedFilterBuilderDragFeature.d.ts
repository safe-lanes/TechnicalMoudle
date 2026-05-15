import type { AgEvent } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
import type { VirtualList } from '../../widgets/virtualList';
import type { AdvancedFilterBuilderComp } from './advancedFilterBuilderComp';
import type { AdvancedFilterBuilderItem } from './iAdvancedFilterBuilder';
export interface AdvancedFilterBuilderDragStartedEvent extends AgEvent<'advancedFilterBuilderDragStarted'> {
    item: AdvancedFilterBuilderItem;
}
type AdvancedFilterBuilderDragFeatureEvent = 'advancedFilterBuilderDragStarted' | 'advancedFilterBuilderDragEnded';
export declare class AdvancedFilterBuilderDragFeature extends BeanStub<AdvancedFilterBuilderDragFeatureEvent> {
    private readonly comp;
    private readonly virtualList;
    constructor(comp: AdvancedFilterBuilderComp, virtualList: VirtualList);
    postConstruct(): void;
    private getCurrentDragValue;
    private moveItem;
}
export {};
