import type { ContainerType, IAfterGuiAttachedParams, IMultiFilterDef, SharedFilterUi } from 'ag-grid-community';
import { AgPromise, TabGuardComp } from 'ag-grid-community';
export interface BaseFilterComponent {
    getGui(): HTMLElement;
}
export declare abstract class BaseMultiFilter<TFilterWrapper> extends TabGuardComp {
    protected filterDefs: IMultiFilterDef[];
    private guiDestroyFuncs;
    private filterGuis;
    private lastOpenedInContainer?;
    private lastActivatedMenuItem;
    private hidePopup?;
    constructor();
    protected abstract getFilterWrappers(): (TFilterWrapper | null)[];
    protected abstract getFilterFromWrapper(wrapper: TFilterWrapper): SharedFilterUi;
    protected abstract getCompFromWrapper(wrapper: TFilterWrapper): BaseFilterComponent;
    postConstruct(): void;
    protected refreshGui(container: ContainerType): AgPromise<void>;
    private destroyChildren;
    private insertFilterMenu;
    private insertFilterGroup;
    afterGuiAttached(params?: IAfterGuiAttachedParams): void;
    afterGuiDetached(): void;
    onAnyFilterChanged(): void;
    onNewRowsLoaded(): void;
    destroy(): void;
    protected executeOnWrapper(_wrapper: TFilterWrapper, _name: 'onAnyFilterChanged' | 'onNewRowsLoaded'): void;
    private executeFunctionIfExists;
    private executeFunctionIfExistsOnFilter;
    protected onFocusIn(e: FocusEvent): void;
}
