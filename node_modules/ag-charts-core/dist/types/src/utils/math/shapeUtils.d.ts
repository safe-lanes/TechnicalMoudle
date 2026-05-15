import type { Point, Size } from '../boxBounds';
/**
 * Calculates the maximum width and height of an inner rectangle that can be
 * rotated by a given angle (in degrees) and still fully fit within a container.
 *
 * @param rotationDeg - Rotation angle in degrees.
 * @param containerWidth - Width of the outer container.
 * @param containerHeight - Optional height of the container (defaults to Infinity).
 * @returns The largest inner rectangle size that fits when rotated.
 */
export declare function getMaxInnerRectSize(rotationDeg: number, containerWidth: number, containerHeight?: number): Size;
/**
 * Calculates the minimum axis-aligned outer rectangle that fully contains
 * an inner rectangle of the given size when rotated by a specified angle.
 *
 * @param rotationDeg - Rotation angle in degrees.
 * @param innerWidth - Width of the inner rectangle.
 * @param innerHeight - Height of the inner rectangle (defaults to Infinity).
 * @returns The smallest outer rectangle that contains the rotated inner rectangle.
 */
export declare function getMinOuterRectSize(rotationDeg: number, innerWidth: number, innerHeight?: number): Size;
export declare function rotatePoint(x: number, y: number, angle: number, // in radians
originX?: number, originY?: number): Point;
