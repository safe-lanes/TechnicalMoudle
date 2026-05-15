import type { ComponentType, FrameworkComponentWrapper, IComponent } from 'ag-grid-community';
export declare class DetailFrameworkComponentWrapper implements FrameworkComponentWrapper {
    private readonly parentWrapper;
    constructor(parentWrapper: FrameworkComponentWrapper);
    wrap<A extends IComponent<any>>(frameworkComponent: {
        new (): any;
    } | null, mandatoryMethods: string[] | undefined, optionalMethods: string[] | undefined, componentType: ComponentType): A;
}
