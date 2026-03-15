import React from "react";
import { POSITION_RIGHT } from "react-svg-pan-zoom";
import SvgPanZoomView from "../../domain/svg-pan-zoom/SvgPanZoomView";

const MINI_MAP_WIDTH = 192;
const MINI_MAP_HEIGHT = 128;
const MINI_MAP_BOTTOM = 16;
const MINI_MAP_SIDE = 16;
const MINI_MAP_LABEL_GAP = 8;
const MINI_MAP_BORDER_RADIUS = 18;
const MINI_MAP_VIEWPORT_STROKE = "#7dd3fc";
const MINI_MAP_VIEWPORT_FILL = "rgba(125, 211, 252, 0.18)";
const MINI_MAP_OUTLINE = "rgba(148, 163, 184, 0.22)";
const MINI_MAP_HINT = "배경 클릭 또는 박스 드래그";
const DRAG_DISTANCE_THRESHOLD = 3;
const CLICK_SUPPRESSION_WINDOW = 250;
const DEFAULT_MINI_MAP_POINT = Object.freeze({ x: 0, y: 0 });
const DEFAULT_DRAG_OFFSET = Object.freeze({ x: 0, y: 0 });

/**
 * 제한 범위를 벗어난 값을 경계 안으로 고정한다.
 *
 * @param {number} value 대상 값
 * @param {number} min 최소값
 * @param {number} max 최대값
 * @returns {number}
 */
function clampValue(value, min, max) {
    if (value < min) {
        return min;
    }

    if (value > max) {
        return max;
    }

    return value;
}

/**
 * 미니맵 모듈의 절대 위치 스타일을 만든다.
 *
 * @param {string} position 미니맵 배치 방향
 * @returns {Object}
 */
function createModuleStyle(position) {
    return Object.freeze({
        position: "absolute",
        bottom: `${MINI_MAP_BOTTOM}px`,
        [position === POSITION_RIGHT ? "right" : "left"]: `${MINI_MAP_SIDE}px`,
        display: "flex",
        flexDirection: "column",
        gap: `${MINI_MAP_LABEL_GAP}px`,
        zIndex: 2,
    });
}

/**
 * 미니맵 내부에 전체 SVG를 맞추기 위한 축소 배율과 평행 이동을 계산한다.
 *
 * @param {Object} value react-svg-pan-zoom value
 * @returns {{zoomToFit: number, translateX: number, translateY: number}}
 */
function createMiniMapTransform(value) {
    const ratio = value.SVGHeight / value.SVGWidth;
    const zoomToFit = ratio >= 1
        ? MINI_MAP_HEIGHT / value.SVGHeight
        : MINI_MAP_WIDTH / value.SVGWidth;

    if (ratio >= 1) {
        return Object.freeze({
            zoomToFit,
            translateX: (MINI_MAP_WIDTH - (value.SVGWidth * zoomToFit)) / 2 - (value.SVGMinX * zoomToFit),
            translateY: -value.SVGMinY * zoomToFit,
        });
    }

    return Object.freeze({
        zoomToFit,
        translateX: -value.SVGMinX * zoomToFit,
        translateY: (MINI_MAP_HEIGHT - (value.SVGHeight * zoomToFit)) / 2 - (value.SVGMinY * zoomToFit),
    });
}

/**
 * 현재 뷰포트 중심 좌표를 SVG 좌표계로 계산한다.
 *
 * @param {SvgPanZoomView} panZoomView 도메인 뷰 객체
 * @returns {{x: number, y: number}}
 */
function createViewportCenterPoint(panZoomView) {
    const visibleBounds = panZoomView.getViewportBounds();

    return Object.freeze({
        x: visibleBounds.x + (visibleBounds.width / 2),
        y: visibleBounds.y + (visibleBounds.height / 2),
    });
}

/**
 * 미니맵 위 뷰포트 박스의 렌더 좌표를 계산한다.
 *
 * @param {SvgPanZoomView} panZoomView 도메인 뷰 객체
 * @param {{zoomToFit: number, translateX: number, translateY: number}} miniMapTransform 미니맵 변환 정보
 * @returns {{x: number, y: number, width: number, height: number}}
 */
function createViewportRect(panZoomView, miniMapTransform) {
    const visibleBounds = panZoomView.getViewportBounds();

    return Object.freeze({
        x: miniMapTransform.translateX + (visibleBounds.x * miniMapTransform.zoomToFit),
        y: miniMapTransform.translateY + (visibleBounds.y * miniMapTransform.zoomToFit),
        width: visibleBounds.width * miniMapTransform.zoomToFit,
        height: visibleBounds.height * miniMapTransform.zoomToFit,
    });
}

/**
 * 브라우저 클라이언트 좌표를 미니맵 내부 좌표로 바꾼다.
 *
 * @param {{clientX: number, clientY: number, hostRect: DOMRect}} params 포인터 위치와 호스트 영역
 * @returns {{x: number, y: number}}
 */
function createMiniMapPointFromClientPoint({ clientX, clientY, hostRect }) {
    return Object.freeze({
        x: clientX - hostRect.left,
        y: clientY - hostRect.top,
    });
}

/**
 * 드래그 상태의 초기값을 만든다.
 *
 * @returns {null}
 */
function createEmptyDragState() {
    return null;
}

/**
 * 포인터가 뷰포트 중심에서 얼마나 떨어져 있는지 계산한다.
 *
 * @param {{x: number, y: number}} pointerSvgPoint 포인터의 SVG 좌표
 * @param {{x: number, y: number}} viewportCenterPoint 현재 뷰포트 중심
 * @returns {{x: number, y: number}}
 */
function createDragOffset(pointerSvgPoint, viewportCenterPoint) {
    return Object.freeze({
        x: pointerSvgPoint.x - viewportCenterPoint.x,
        y: pointerSvgPoint.y - viewportCenterPoint.y,
    });
}

/**
 * 클릭이 아니라 드래그로 판정할 만큼 충분히 움직였는지 계산한다.
 *
 * @param {{x: number, y: number}} startClientPoint 드래그 시작점
 * @param {{x: number, y: number}} nextClientPoint 현재 포인터 위치
 * @returns {boolean}
 */
function hasExceededDragThreshold(startClientPoint, nextClientPoint) {
    const deltaX = nextClientPoint.x - startClientPoint.x;
    const deltaY = nextClientPoint.y - startClientPoint.y;

    return Math.abs(deltaX) > DRAG_DISTANCE_THRESHOLD || Math.abs(deltaY) > DRAG_DISTANCE_THRESHOLD;
}

/**
 * 미니맵 좌표를 SVG 좌표로 환산한다.
 *
 * @param {{x: number, y: number}} miniMapPoint 미니맵 내부 좌표
 * @param {{zoomToFit: number, translateX: number, translateY: number}} miniMapTransform 미니맵 변환 정보
 * @returns {{x: number, y: number}}
 */
function convertMiniMapPointToSvgPoint(miniMapPoint, miniMapTransform) {
    return Object.freeze({
        x: (miniMapPoint.x - miniMapTransform.translateX) / miniMapTransform.zoomToFit,
        y: (miniMapPoint.y - miniMapTransform.translateY) / miniMapTransform.zoomToFit,
    });
}

/**
 * 미니맵 내부 좌표를 실제 렌더 가능한 범위로 고정한다.
 *
 * @param {{x: number, y: number}} miniMapPoint 미니맵 좌표
 * @returns {{x: number, y: number}}
 */
function clampMiniMapPoint(miniMapPoint) {
    return Object.freeze({
        x: clampValue(miniMapPoint.x, DEFAULT_MINI_MAP_POINT.x, MINI_MAP_WIDTH),
        y: clampValue(miniMapPoint.y, DEFAULT_MINI_MAP_POINT.y, MINI_MAP_HEIGHT),
    });
}

/**
 * SVG 영역 경계를 넘지 않도록 뷰포트 중심을 고정한다.
 *
 * @param {SvgPanZoomView} panZoomView 도메인 뷰 객체
 * @param {{x: number, y: number}} nextCenterPoint 이동할 중심점
 * @returns {{x: number, y: number}}
 */
function clampViewportCenterPoint(panZoomView, nextCenterPoint) {
    const visibleBounds = panZoomView.getVisibleBounds();
    const halfVisibleWidth = visibleBounds.width / 2;
    const halfVisibleHeight = visibleBounds.height / 2;
    const minCenterX = panZoomView.svgMinX + halfVisibleWidth;
    const maxCenterX = panZoomView.svgMinX + panZoomView.svgWidth - halfVisibleWidth;
    const minCenterY = panZoomView.svgMinY + halfVisibleHeight;
    const maxCenterY = panZoomView.svgMinY + panZoomView.svgHeight - halfVisibleHeight;

    return Object.freeze({
        x: clampValue(nextCenterPoint.x, Math.min(minCenterX, maxCenterX), Math.max(minCenterX, maxCenterX)),
        y: clampValue(nextCenterPoint.y, Math.min(minCenterY, maxCenterY), Math.max(minCenterY, maxCenterY)),
    });
}

/**
 * 현재 배율을 유지한 채 뷰포트 중심을 이동한 새로운 viewer value를 만든다.
 *
 * @param {Object} value react-svg-pan-zoom value
 * @param {SvgPanZoomView} panZoomView 도메인 뷰 객체
 * @param {{zoomToFit: number, translateX: number, translateY: number}} miniMapTransform 미니맵 변환 정보
 * @param {{x: number, y: number}} miniMapPoint 미니맵 좌표
 * @param {{x: number, y: number}} dragOffset 포인터와 뷰포트 중심 간 오프셋
 * @returns {Object}
 */
function createMovedViewerValue(value, panZoomView, miniMapTransform, miniMapPoint, dragOffset) {
    const clampedMiniMapPoint = clampMiniMapPoint(miniMapPoint);
    const pointerSvgPoint = convertMiniMapPointToSvgPoint(clampedMiniMapPoint, miniMapTransform);
    const unclampedCenterPoint = Object.freeze({
        x: pointerSvgPoint.x - dragOffset.x,
        y: pointerSvgPoint.y - dragOffset.y,
    });
    const centerPoint = clampViewportCenterPoint(panZoomView, unclampedCenterPoint);

    return Object.freeze({
        ...value,
        a: panZoomView.scaleFactor,
        d: panZoomView.scaleFactor,
        e: (panZoomView.viewerWidth / 2) - (centerPoint.x * panZoomView.scaleFactor),
        f: (panZoomView.viewerHeight / 2) - (centerPoint.y * panZoomView.scaleFactor),
        lastAction: null,
    });
}

/**
 * 미니맵 상호작용에 필요한 클릭과 드래그 핸들러를 만든다.
 *
 * @param {Object} params 훅 입력값
 * @param {React.MutableRefObject<HTMLElement|null>} params.hostRef 미니맵 DOM 참조
 * @param {Object} params.value react-svg-pan-zoom value
 * @param {SvgPanZoomView} params.panZoomView 도메인 뷰 객체
 * @param {{zoomToFit: number, translateX: number, translateY: number}} params.miniMapTransform 미니맵 변환 정보
 * @param {(nextValue: Object) => void} params.onChangeValue value 갱신 함수
 * @returns {{handleMiniMapClick: Function, handleViewportPointerDown: Function}}
 */
function useMiniMapInteractions({
    hostRef,
    value,
    panZoomView,
    miniMapTransform,
    onChangeValue,
}) {
    const dragStateRef = React.useRef(createEmptyDragState());
    const suppressClickRef = React.useRef(0);

    /**
     * 전달받은 미니맵 좌표 기준으로 메인 뷰포트를 이동한다.
     *
     * @param {{x: number, y: number}} miniMapPoint 미니맵 좌표
     * @param {{x: number, y: number}} dragOffset 포인터와 중심 간 오프셋
     * @returns {void}
     */
    const moveViewportCenter = React.useCallback((miniMapPoint, dragOffset) => {
        onChangeValue(
            createMovedViewerValue(value, panZoomView, miniMapTransform, miniMapPoint, dragOffset)
        );
    }, [miniMapTransform, onChangeValue, panZoomView, value]);

    /**
     * 현재 드래그 상태를 종료한다.
     *
     * @returns {void}
     */
    const endDrag = React.useCallback(() => {
        dragStateRef.current = createEmptyDragState();
    }, []);

    React.useEffect(() => {
        /**
         * 포인터 이동에 맞춰 뷰포트 박스를 따라 움직인다.
         *
         * @param {PointerEvent} event 브라우저 포인터 이벤트
         * @returns {void}
         */
        const handlePointerMove = (event) => {
            const dragState = dragStateRef.current;

            if (!dragState) {
                return;
            }

            if (hasExceededDragThreshold(dragState.startClientPoint, {
                x: event.clientX,
                y: event.clientY,
            })) {
                dragStateRef.current = Object.freeze({
                    ...dragState,
                    hasMoved: true,
                });
            }

            moveViewportCenter(
                createMiniMapPointFromClientPoint({
                    clientX: event.clientX,
                    clientY: event.clientY,
                    hostRect: dragStateRef.current.hostRect,
                }),
                dragStateRef.current.dragOffset
            );
        };

        /**
         * 전역 드래그를 종료하고 직후 클릭을 잠깐 막는다.
         *
         * @param {PointerEvent} event 브라우저 포인터 이벤트
         * @returns {void}
         */
        const handlePointerUp = (event) => {
            if (dragStateRef.current && dragStateRef.current.hasMoved) {
                suppressClickRef.current = event.timeStamp;
            }

            endDrag();
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
        window.addEventListener("pointercancel", handlePointerUp);

        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
            window.removeEventListener("pointercancel", handlePointerUp);
        };
    }, [endDrag, moveViewportCenter]);

    /**
     * 미니맵 배경 클릭 시 해당 위치로 중심을 이동한다.
     *
     * @param {React.MouseEvent<HTMLElement>} event React 클릭 이벤트
     * @returns {void}
     */
    const handleMiniMapClick = React.useCallback((event) => {
        if (event.timeStamp - suppressClickRef.current < CLICK_SUPPRESSION_WINDOW) {
            return;
        }

        if (dragStateRef.current) {
            return;
        }

        const hostElement = hostRef.current;

        if (!hostElement) {
            return;
        }

        moveViewportCenter(
            createMiniMapPointFromClientPoint({
                clientX: event.clientX,
                clientY: event.clientY,
                hostRect: hostElement.getBoundingClientRect(),
            }),
            DEFAULT_DRAG_OFFSET
        );
    }, [hostRef, moveViewportCenter]);

    /**
     * 뷰포트 박스를 드래그 가능한 상태로 전환한다.
     *
     * @param {React.PointerEvent<SVGRectElement>} event React 포인터 이벤트
     * @returns {void}
     */
    const handleViewportPointerDown = React.useCallback((event) => {
        event.preventDefault();
        event.stopPropagation();
        suppressClickRef.current = event.timeStamp;

        const hostElement = hostRef.current;

        if (!hostElement) {
            return;
        }

        const hostRect = hostElement.getBoundingClientRect();
        const pointerSvgPoint = convertMiniMapPointToSvgPoint(
            clampMiniMapPoint(
                createMiniMapPointFromClientPoint({
                    clientX: event.clientX,
                    clientY: event.clientY,
                    hostRect,
                })
            ),
            miniMapTransform
        );

        dragStateRef.current = Object.freeze({
            hostRect,
            hasMoved: false,
            dragOffset: createDragOffset(pointerSvgPoint, createViewportCenterPoint(panZoomView)),
            startClientPoint: Object.freeze({
                x: event.clientX,
                y: event.clientY,
            }),
        });
    }, [hostRef, miniMapTransform, panZoomView]);

    return Object.freeze({
        handleMiniMapClick,
        handleViewportPointerDown,
    });
}

/**
 * 미니맵 렌더링과 상호작용을 담당하는 독립 모듈 컴포넌트다.
 *
 * @param {Object} props 컴포넌트 props
 * @param {Object} props.value react-svg-pan-zoom value
 * @param {(nextValue: Object) => void} props.onChangeValue value 갱신 함수
 * @param {React.ReactNode} props.children SVG 내부 자식
 * @param {string} props.SVGBackground SVG 배경색
 * @param {string} [props.position] 미니맵 위치
 * @returns {React.ReactElement|null}
 */
export default function SvgPanZoomMiniMapModule({
    value,
    onChangeValue,
    children,
    SVGBackground,
    position = POSITION_RIGHT,
}) {
    const hostRef = React.useRef(null);
    const panZoomView = SvgPanZoomView.fromDTO(value);

    if (!panZoomView) {
        return null;
    }

    const miniMapTransform = React.useMemo(() => createMiniMapTransform(value), [value]);
    const viewportRect = React.useMemo(
        () => createViewportRect(panZoomView, miniMapTransform),
        [miniMapTransform, panZoomView]
    );
    const { handleMiniMapClick, handleViewportPointerDown } = useMiniMapInteractions({
        hostRef,
        value,
        panZoomView,
        miniMapTransform,
        onChangeValue,
    });

    return (
        <div className="svg-mini-map-module" style={createModuleStyle(position)}>
            <div
                className="svg-mini-map-module__surface"
                onClick={handleMiniMapClick}
                ref={hostRef}
                role="presentation"
            >
                <svg
                    className="svg-mini-map-module__svg"
                    height={MINI_MAP_HEIGHT}
                    viewBox={`0 0 ${MINI_MAP_WIDTH} ${MINI_MAP_HEIGHT}`}
                    width={MINI_MAP_WIDTH}
                >
                    <g transform={`translate(${miniMapTransform.translateX}, ${miniMapTransform.translateY})`}>
                        <g transform={`scale(${miniMapTransform.zoomToFit}, ${miniMapTransform.zoomToFit})`}>
                            <rect
                                fill={SVGBackground}
                                height={value.SVGHeight}
                                width={value.SVGWidth}
                                x={value.SVGMinX}
                                y={value.SVGMinY}
                            />
                            {children}
                        </g>
                    </g>

                    <rect
                        fill={MINI_MAP_VIEWPORT_FILL}
                        height={viewportRect.height}
                        onPointerDown={handleViewportPointerDown}
                        style={{ cursor: "grab" }}
                        stroke={MINI_MAP_VIEWPORT_STROKE}
                        strokeWidth={2}
                        width={viewportRect.width}
                        x={viewportRect.x}
                        y={viewportRect.y}
                    />
                    <rect
                        fill="none"
                        height={MINI_MAP_HEIGHT}
                        rx={MINI_MAP_BORDER_RADIUS}
                        stroke={MINI_MAP_OUTLINE}
                        width={MINI_MAP_WIDTH}
                        x={0}
                        y={0}
                    />
                </svg>
            </div>

            <span className="svg-mini-map-module__hint">{MINI_MAP_HINT}</span>
        </div>
    );
}
