import { _ModuleSupport } from 'ag-charts-community';
import { AxesButtons } from './annotationAxesButtons';
import { AnnotationOptionsToolbar } from './annotationOptionsToolbar';
import { AnnotationsToolbar } from './annotationsToolbar';
export declare class Annotations extends _ModuleSupport.BaseModuleInstance implements _ModuleSupport.ModuleInstance {
    private readonly ctx;
    enabled: boolean;
    readonly toolbar: AnnotationsToolbar;
    optionsToolbar: AnnotationOptionsToolbar;
    axesButtons: AxesButtons;
    snap: boolean;
    data?: any[];
    xKey?: string;
    volumeKey?: string;
    private readonly state;
    private readonly annotationData;
    private readonly defaults;
    private dataModel?;
    private processedData?;
    private seriesRect?;
    private readonly container;
    private readonly annotations;
    private readonly settingsDialog;
    private readonly textInput;
    private xAxis?;
    private yAxis?;
    constructor(ctx: _ModuleSupport.ModuleContext);
    private setupStateMachine;
    private setupListeners;
    private setupDOM;
    processData(dataController: _ModuleSupport.DataController): Promise<void>;
    /**
     * Create an annotation scene within the `this.annotations` scene selection. This method is automatically called by
     * the selection when a new scene is required.
     */
    private createAnnotationScene;
    /**
     * Create an annotation datum within the `this.annotationData` properties array. It is created as an instance
     * of `AnnotationProperties` from the given config for its type. This method is only called when annotations
     * are added from the initial state.
     */
    private static createAnnotationDatum;
    /**
     * Append an annotation datum to `this.annotationData`, applying default styles. This method is called when a user
     * interacts with the chart to draw their own annotations.
     */
    private createAnnotation;
    private injectDatumDependencies;
    private getDatumRangeVolume;
    private translateNode;
    private createAnnotationDatumCopy;
    private getAnnotationConfig;
    private onRestoreAnnotations;
    private onLayoutComplete;
    private showAnnotations;
    private animateAnnotations;
    private onPreRender;
    private getAxis;
    private recordActionAfterNextUpdate;
    private setColorAndDefault;
    private setFontSizeAndDefault;
    private setLineStyleTypeAndDefault;
    private setLineStyleWidthAndDefault;
    private updateAnnotations;
    private postUpdateFns;
    private getAnnotationContext;
    private onHover;
    private onClick;
    private onDoubleClick;
    private onAxisButtonClick;
    private onResize;
    private hoverTouchPreHandler;
    private dragMoveTouchPreHandler;
    private onDragStart;
    private onDrag;
    private onDragEnd;
    private onCancel;
    private onDelete;
    private onTextInput;
    private onKeyDown;
    private onKeyUp;
    private clear;
    private reset;
    private cancel;
    private delete;
    private deleteAll;
    private deleteEphemeralAnnotations;
    private hideOverlays;
    private pushAnnotationState;
    private popAnnotationState;
    private isAnnotationState;
    private update;
}
