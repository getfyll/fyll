let handler: (() => void) | null = null;

export function setInlineCloseHandler(h: (() => void) | null) {
    handler = h;
}

export function getInlineCloseHandler() {
    return handler;
}
