import { Client } from '@microsoft/microsoft-graph-client';

export interface ActivityFeedNotification {
  requestId: string;
  approverAadId: string;
  title: string;
  description: string;
  deepLink: string;
}

export async function sendActivityNotification(graphClient: Client, notification: ActivityFeedNotification) {
  await graphClient.api(`/users/${notification.approverAadId}/teamwork/sendActivityNotification`).post({
    topic: {
      source: 'entityUrl',
      value: notification.deepLink,
    },
    activityType: 'accessRequestApproval',
    previewText: {
      content: notification.title,
    },
    templateParameters: [
      {
        name: 'description',
        value: notification.description,
      },
      {
        name: 'requestId',
        value: notification.requestId,
      },
    ],
  });
}
