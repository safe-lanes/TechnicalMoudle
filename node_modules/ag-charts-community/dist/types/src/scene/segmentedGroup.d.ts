import { TranslatableGroup } from './group';
import { type RenderContext } from './node';
import { type Segment } from './shape/segmentedPath';
export declare class SegmentedGroup extends TranslatableGroup {
    segments?: Segment[];
    private readonly scalablePath;
    protected renderInContext(childRenderCtx: RenderContext): void;
}
