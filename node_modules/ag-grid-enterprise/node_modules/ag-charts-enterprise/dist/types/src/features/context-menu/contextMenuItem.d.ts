import type { AgContextMenuItem, AgContextMenuItemShowOn, AgContextMenuItemType, _ModuleSupport } from 'ag-charts-community';
type Options = Partial<_ModuleSupport.ContextMenuItemContractNonRecursive>;
export declare function expandItems(showing: AgContextMenuItemShowOn, registry: _ModuleSupport.ContextMenuRegistry, items: readonly Readonly<AgContextMenuItem>[], result: ContextMenuItem[]): void;
export declare class ContextMenuItem implements _ModuleSupport.ContextMenuItemContract {
    type: AgContextMenuItemType;
    showOn: AgContextMenuItemShowOn;
    label: string;
    iconUrl: string | undefined;
    enabled: boolean;
    items: ContextMenuItem[];
    action: _ModuleSupport.ContextMenuItemContract['action'];
    constructor(options?: Options);
    private setField;
    setOptions(options: Options): void;
}
export {};
