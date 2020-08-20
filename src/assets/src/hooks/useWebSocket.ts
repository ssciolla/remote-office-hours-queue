import { useState, useEffect } from "react";

interface OfficeHoursMessage<T> {
    type: "init"|"update"|"deleted";
    content: T;
}

const closeCodes = {
    1006: "An unexpected error occurred. Please refresh the page.",
    4404: "The resource you're looking for could not be found. Maybe it was deleted?",
} as {[closeCode: number]: string}

export const useWebSocket = <T>(url: string, onUpdate: (content: T) => void, onDelete?: (setError: (React.Dispatch<React.SetStateAction<Error | undefined>>)) => void) => {
    const [error, setError] = useState(undefined as Error | undefined);
    const buildWebSocket = () => {
        console.log("Building websocket...");
        const ws = new WebSocket(url);
        ws.onmessage = (e: MessageEvent) => {
            const m = JSON.parse(e.data) as OfficeHoursMessage<T>;
            console.log(m);
            switch(m.type) {
                case "init":
                    onUpdate(m.content as T);
                    break;
                case "update":
                    onUpdate(m.content as T);
                    break;
                case "deleted":
                    if (onDelete) {
                        onDelete(setError);
                    } else {
                        throw new Error("Unexpected message type 'deleted': " + e);
                    }
                    break;
            }
        }
        ws.onclose = (e: CloseEvent) => {
            if (e.code === 1000) return;
            console.error(e);
            setError(new Error(closeCodes[e.code] ?? e.code.toString()));
        }
        ws.onerror = (e: Event) => {
            console.error(e);
            setError(new Error(e.toString()));
        }
        return ws;
    }
    const [ws, setWs] = useState(buildWebSocket);
    useEffect(() => {
        console.log("Setting up reconnect for new websocket...");
        const handleVisibilityChange = () => {
            console.log("handleVisibilityChange");
            console.log("document.hidden");
            console.log(document.hidden);
            console.log("ws.readyState");
            console.log(ws.readyState);
            if (!document.hidden && ws.readyState === 3) {
                console.log("Reconnecting...");
                setError(undefined);
                setWs(buildWebSocket);
            } else {
                console.log("Don't reconnect.");
            }
        }
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            console.log("Cleaning up websocket...");
            ws.close();
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        }
    }, [ws]);
    return error;
}
