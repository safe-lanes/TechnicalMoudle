import type { CollapseOpts, ExpandOpts, ExpandableWidget } from './expandableWidget';
import { MenuItemWidget } from './menuItemWidget';
import type { RovingDirection } from './rovingDirection';
import { RovingTabContainerWidget } from './rovingTabContainerWidget';
export declare class MenuWidget extends RovingTabContainerWidget<MenuItemWidget> implements ExpandableWidget<HTMLDivElement> {
    private expansionScope?;
    constructor(orientation?: RovingDirection);
    protected destructor(): void;
    addSeparator(): Element;
    protected onChildAdded(child: MenuItemWidget): void;
    protected onChildRemoved(child: MenuItemWidget): void;
    private readonly handleMouseEnter;
    private readonly handleMouseMove;
    addSubMenu(): {
        subMenuButton: MenuItemWidget;
        subMenu: MenuWidget;
    };
    private expandSubMenu;
    private collapseExpandedSubMenu;
    expand(opts: ExpandOpts): void;
    collapse(opts?: CollapseOpts): void;
}
