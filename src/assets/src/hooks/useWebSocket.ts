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
    const [delayedReconnect, setDelayedReconnect] = useState(null as null | boolean);
    console.log('delayedReconnect: ' + delayedReconnect)
    
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
            console.log("ws.onclose");
            console.log(e)
            console.log(e.code);
            console.log(navigator.userAgent)
            if (e.code === 1000) return;
            if (e.code === 1006) {
                console.log('Will try to reconnect after abnormal CloseEvent')
                setDelayedReconnect(true)
            } else {
                console.error(e);
                setError(new Error(closeCodes[e.code] ?? e.code.toString()));    
            }
        }
        ws.onerror = (e: Event) => {
            console.log("ws.onerror")
            console.error(e);
            setError(new Error(e.toString()));
        }
        setError(undefined);
        console.log(ws)
        return ws;
    }
    const [ws, setWs] = useState(buildWebSocket);

    useEffect(() => {
        if (delayedReconnect) {
            console.log('Reconnecting!');
            setWs(buildWebSocket);
            setDelayedReconnect(false)
        }
        return () => {
            console.log("Cleaning up after websocket...");
            ws.close();
        }
    }, [delayedReconnect]);
    return error;
}
