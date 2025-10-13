// === 정규식 빌더: allowIncomplete/decimalChar 제거, 항상 중간상태 허용 + '.' 사용 ===
function buildNumericRegex({
                               allowDecimal = true,
                               allowNegative = true,
                               maxIntDigits = 6,
                               maxFracDigits = 6,
                           } = {}) {
    const sign = allowNegative ? "-?" : "";   // 맨 앞 '-'

    if (allowDecimal) {
        const body =
            `(?:\\d{0,${maxIntDigits}}(?:\\.\\d{0,${maxFracDigits}})?|` +
            `\\.\\d{0,${maxFracDigits}})`;
        const whole = `(?:${body})?`;
        return new RegExp(`^${sign}${whole}$`);
    }
    // 정수만 (중간상태 허용)
    return new RegExp(`^${sign}\\d{0,${maxIntDigits}}$`);
}

function buildCandidate(current, selStart, selEnd, insert) {
    return current.slice(0, selStart) + insert + current.slice(selEnd);
}

function isControlKey(e) {
    const k = e.key;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl) return ["a", "c", "v", "x", "z", "y"].includes(k.toLowerCase());
    return (
        k === "Backspace" ||
        k === "Delete" ||
        k === "Tab" ||
        k === "Enter" ||
        k === "Escape" ||
        k === "Home" ||
        k === "End" ||
        k === "ArrowLeft" ||
        k === "ArrowRight" ||
        k === "ArrowUp" ||
        k === "ArrowDown"
    );
}

function isDigitKey(e) {
    return /^[0-9]$/.test(e.key);
}

// =============== Hook: 입력 가드 ==================
function useNumericGuards({
                              allowNegative = true,
                              allowDecimal = true,
                              maxIntDigits = 6,
                              maxFracDigits = 2,
                          } = {}) {
    const rules = { allowNegative, allowDecimal, maxIntDigits, maxFracDigits };
    const regex = React.useMemo(
        () => buildNumericRegex(rules),
        [allowNegative, allowDecimal, maxIntDigits, maxFracDigits]
    );

    // IME/한글 포함 모든 텍스트 삽입을 사전에 차단
    const guardBeforeInput = React.useCallback((e) => {
        const input = e.currentTarget;
        if (!input) return;

        const native = e.nativeEvent || e;
        const type = native.inputType || e.inputType || ""; // e.g., insertText, insertCompositionText, insertFromPaste
        if (!type.startsWith("insert")) return; // 삭제/이동 등은 통과

        const { selectionStart, selectionEnd, value: current } = input;

        // data가 없는 paste/drop 케이스 보정
        let insert = (e.data ?? native.data ?? "");
        if (!insert && (type === "insertFromPaste" || type === "insertFromDrop")) {
            const txt = (e.clipboardData || window.clipboardData)?.getData?.("text");
            if (typeof txt === "string") insert = txt;
        }

        const candidate = buildCandidate(current, selectionStart, selectionEnd, insert);
        if (!regex.test(candidate)) e.preventDefault();
    }, [regex]);

    const guardKeyDown = React.useCallback((e) => {
        const input = e.currentTarget;
        if (!input || e.isComposing) return; // 조합 중 키다운은 건드리지 않음(커밋은 beforeinput에서 차단)

        if (isControlKey(e)) return;

        const { selectionStart, selectionEnd, value: current } = input;

        if (isDigitKey(e)) {
            const candidate = buildCandidate(current, selectionStart, selectionEnd, e.key);
            if (!regex.test(candidate)) e.preventDefault();
            return;
        }

        // decimalChar === '.' 고정
        if (e.key === ".") {
            const candidate = buildCandidate(current, selectionStart, selectionEnd, ".");
            if (!regex.test(candidate)) e.preventDefault();
            return;
        }

        if (e.key === "-") {
            const candidate = buildCandidate(current, selectionStart, selectionEnd, "-");
            const atHead = selectionStart === 0;
            if (!atHead || !regex.test(candidate)) e.preventDefault();
            return;
        }

        // 그 외 키는 차단 (영문/한글/기타 모두)
        e.preventDefault();
    }, [regex]);

    const guardPaste = React.useCallback((e) => {
        const input = e.currentTarget;
        if (!input) return;
        const pasteText = (e.clipboardData || window.clipboardData).getData("text");
        const { selectionStart, selectionEnd, value: current } = input;
        const candidate = buildCandidate(current, selectionStart, selectionEnd, pasteText);
        if (!regex.test(candidate)) e.preventDefault();
    }, [regex]);

    const parser = React.useCallback((display) => {
        if (display == null) return "";
        return String(display); // 항등. 포맷은 건드리지 않음
    }, []);

    const formatter = React.useCallback((value) => value, []);

    return { guardBeforeInput, guardKeyDown, guardPaste, parser, formatter, regex };
}

// =============== NumberField 컴포넌트 ==================
function NumberField({
                         value,
                         onChange,
                         min,
                         max,
                         step = 1,
                         allowNegative = true,
                         allowDecimal = true,
                         maxIntDigits = 6,
                         maxFracDigits = 2,
                         placeholder,
                         ...rest
                     }) {
    const wrapRef = React.useRef(null);
    const { guardKeyDown, guardPaste, parser, formatter, regex } = useNumericGuards({
        allowNegative,
        allowDecimal,
        maxIntDigits,
        maxFracDigits,
    });

    // antd v4는 onBeforeInput을 실제 <input>까지 전달하지 않을 수 있어 native 캡처 단계에서 직접 가드
    React.useEffect(() => {
        const root = wrapRef.current;
        if (!root) return;
        const input = root.querySelector("input.ant-input-number-input") || root.querySelector("input");
        if (!input) return;

        const onBeforeInputNative = (e) => {
            const type = e.inputType || "";
            if (!type.startsWith("insert")) return; // 삭제/이동은 건드리지 않음
            const { selectionStart, selectionEnd, value: current } = input;

            let insert = e.data ?? "";
            if (!insert && (type === "insertFromPaste" || type === "insertFromDrop")) {
                const txt = e.clipboardData?.getData?.("text");
                if (typeof txt === "string") insert = txt;
            }

            const candidate = buildCandidate(current, selectionStart ?? current.length, selectionEnd ?? current.length, insert);
            if (!regex.test(candidate)) {
                debugger
                e.preventDefault();
            } // 한글/IME 포함 모든 텍스트 삽입 차단
        };

        input.addEventListener("beforeinput", onBeforeInputNative, { capture: true });
        return () => {
            input.removeEventListener("beforeinput", onBeforeInputNative, { capture: true });
        };
    }, [regex, value]); // decimalChar 의존성 제거

    return (
        <div ref={wrapRef}>
            <InputNumber
                {...rest}
                value={value}
                onChange={onChange}
                min={min}
                max={max}
                step={step}
                stringMode
                inputMode={allowDecimal ? "decimal" : "numeric"}
                parser={parser}
                formatter={formatter}
                onKeyPress={guardKeyDown}   // 네 코드 유지 (onKeyDown으로 바꾸지 않음)
                onPaste={guardPaste}
                style={{ width: "100%" }}
                placeholder={placeholder}
            />
        </div>
    );
}
