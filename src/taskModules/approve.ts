import { authentication, app, dialog } from '@microsoft/teams-js';

async function initialize() {
  await app.initialize();
  const context = await app.getContext();
  const userPrincipal = context.user?.userPrincipalName ?? context.user?.id ?? 'Unknown user';
  const requestId = new URLSearchParams(window.location.search).get('requestId');
  if (!requestId) {
    renderError('Missing requestId');
    return;
  }

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

  const requestResponse = await fetch(`/api/requests/${requestId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-csrf-token': csrfToken,
    },
  });

  if (!requestResponse.ok) {
    renderError('Unable to load request');
    return;
  }

  const request = await requestResponse.json();
  renderRequest(request, userPrincipal);
  bindActions(requestId, token, csrfToken);
}

function renderRequest(request: any, approverName: string) {
  document.querySelector('#request-resource')!.textContent = request.resource;
  document.querySelector('#request-justification')!.textContent = request.justification;
  document.querySelector('#request-requester')!.textContent = request.requesterName;
  document.querySelector('#approver-name')!.textContent = approverName;
}

function renderError(message: string) {
  const container = document.querySelector('#task-module');
  if (container) {
    container.innerHTML = `<p class="error">${message}</p>`;
  }
}

function bindActions(requestId: string, token: string, csrfToken: string) {
  const approveButton = document.querySelector('#approve-button') as HTMLButtonElement | null;
  const rejectButton = document.querySelector('#reject-button') as HTMLButtonElement | null;
  const commentInput = document.querySelector('#approver-comment') as HTMLTextAreaElement | null;

  const handler = async (decision: 'approved' | 'rejected') => {
    const response = await fetch('/api/approvals/decision', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify({
        requestId,
        decision,
        comment: commentInput?.value,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      renderError(error.error ?? 'Unable to submit decision');
      return;
    }

    dialog.url.submit({ success: true, decision });
  };

  approveButton?.addEventListener('click', () => handler('approved'));
  rejectButton?.addEventListener('click', () => handler('rejected'));
}

document.addEventListener('DOMContentLoaded', () => {
  void initialize();
});
