export interface ExternalApprovalApiConfig {
  baseUrl?: string;
}

export interface ExternalApprovalPayload {
  requestId: string;
  approverId: string;
  decision: 'approved' | 'rejected';
  token: string;
}

export class ExternalApprovalApi {
  constructor(private readonly config: ExternalApprovalApiConfig) {}

  async sendDecision(_payload: ExternalApprovalPayload): Promise<void> {
    if (!this.config.baseUrl) {
      return;
    }

    // Placeholder for integrating with an external approval system using OAuth Code + PKCE tokens.
    // Implement HTTPS calls with appropriate authentication headers.
  }
}
