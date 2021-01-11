import xorWith from "lodash.xorwith";
import isEqual from "lodash.isequal";

import { diff } from 'deep-diff';

import { isMeeting, isQueueBase, isUser, Meeting, MeetingStatus, QueueBase } from "./models";

export type ComparableEntity = QueueBase | Meeting;

export interface ChangeEvent {
    eventID: number;
    text: string;
}

const queueBasePropsToWatch: (keyof QueueBase)[] = ['status', 'name'];
const meetingPropsToWatch: (keyof Meeting)[] = ['backend_type', 'assignee'];

interface HumanReadableMap {
    [key: string]: string;
}

const propertyMap: HumanReadableMap = {
    'backend_type': 'meeting type',
    'assignee': 'host'
}

// deep-diff: https://github.com/flitbit/diff

function detectChanges<T extends ComparableEntity>(versOne: T, versTwo: T, propsToWatch: (keyof T)[]): string[] {
    const diffObjects = diff(versOne, versTwo);
    if (!diffObjects) return [];
    let changeMessages = [];
    for (const diffObject of diffObjects) {
        if (diffObject.kind === 'E') {
            if (diffObject.path && diffObject.path.length === 1) {
                const changedProp = diffObject.path[0];
                if (!propsToWatch.includes(changedProp)) continue;
                const propName = (changedProp in propertyMap) ? propertyMap[changedProp as string] : changedProp;
                const left = isUser(diffObject.lhs) ? diffObject.lhs.username : diffObject.lhs;
                const right = isUser(diffObject.rhs) ? diffObject.rhs.username : diffObject.rhs;
                const message = `Its ${propName} was changed from "${left}" to "${right}".`;
                changeMessages.push(message);
            }
        } else {
            console.error('Unexpected diffObject type found: ' + diffObject.kind);
        }
    }
    return changeMessages;
}

function describeEntity (entity: ComparableEntity) {
    let entityType;
    let permIdentifier;
    if (isMeeting(entity)) {
        entityType = 'meeting';
        // meeting.attendees may change in the future?
        permIdentifier = `attendee ${entity.attendees[0].username}`;
    } else if (isQueueBase(entity)) {
        entityType = 'queue';
        permIdentifier = `ID number ${entity.id}`;
    }
    return [entityType, permIdentifier];
}

// https://lodash.com/docs/4.17.15#xorWith

export function compareEntities<T extends ComparableEntity> (oldOnes: T[], newOnes: T[]): string | undefined
{
    // Can we assume changes will occur one at a time?
    const symDiff = xorWith(oldOnes, newOnes, isEqual);
    if (symDiff.length === 0) return;
    const firstEntity = symDiff[0];
    const secondEntity = symDiff.length > 1 ? symDiff[1] : undefined;

    const [entityType, permIdentifier] = describeEntity(firstEntity);

    if (oldOnes.length < newOnes.length) {
        return `A new ${entityType} with ${permIdentifier} was added.`;
    } else if (oldOnes.length > newOnes.length) {
        return `The ${entityType} with ${permIdentifier} was deleted.`;
    }

    let changesDetected: string[] = [];
    if (secondEntity) {
        if (isMeeting(firstEntity) && isMeeting(secondEntity)) {
            changesDetected = detectChanges<Meeting>(firstEntity, secondEntity, meetingPropsToWatch);
            if (firstEntity.status !== secondEntity.status && secondEntity.status === MeetingStatus.STARTED) {
                changesDetected.push('The status indicates the meeting is now in progress.');
            }
        } else if (isQueueBase(firstEntity) && isQueueBase(secondEntity)) {
            changesDetected = detectChanges<QueueBase>(firstEntity, secondEntity, queueBasePropsToWatch);
        }
    }
    if (changesDetected.length > 0) {
        return `The ${entityType} with ${permIdentifier} was changed ` + changesDetected.join(' ');
    }
    return;
}
