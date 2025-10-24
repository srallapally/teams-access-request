import { authentication, app } from '@microsoft/teams-js';

type Request = {
  id: string;
  resource: string;
  justification: string;
  status: string;
  approverName?: string;
};

const myRequestsList = document.querySelector('#my-requests');
const myApprovalsList = document.querySelector('#my-approvals');

async function initialize() {
  await app.initialize();
  const context = await app.getContext();
  const userPrincipal = context.user?.userPrincipalName ?? context.user?.id ?? 'Unknown user';
  document.querySelector('#user-name')!.textContent = userPrincipal;

  const token = await authentication.getAuthToken({
    resources: window.__APP_CONFIG__?.resourceId ? [window.__APP_CONFIG__?.resourceId!] : undefined,
  });

  const csrfTokenResponse = await fetch('/api/csrf-token', {
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const { csrfToken } = await csrfTokenResponse.json();

  await loadRequests(token, csrfToken);
  bindForm(token, csrfToken);
  bindExternalAuth(window.__APP_CONFIG__?.externalApiBaseUrl ?? '', token, csrfToken);
}

async function loadRequests(token: string, csrfToken: string) {
  const [myRequestsResponse, myApprovalsResponse] = await Promise.all([
    fetch('/api/requests/mine', {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-csrf-token': csrfToken,
      },
    }),
    fetch('/api/requests/approvals', {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-csrf-token': csrfToken,
      },
    }),
  ]);

  const myRequestsData = await myRequestsResponse.json();
  const myApprovalsData = await myApprovalsResponse.json();

  renderList(myRequestsList, myRequestsData.data);
  renderList(myApprovalsList, myApprovalsData.data);
}

function renderList(container: Element | null, requests: Request[]) {
  if (!container) return;
  container.innerHTML = '';
  requests.forEach((request) => {
    const li = document.createElement('li');
    li.textContent = `${request.resource} – ${request.status}`;
    container.appendChild(li);
  });
}

function bindForm(token: string, csrfToken: string) {
  const form = document.querySelector('#create-request-form') as HTMLFormElement | null;
  if (!form) {
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const idempotencyKey = crypto.randomUUID();

    await fetch('/api/requests', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        resource: formData.get('resource'),
        justification: formData.get('justification'),
        approverId: formData.get('approverId'),
        idempotencyKey,
      }),
    });

    form.reset();
    await loadRequests(token, csrfToken);
  });
}

function bindExternalAuth(baseUrl: string, token: string, csrfToken: string) {
  if (!baseUrl) {
    return;
  }

  const button = document.querySelector('#external-auth-button') as HTMLButtonElement | null;
  if (!button) {
    return;
  }

  button.hidden = false;

  button.addEventListener('click', () => {
    authentication.authenticate({
      url: `${baseUrl}/oauth/start`,
      isExternal: true,
      successCallback: async () => {
        await loadRequests(token, csrfToken);
      },
      failureCallback: (reason: string) => {
        console.error('External auth failed', reason);
      },
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  void initialize();
});
