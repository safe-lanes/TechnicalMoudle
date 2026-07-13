import { _ModuleSupport } from 'ag-charts-community';
import type { SharedToolbarSection } from './sharedToolbarTypes';
export interface SharedToolbarWithSection<ButtonOptions extends _ModuleSupport.ToolbarButtonOptions = _ModuleSupport.ToolbarButtonOptions> extends Pick<_ModuleSupport.Toolbar<ButtonOptions>, 'destroy' | 'addListener' | 'removeListener' | 'setHidden' | 'addToolbarListener' | 'updateButtons' | 'updateButtonByIndex' | 'toggleActiveButtonByIndex' | 'toggleButtonEnabledByIndex' | 'clearActiveButton'> {
    layout: (layoutBox: _ModuleSupport.BBox, padding?: number) => void;
}
export declare class SharedToolbar extends _ModuleSupport.BaseModuleInstance implements _ModuleSupport.ModuleInstance {
    private readonly ctx;
    static readonly SECTION_ORDER: Array<SharedToolbarSection>;
    private readonly container;
    private sharedToolbar?;
    private readonly activeSections;
    private readonly sectionButtons;
    private firstLayoutSection?;
    constructor(ctx: _ModuleSupport.ModuleContext);
    getSharedToolbar<ButtonOptions extends _ModuleSupport.ToolbarButtonOptions>(section: SharedToolbarSection): SharedToolbarWithSection<ButtonOptions>;
    private createSharedToolbar;
    private toolbarWithSection;
    private getIndex;
    private getSectionIndex;
}
