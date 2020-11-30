import * as React from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Col, Row, Table } from "react-bootstrap";

import { UserDisplay, RemoveButton } from "./common";
import { Meeting, QueueHost, User } from "../models";


interface MeetingDetailsProps {
    backends: {[backend_type: string]: string};
    meeting: Meeting;
    onShowMeetingInfo: (m: Meeting) => void;
}

const MeetingDetails = (props: MeetingDetailsProps) => {
    const backendBadge = <Badge variant='secondary' className='mb-1'>{props.backends[props.meeting.backend_type]}</Badge>;
    return (
        <Row>
            <Col md={6}>{backendBadge}</Col>
            <Col md={6}>
                <Button variant='link' size='sm' className='ml-1' onClick={() => props.onShowMeetingInfo(props.meeting)}>
                    Join Info
                </Button>
            </Col>
        </Row>
    );
}

interface MeetingEditorProps {
    meeting: Meeting;
    backends: {[backend_type: string]: string};
    onRemove: (m: Meeting) => void;
    onShowMeetingInfo: (m: Meeting) => void;
    disabled: boolean;
}

interface UnstartedMeetingEditorProps extends MeetingEditorProps {
    user: User;
    potentialAssignees: User[];
    onChangeAssignee: (a: User | undefined) => void;
    onStartMeeting: (m: Meeting) => void;
}

function UnstartedMeetingEditor (props: UnstartedMeetingEditorProps) {
    const attendee = props.meeting.attendees[0];
    const attendeeString = `${attendee.first_name} ${attendee.last_name}`;

    const readyButton = props.meeting.assignee
        && (
            <Button
                variant='success'
                size='sm'
                onClick={() => props.onStartMeeting(props.meeting)}
                aria-label={`${props.meeting.backend_type === 'inperson' ? 'Ready for Attendee' : 'Start Meeting with'} ${attendeeString}`}
                disabled={props.disabled}
            >
                {props.meeting.backend_type === 'inperson' ? 'Ready for Attendee' : 'Start Meeting'}
            </Button>
        );
    const progressWorkflow = readyButton || <span>Please assign a host to proceed.</span>;

    const assigneeOptions = [<option key={0} value="">Assign to Host...</option>]
        .concat(
            props.potentialAssignees
                .sort((a, b) => a.id === props.user.id ? -1 : b.id === props.user.id ? 1 : 0)
                .map(a => <option key={a.id} value={a.id}>{a.first_name} {a.last_name} ({a.username})</option>)
        );
    const onChangeAssignee = (e: React.ChangeEvent<HTMLSelectElement>) =>
        e.target.value === ""
            ? props.onChangeAssignee(undefined)
            : props.onChangeAssignee(props.potentialAssignees.find(a => a.id === +e.target.value));

    return (
        <>
        <td><UserDisplay user={attendee}/></td>
        <td className="form-group">
            <select className="form-control assign"
                value={props.meeting.assignee?.id ?? ""}
                onChange={onChangeAssignee}
                disabled={props.meeting.backend_metadata && !!Object.keys(props.meeting.backend_metadata).length}
            >
                {assigneeOptions}
            </select>
        </td>
        <td><MeetingDetails {...props} /></td>
        <td>
            <Row>
                {progressWorkflow && <Col md={8} className='mb-1'>{progressWorkflow}</Col>}
                <Col md={4}>
                    <RemoveButton
                        onRemove={() => props.onRemove(props.meeting)}
                        size="sm"
                        screenReaderLabel={`Remove Meeting with ${attendeeString}`}
                        disabled={props.disabled}
                    />
                </Col>
            </Row>
        </td>
        </>
    );
}

function StartedMeetingEditor (props: MeetingEditorProps) {
    const attendee = props.meeting.attendees[0];
    const attendeeString = `${attendee.first_name} ${attendee.last_name}`;
    const joinUrl = props.meeting.backend_metadata?.meeting_url;
    const joinLink = joinUrl
        && (
            <Button
                variant='primary'
                size='sm'
                as='a'
                href={joinUrl}
                target="_blank"
                aria-label={`Join Meeting with ${attendeeString}`}
                disabled={props.disabled}
            >
                Join Meeting
            </Button>
        );

    return (
        <>
        <td><UserDisplay user={attendee}/></td>
        <td><UserDisplay user={props.meeting.assignee!} /></td>
        <td><MeetingDetails {...props} /></td>
        <td>
            <Row>
                {joinLink && <Col md={6} className='mb-1'>{joinLink}</Col>}
                <Col md={6}>
                    <Button
                        variant='danger'
                        size='sm'
                        onClick={() => props.onRemove(props.meeting)}
                        aria-label={`End Meeting with ${attendeeString}`}
                        disabled={props.disabled}
                    >
                        End Meeting
                    </Button>
                </Col>
            </Row>
        </td>
        </>
    );
}

interface MeetingTableProps {
    meetings: Meeting[];
    user: User;
    backends: {[backend_type: string]: string};
    onRemoveMeeting: (m: Meeting) => void;
    onShowMeetingInfo: (m: Meeting) => void;
    disabled: boolean;
}

interface MeetingsInQueueTableProps extends MeetingTableProps {
    queue: QueueHost;
    onChangeAssignee: (a: User | undefined, m: Meeting) => void;
    onStartMeeting: (m: Meeting) => void;
}

export function MeetingsInQueueTable (props: MeetingsInQueueTableProps) {
    const unstartedMeetingRows = props.meetings
        .sort((a, b) => a.id - b.id)
        .map(
            (m, i) => (
                <tr key={m.id}>
                    <th scope="row" className="d-none d-sm-table-cell">{i+1}</th>
                    <UnstartedMeetingEditor
                        user={props.user}
                        potentialAssignees={props.queue.hosts}
                        meeting={m}
                        backends={props.backends}
                        onRemove={props.onRemoveMeeting}
                        onShowMeetingInfo={props.onShowMeetingInfo}
                        onChangeAssignee={(a: User | undefined) => props.onChangeAssignee(a, m)}
                        onStartMeeting={() => props.onStartMeeting(m)}
                        disabled={props.disabled}
                    />
                </tr>
            )
        );

    const unstartedMeetingsTable = props.meetings.length
        ? (
            <Table bordered responsive>
                <thead>
                    <tr>
                        <th scope="col" className="d-none d-sm-table-cell">Queue #</th>
                        <th scope="col">Attendee</th>
                        <th scope="col">Host</th>
                        <th scope="col">Details</th>
                        <th scope="col">Meeting Actions</th>
                    </tr>
                </thead>
                <tbody>{unstartedMeetingRows}</tbody>
            </Table>
        )
        : (
            <>
            <hr/>
            <p>There are currently no meetings in queue.</p>
            <p>
                <strong>Did you know?</strong> You can get notified by SMS (text) message when someone joins your empty queue
                by adding your cell phone number and enabling host notifications in your <Link to="/preferences">User Preferences</Link>. 
            </p>
            </>
        );
    return unstartedMeetingsTable;
}

export function MeetingsInProgressTable (props: MeetingTableProps) {
    const startedMeetingRows = props.meetings
        .sort((a, b) => a.id - b.id)
        .map(
            (m) => (
                <tr key={m.id}>
                    <StartedMeetingEditor
                        meeting={m}
                        backends={props.backends}
                        onRemove={props.onRemoveMeeting}
                        onShowMeetingInfo={props.onShowMeetingInfo}
                        disabled={props.disabled}
                    />
                </tr>
            )
        );

    const startedMeetingsTable = props.meetings.length
        ? (
            <Table bordered responsive>
                <thead>
                    <tr>
                        <th scope="col">Attendee</th>
                        <th scope="col">Host</th>
                        <th scope="col">Details</th>
                        <th scope="col">Meeting Actions</th>
                    </tr>
                </thead>
                <tbody>{startedMeetingRows}</tbody>
            </Table>
        )
        : (
            <>
            <hr/>
            <p>There are currently no meetings in progress. Please create a meeting below to see it here.</p>
            </>
        );
    return startedMeetingsTable;
}
