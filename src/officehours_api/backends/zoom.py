from typing import TypedDict, List, Literal
from base64 import b64encode
from time import time
from datetime import datetime
import json

import requests
from django.shortcuts import redirect
from django.contrib.auth.models import User
from django.conf import settings
from django.urls import reverse


class ZoomMeeting(TypedDict):
    uuid: str
    id: str
    host_id: str
    topic: str
    type: Literal[1, 2, 3, 4, 8]  # instant, scheduled, recurring/unfixed, PMI, recurring/fixed
    status: str
    start_time: str
    duration: int
    timezone: str
    created_at: str
    agenda: str
    start_url: str


class ZoomUser(TypedDict):
    id: str
    first_name: str
    last_name: str
    email: str
    type: int
    role_name: str
    pmi: int
    use_pmi: bool
    vanity_url: str
    personal_meeting_url: str
    timezone: str
    verified: int
    dept: str
    created_at: str
    last_login_time: str
    last_client_version: str
    pic_url: str
    host_key: str
    jid: str
    group_ids: List[str]
    im_group_ids: List[str]
    account_id: str
    language: str
    phone_country: str
    phone_number: str
    status: str


class ZoomAccessToken(TypedDict):
    access_token: str
    token_type: str
    refresh_token: str
    expires_in: int
    scope: str


class Backend:
    friendly_name = "Zoom"
    base_url = 'https://zoom.us'
    client_id = settings.ZOOM_CLIENT_ID
    client_secret = settings.ZOOM_CLIENT_SECRET

    @classmethod
    def _get_client_auth_headers(cls) -> dict:
        client = b64encode(bytes(f"{cls.client_id}:{cls.client_secret}", 'ascii')).decode('ascii')
        return {
            'Authorization': f"Basic {client}",
            'Accept': 'application/json',
        }

    @classmethod
    def _spend_authorization_code(cls, code: str) -> ZoomAccessToken:
        resp = requests.post(
            f'{cls.base_url}/oauth/token',
            params={
                'grant_type': 'authorization_code',
                'code': code,
                'redirect_uri': 'http://localhost:8003/callback/zoom/',
            },
            headers=cls._get_client_auth_headers(),
        )
        print(resp.request.url)
        print(resp.json())
        resp.raise_for_status()
        # print(repr(resp.request.url))
        # print(repr(resp.request.headers))
        # print(resp)
        # print(resp.text)
        return resp.json()

    @classmethod
    def _get_access_token(cls, user: User) -> str:
        zoom_meta = user.profile.backend_metadata['zoom']
        if time() > zoom_meta['access_token_expires']:
            resp = requests.post(
                f'{cls.base_url}/oauth/token',
                params={
                    'grant_type': 'refresh_token',
                    'refresh_token': zoom_meta['refresh_token'],
                },
                headers=cls._get_client_auth_headers(),
            )
            resp.raise_for_status()
            token = resp.json()
            zoom_meta.update({
                'refresh_token': token['refresh_token'],
                'access_token': token['access_token'],
                'access_token_expires': time() - token['expires_in'] - 60,
            })
            user.profile.save()
        return zoom_meta['access_token']

    @classmethod
    def _get_session(cls, user: User) -> requests.Session:
        session = requests.Session()
        session.headers.update({
            'Authorization': f'Bearer {cls._get_access_token(user)}',
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        })
        return session

    @classmethod
    def _create_meeting(cls, user: User) -> ZoomMeeting:
        session = cls._get_session(user)
        user_id = user.profile.backend_metadata['zoom']['user_id']
        resp = session.post(
            f'{cls.base_url}/v2/users/{user_id}/meetings',
            json={
                'topic': 'Remote Office Hours Queue Meeting',
                'start_time': datetime.now().strftime('%Y-%m-%dT%H:%M:%SZ'),
                'timezone': 'America/Detroit',
                'agenda': 'Meeting agenda goes here',
            },
        )
        print(resp.json())
        resp.raise_for_status()
        return resp.json()

    @classmethod
    def _get_me(cls, user: User) -> ZoomUser:
        session = cls._get_session(user)
        resp = session.get(f'{cls.base_url}/v2/users/me')
        return resp.json()

    @classmethod
    def save_user_meeting(cls, backend_metadata: dict, assignee: User):
        if not backend_metadata:
            backend_metadata = {}
        if backend_metadata.get('meeting_id'):
            return backend_metadata

        user_email = backend_metadata['user_email']
        user = User.objects.get(email=user_email)
        meeting = cls._create_meeting(user)
        print(meeting)
        backend_metadata.update({
            'user_id': meeting['host_id'],
            'meeting_id': meeting['id'],
            'numeric_meeting_id': meeting['id'],
            'meeting_url': meeting['join_url'],
        })
        return backend_metadata

    @staticmethod
    def auth_callback(request):
        print('auth_callback')
        code = request.GET.get('code')
        print(code)
        token = Backend._spend_authorization_code(code)
        zoom_meta = request.user.profile.backend_metadata.get('zoom', {})
        zoom_meta.update({
            'refresh_token': token['refresh_token'],
            'access_token': token['access_token'],
            'access_token_expires': time() - token['expires_in'] - 60,
        })
        request.user.profile.backend_metadata['zoom'] = zoom_meta
        me = Backend._get_me(request.user)
        print(me)
        zoom_meta.update({
            'user_id': me['id'],
        })
        request.user.profile.backend_metadata['zoom'] = zoom_meta
        request.user.profile.save()
        print(json.dumps(request.user.profile.backend_metadata))
        return redirect('/')

    @classmethod
    def get_auth_url(cls, redirect_uri: str):
        return (
            f"{Backend.base_url}/oauth/authorize"
            f"?response_type=code"
            f"&client_id={cls.client_id}"
            f"&scope=meeting:read%20meeting:write"
            f"&redirect_uri={redirect_uri}"
        )


def ensure_auth(get_response):
    def middleware(request):
        if not request.user.is_authenticated:
            print("User not authenticated; skip middleware")
            return get_response(request)
        if request.user.profile.backend_metadata.get('zoom', None):
            print("Already have zoom meta; skip middleware")
            return get_response(request)
        auth_prompt_path = reverse('auth_prompt', kwargs={'backend_name': 'zoom'})
        auth_callback_path = reverse('auth_callback', kwargs={'backend_name': 'zoom'})
        print("Checking", request.path, auth_callback_path)
        print("Checking", request.path, auth_prompt_path)
        if request.path in (auth_prompt_path, auth_callback_path):
            print("User requested auth URI; skip middleware")
            return get_response(request)
        print("Redirect to zoom auth prompt")
        return redirect(auth_prompt_path)
    return middleware
