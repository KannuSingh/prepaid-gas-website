/// file :prepaid-gas-website/apps/demo/lib/api-client.ts
interface SerializedPoolMembershipInfo {
  membershipId: string;
  identityCommitment: string;
  memberIndex: string;
  joinedAt: string;
  joinedAtBlock: string;
  pool: {
    poolId: string; // Serialized from BigInt
    joiningFee: string;
    memberCount: string; // Serialized from BigInt
    totalDeposits: string;
    createdAt: string; // Serialized from BigInt
  };
}

interface PoolMembersResponse {
  poolId: string;
  members: string[];
  count: number;
}

// Simple API client for calling our Next.js routes
export class ApiClient {
  /**
   * Get pools for a specific identity commitment
   * Returns serialized data (BigInt values as strings)
   */
  static async getPoolsByIdentity(
    identityCommitment: string,
  ): Promise<SerializedPoolMembershipInfo[]> {
    const response = await fetch(`/api/identity/${identityCommitment}/pools`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API Error: ${response.statusText}`);
    }

    const pools: SerializedPoolMembershipInfo[] = await response.json();

    return pools;
  }

  /**
   * Get all member identity commitments for a specific pool
   */
  static async getPoolMembers(poolId: string): Promise<string[]> {
    const response = await fetch(`/api/pools/${poolId}/members`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API Error: ${response.statusText}`);
    }

    const data: PoolMembersResponse = await response.json();

    return data.members;
  }
}
