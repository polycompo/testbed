import React from "react";

const KEYBOARD_PAN_STEP = 64;
const ARROW_KEY_TO_PAN_DELTA = Object.freeze({
    ArrowLeft: Object.freeze({ x: KEYBOARD_PAN_STEP, y: 0 }),
    ArrowRight: Object.freeze({ x: -KEYBOARD_PAN_STEP, y: 0 }),
    ArrowUp: Object.freeze({ x: 0, y: KEYBOARD_PAN_STEP }),
    ArrowDown: Object.freeze({ x: 0, y: -KEYBOARD_PAN_STEP }),
});

/**
 * 텍스트 편집 컨텍스트인지 확인한다.
 *
 * @param {EventTarget | null} target 이벤트 대상
 * @returns {boolean}
 */
function isEditableTarget(target) {
    if (!(target instanceof HTMLElement)) {
        return false;
    }

    if (target.isContentEditable) {
        return true;
    }

    const tagName = target.tagName;

    return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
}

/**
 * 화살표 키에 대응하는 pan delta를 반환한다.
 *
 * @param {string} key 키보드 이벤트 키
 * @returns {{x: number, y: number} | null}
 */
function getPanDeltaByArrowKey(key) {
    return ARROW_KEY_TO_PAN_DELTA[key] || null;
}

/**
 * 컨테이너가 포커스를 가진 상태에서 화살표 입력을 pan 이동으로 연결한다.
 *
 * @param {Object} params 훅 파라미터
 * @param {React.MutableRefObject<HTMLElement | null>} params.containerRef 키 이벤트를 받을 컨테이너
 * @param {React.MutableRefObject<Object | null>} params.viewerRef react-svg-pan-zoom 인스턴스 ref
 * @param {(() => boolean) | null | undefined} params.shouldBlockPan pan 차단 여부 판별 콜백
 * @returns {void}
 */
export default function useSvgPanZoomKeyboardPan({
    containerRef,
    viewerRef,
    shouldBlockPan,
}) {
    React.useEffect(() => {
        const containerElement = containerRef.current;

        if (!containerElement) {
            return undefined;
        }

        /**
         * keydown 이벤트를 pan 이동으로 변환한다.
         *
         * @param {KeyboardEvent} event 브라우저 키보드 이벤트
         * @returns {void}
         */
        const handleKeyDown = (event) => {
            const panDelta = getPanDeltaByArrowKey(event.key);

            if (!panDelta) {
                return;
            }

            if (isEditableTarget(event.target)) {
                return;
            }

            if (shouldBlockPan && shouldBlockPan()) {
                return;
            }

            const viewer = viewerRef.current;

            if (!viewer) {
                return;
            }

            event.preventDefault();
            viewer.pan(panDelta.x, panDelta.y);
        };

        containerElement.addEventListener("keydown", handleKeyDown);

        return () => {
            containerElement.removeEventListener("keydown", handleKeyDown);
        };
    }, [containerRef, shouldBlockPan, viewerRef]);
}
