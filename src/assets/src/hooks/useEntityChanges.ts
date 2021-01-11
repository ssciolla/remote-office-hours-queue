import { useState } from "react";

import { ChangeEvent, compareEntities, ComparableEntity } from "../changes";


export function useEntityChanges<T extends ComparableEntity>():
    [ChangeEvent[], (oldEntities: readonly T[], newEntities: readonly T[]) => void, (key: number) => void]
{
    const [changeEvents, setChangeEvents] = useState([] as ChangeEvent[]);
    const [nextID, setNextID] = useState(0);

    const compareAndSetChangeEvents = (oldEntities: readonly T[], newEntities: readonly T[]): void => {
        const changeText = compareEntities<T>(oldEntities.slice(), newEntities.slice());
        if (changeText !== undefined) {
            const newChangeEvent = { eventID: nextID, text: changeText } as ChangeEvent;
            setChangeEvents([...changeEvents, newChangeEvent]);
            setNextID(nextID + 1);
        }
    };

    // https://reactjs.org/docs/hooks-reference.html#functional-updates
    const deleteChangeEvent = (id: number) => {
        setChangeEvents((prevChangeEvents) => prevChangeEvents.filter((e) => id !== e.eventID));
    };

    return [changeEvents, compareAndSetChangeEvents, deleteChangeEvent];
}
