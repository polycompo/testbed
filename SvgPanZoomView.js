const VIEWER_ORIGIN = 0;
const PERCENT_MULTIPLIER = 100;
const ROUND_PRECISION = 10;
const EMPTY_VALUE = Object.freeze({});

function isFiniteNumber(value) {
    return Number.isFinite(value);
}

function clamp(value, min, max) {
    if (value < min) {
        return min;
    }

    if (value > max) {
        return max;
    }

    return value;
}

function roundToSingleDecimal(value) {
    return Math.round(value * ROUND_PRECISION) / ROUND_PRECISION;
}

function hasValidMatrix(value) {
    if (!value) {
        return false;
    }

    return isFiniteNumber(value.a)
        && isFiniteNumber(value.d)
        && isFiniteNumber(value.e)
        && isFiniteNumber(value.f);
}

export default class SvgPanZoomView {
    static fromDTO(value) {
        if (!hasValidMatrix(value)) {
            return null;
        }

        return new SvgPanZoomView(value);
    }

    constructor(value) {
        this.scaleFactor = value.a;
        this.translationX = value.e;
        this.translationY = value.f;
        this.viewerWidth = value.viewerWidth;
        this.viewerHeight = value.viewerHeight;
        this.svgMinX = value.SVGMinX;
        this.svgMinY = value.SVGMinY;
        this.svgWidth = value.SVGWidth;
        this.svgHeight = value.SVGHeight;
        this.rawValue = Object.freeze({ ...value });
        Object.freeze(this);
    }

    toDTO() {
        return this.rawValue;
    }

    getZoomPercent() {
        return roundToSingleDecimal(this.scaleFactor * PERCENT_MULTIPLIER);
    }

    getVisibleBounds() {
        const unclampedX = (VIEWER_ORIGIN - this.translationX) / this.scaleFactor;
        const unclampedY = (VIEWER_ORIGIN - this.translationY) / this.scaleFactor;
        const visibleWidth = this.viewerWidth / this.scaleFactor;
        const visibleHeight = this.viewerHeight / this.scaleFactor;
        const maxVisibleX = Math.max(this.svgMinX, this.svgMinX + this.svgWidth - visibleWidth);
        const maxVisibleY = Math.max(this.svgMinY, this.svgMinY + this.svgHeight - visibleHeight);

        return Object.freeze({
            x: roundToSingleDecimal(clamp(unclampedX, this.svgMinX, maxVisibleX)),
            y: roundToSingleDecimal(clamp(unclampedY, this.svgMinY, maxVisibleY)),
            width: roundToSingleDecimal(visibleWidth),
            height: roundToSingleDecimal(visibleHeight),
        });
    }

    getSummary() {
        const bounds = this.getVisibleBounds();

        return Object.freeze({
            zoomPercent: this.getZoomPercent(),
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
        });
    }
}

export function createEmptyPanZoomViewDTO() {
    return EMPTY_VALUE;
}
