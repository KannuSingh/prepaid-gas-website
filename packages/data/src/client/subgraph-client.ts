import { GraphQLClient } from "graphql-request";
import type { ChainId, NetworkMetadata } from "../types/subgraph.js";
import {
  getValidatedNetworkPreset,
  NETWORK_PRESETS,
  type NetworkPreset,
} from "../network/presets.js";
import { QueryBuilder } from "../query/query-builder.js";

/**
 * Configuration for the subgraph client
 * Updated to support multiple paymaster contracts
 */
export interface SubgraphClientConfig {
  /** Subgraph endpoint URL */
  subgraphUrl: string;
  /** Network information */
  network: {
    name: string;
    chainId: number;
    chainName: string;
    networkName: string;
    contracts: {
      /** Map of paymaster contracts by type */
      paymasters: {
        gasLimited?: string;
        oneTimeUse?: string;
      };
      verifier?: string;
    };
  };
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
}

/**
 * Pagination options for queries
 */
export interface PaginationOptions {
  /** Number of items to fetch (default: 100) */
  first?: number;
  /** Number of items to skip (default: 0) */
  skip?: number;
}

/**
 * Options for pool queries with field selection
 */
export interface PoolQueryOptions extends PaginationOptions {
  /** Specific fields to fetch */
  fields?: string[];
}

/**
 * Options for paymaster queries with field selection
 */
export interface PaymasterQueryOptions extends PaginationOptions {
  /** Specific fields to fetch */
  fields?: string[];
  /** Filter by contract type */
  contractType?: "GasLimited" | "OneTimeUse";
}

/**
 * Options for user operation queries with field selection
 */
export interface UserOperationQueryOptions extends PaginationOptions {
  /** Specific fields to fetch */
  fields?: string[];
  /** Filter by paymaster address */
  paymasterAddress?: string;
  /** Filter by pool ID */
  poolId?: string;
  /** Filter by sender address */
  senderAddress?: string;
}

/**
 * Options for analytics queries
 */
export interface AnalyticsQueryOptions extends PaginationOptions {
  /** Start date for time range (YYYY-MM-DD) */
  startDate?: string;
  /** End date for time range (YYYY-MM-DD) */
  endDate?: string;
  /** Specific pool ID to filter by */
  poolId?: string;
  /** Specific paymaster address to filter by */
  paymasterAddress?: string;
}

/**
 * Clean, focused subgraph client for data access
 * Handles GraphQL communication and basic data transformation
 * Updated for new PaymasterContract-based subgraph structure
 */
export class SubgraphClient {
  private client: GraphQLClient;
  private networkMetadata: NetworkMetadata;
  private requestMap: Map<string, Promise<any>> = new Map();
  private readonly maxPendingRequests = 100;

  constructor(config: SubgraphClientConfig) {
    this.client = new GraphQLClient(config.subgraphUrl);

    this.networkMetadata = {
      network: config.network.name,
      chainId: config.network.chainId,
      chainName: config.network.chainName,
      networkName: config.network.networkName,
      contracts: config.network.contracts,
    };
  }

  /**
   * Generate a unique key for a query/variables combination
   *
   * @param query - GraphQL query string
   * @param variables - Query variables
   * @returns Unique key for the request
   */
  private generateRequestKey(
    query: string,
    variables: Record<string, any>,
  ): string {
    // Create a consistent key from query and variables
    const normalizedQuery = query.replace(/\s+/g, " ").trim();
    const sortedVariables = Object.keys(variables)
      .sort()
      .reduce(
        (sorted, key) => {
          sorted[key] = variables[key];
          return sorted;
        },
        {} as Record<string, any>,
      );

    return `${normalizedQuery}|${JSON.stringify(sortedVariables)}`;
  }

  /**
   * Clean up completed request from the map
   *
   * @param requestKey - Key of the request to clean up
   */
  private cleanupRequest(requestKey: string): void {
    this.requestMap.delete(requestKey);
  }

  /**
   * Clean up old requests if map gets too large
   */
  private cleanupOldRequests(): void {
    if (this.requestMap.size > this.maxPendingRequests) {
      // Clear half of the oldest requests
      const keysToDelete = Array.from(this.requestMap.keys()).slice(
        0,
        this.maxPendingRequests / 2,
      );
      keysToDelete.forEach((key) => this.requestMap.delete(key));
    }
  }

  /**
   * Create SubgraphClient for a specific network using presets
   *
   * @param chainId - The chain ID to create client for
   * @param options - Optional configuration overrides
   * @returns Configured SubgraphClient instance
   *
   * @example
   * ```typescript
   * // Create for Base Sepolia using preset
   * const client = SubgraphClient.createForNetwork(84532);
   *
   * // Create with custom subgraph URL override
   * const client = SubgraphClient.createForNetwork(84532, {
   *   subgraphUrl: "https://custom-subgraph.com",
   *   timeout: 60000
   * });
   * ```
   */
  static createForNetwork(
    chainId: number,
    options: {
      /** Custom subgraph URL (optional, uses preset default if not provided) */
      subgraphUrl?: string;
      /** Request timeout in milliseconds */
      timeout?: number;
    } = {},
  ): SubgraphClient {
    const preset = getValidatedNetworkPreset(chainId);

    return new SubgraphClient({
      subgraphUrl: options.subgraphUrl || preset.defaultSubgraphUrl,
      network: {
        name: preset.network.name,
        chainId: preset.network.chainId,
        chainName: preset.network.chainName,
        networkName: preset.network.networkName,
        contracts: {
          paymasters: {
            gasLimited: preset.network.contracts.paymasters.gasLimited?.address,
            oneTimeUse: preset.network.contracts.paymasters.oneTimeUse?.address,
          },
          verifier: preset.network.contracts.verifier,
        },
      },
      timeout: options.timeout,
    });
  }

  /**
   * Get all supported networks
   *
   * @returns Array of all supported network presets
   *
   * @example
   * ```typescript
   * const networks = SubgraphClient.getSupportedNetworks();
   * console.log(networks.map(n => n.network.chainName)); // ["Base Sepolia", ...]
   * ```
   */
  static getSupportedNetworks(): NetworkPreset[] {
    return Object.values(NETWORK_PRESETS);
  }

  /**
   * Check if a chain ID is supported
   *
   * @param chainId - The chain ID to check
   * @returns True if supported, false otherwise
   *
   * @example
   * ```typescript
   * if (SubgraphClient.isNetworkSupported(84532)) {
   *   const client = SubgraphClient.createForNetwork(84532);
   * }
   * ```
   */
  static isNetworkSupported(chainId: number): boolean {
    return chainId in NETWORK_PRESETS;
  }

  /**
   * Get available paymaster contracts for a network
   *
   * @param chainId - The chain ID to get paymasters for
   * @returns Array of paymaster contract information
   *
   * @example
   * ```typescript
   * const paymasters = SubgraphClient.getPaymasterContracts(84532);
   * console.log(paymasters); // [{ address: "0x...", type: "GasLimited" }, ...]
   * ```
   */
  static getPaymasterContracts(chainId: ChainId): Array<{
    address: string;
    type: "GasLimited" | "OneTimeUse";
    startBlock: number;
  }> {
    const preset = NETWORK_PRESETS[chainId];
    if (!preset) return [];

    const contracts = [];

    if (preset.network.contracts.paymasters.gasLimited) {
      contracts.push({
        address: preset.network.contracts.paymasters.gasLimited.address,
        type: "GasLimited" as const,
        startBlock: preset.network.contracts.paymasters.gasLimited.startBlock,
      });
    }

    if (preset.network.contracts.paymasters.oneTimeUse) {
      contracts.push({
        address: preset.network.contracts.paymasters.oneTimeUse.address,
        type: "OneTimeUse" as const,
        startBlock: preset.network.contracts.paymasters.oneTimeUse.startBlock,
      });
    }

    return contracts;
  }

  /**
   * ✨ Create a fluent query builder instance
   *
   * This is the main entry point for the new query builder API.
   * Provides a fluent interface for building complex queries with type safety.
   *
   * @returns QueryBuilder for fluent query building
   *
   * @example
   * ```typescript
   * // Simple paymaster query
   * const paymasters = await client
   *   .query()
   *   .paymasters()
   *   .byType("GasLimited")
   *   .withMinRevenue("1000000000000000000")
   *   .orderByRevenue()
   *   .limit(10)
   *   .execute();
   *
   * // Complex pool query with members
   * const pools = await client
   *   .query()
   *   .pools()
   *   .byPaymaster("0x456...")
   *   .withMinMembers(10)
   *   .withMembers(50)
   *   .orderByPopularity()
   *   .limit(20)
   *   .execute();
   *
   * // Analytics query
   * const analytics = await client
   *   .query()
   *   .dailyGlobalStats()
   *   .forDateRange("2024-01-01", "2024-01-31")
   *   .withMinNewPools(2)
   *   .orderByNewest()
   *   .execute();
   * ```
   */
  query(): QueryBuilder {
    return new QueryBuilder(this);
  }

  /**
   * Get current network metadata
   *
   * @returns Network metadata including contract addresses
   *
   * @example
   * ```typescript
   * const metadata = client.getNetworkMetadata();
   * console.log(metadata.contracts.paymasters.gasLimited); // "0x..."
   * ```
   */
  getNetworkMetadata(): NetworkMetadata {
    return this.networkMetadata;
  }

  /**
   * Get paymaster contract addresses for current network
   *
   * @returns Object containing paymaster contract addresses
   *
   * @example
   * ```typescript
   * const paymasters = client.getPaymasterAddresses();
   * console.log(paymasters.gasLimited); // "0x..."
   * console.log(paymasters.oneTimeUse); // "0x..."
   * ```
   */
  getPaymasterAddresses(): {
    gasLimited?: string;
    oneTimeUse?: string;
  } {
    return this.networkMetadata.contracts.paymasters;
  }

  /**
   * Get specific paymaster address by type
   *
   * @param type - Paymaster type ("GasLimited" or "OneTimeUse")
   * @returns Paymaster address or undefined if not available
   *
   * @example
   * ```typescript
   * const gasLimitedAddress = client.getPaymasterAddress("GasLimited");
   * if (gasLimitedAddress) {
   *   // Use the address
   * }
   * ```
   */
  getPaymasterAddress(type: "GasLimited" | "OneTimeUse"): string | undefined {
    const paymasters = this.getPaymasterAddresses();
    return type === "GasLimited"
      ? paymasters.gasLimited
      : paymasters.oneTimeUse;
  }

  /**
   * Check if network supports a specific paymaster type
   *
   * @param type - Paymaster type to check
   * @returns True if supported, false otherwise
   *
   * @example
   * ```typescript
   * if (client.supportsPaymasterType("GasLimited")) {
   *   const gasLimitedPools = await client.query().pools()
   *     .byPaymaster(client.getPaymasterAddress("GasLimited")!)
   *     .execute();
   * }
   * ```
   */
  supportsPaymasterType(type: "GasLimited" | "OneTimeUse"): boolean {
    return this.getPaymasterAddress(type) !== undefined;
  }

  /**
   * Get all supported paymaster types for current network
   *
   * @returns Array of supported paymaster types
   *
   * @example
   * ```typescript
   * const supportedTypes = client.getSupportedPaymasterTypes();
   * console.log(supportedTypes); // ["GasLimited", "OneTimeUse"]
   * ```
   */
  getSupportedPaymasterTypes(): Array<"GasLimited" | "OneTimeUse"> {
    const types: Array<"GasLimited" | "OneTimeUse"> = [];
    const paymasters = this.getPaymasterAddresses();

    if (paymasters.gasLimited) types.push("GasLimited");
    if (paymasters.oneTimeUse) types.push("OneTimeUse");

    return types;
  }

  /**
   * Execute a raw GraphQL query with request deduplication
   *
   * This method provides a generic interface for executing any GraphQL query,
   * with built-in deduplication to prevent duplicate requests for identical queries.
   *
   * @template T - The expected response type
   * @param query - GraphQL query string
   * @param variables - Query variables object
   * @returns Promise resolving to the query response data
   *
   * @example
   * ```typescript
   * const response = await client.executeQuery<{ pools: Pool[] }>(
   *   'query GetPools($first: Int!) { pools(first: $first) { id poolId } }',
   *   { first: 10 }
   * );
   * console.log(response.pools);
   * ```
   */
  async executeQuery<T = any>(
    query: string,
    variables: Record<string, any> = {},
  ): Promise<T> {
    // Generate unique key for this request
    const requestKey = this.generateRequestKey(query, variables);

    // Check if identical request is already in progress
    const existingRequest = this.requestMap.get(requestKey);
    if (existingRequest) {
      return existingRequest;
    }

    // Clean up old requests if needed
    this.cleanupOldRequests();

    // Create new request promise
    const requestPromise = this.client
      .request<T>(query, variables)
      .then((response) => {
        // Clean up this request from the map
        this.cleanupRequest(requestKey);
        return response;
      })
      .catch((error) => {
        // Clean up this request from the map even on error
        this.cleanupRequest(requestKey);

        // Enhanced error handling with context
        console.error("GraphQL query failed:", {
          error,
          query: query.substring(0, 200) + "...", // Log first 200 chars
          variables,
          network: this.networkMetadata.chainName,
        });

        throw error;
      });

    // Store the promise in the map
    this.requestMap.set(requestKey, requestPromise);

    return requestPromise;
  }

  /**
   * Execute multiple queries in parallel with deduplication
   *
   * @param queries - Array of query objects with query string and variables
   * @returns Promise resolving to array of query responses
   *
   * @example
   * ```typescript
   * const results = await client.executeQueries([
   *   { query: 'query GetPools { pools { id } }', variables: {} },
   *   { query: 'query GetPaymasters { paymasterContracts { id } }', variables: {} }
   * ]);
   * ```
   */
  async executeQueries<T = any>(
    queries: Array<{ query: string; variables?: Record<string, any> }>,
  ): Promise<T[]> {
    const promises = queries.map(({ query, variables = {} }) =>
      this.executeQuery<T>(query, variables),
    );
    return Promise.all(promises);
  }

  /**
   * Test connection to the subgraph
   *
   * @returns Promise resolving to true if connection is successful
   *
   * @example
   * ```typescript
   * const isConnected = await client.testConnection();
   * if (isConnected) {
   *   console.log("Subgraph is accessible");
   * }
   * ```
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.executeQuery(`
        query TestConnection {
          _meta {
            block {
              number
            }
          }
        }
      `);
      return true;
    } catch (error) {
      console.error("Subgraph connection test failed:", error);
      return false;
    }
  }

  /**
   * Get subgraph metadata
   *
   * @returns Promise resolving to subgraph metadata
   *
   * @example
   * ```typescript
   * const metadata = await client.getSubgraphMetadata();
   * console.log("Latest block:", metadata.block.number);
   * ```
   */
  async getSubgraphMetadata(): Promise<{
    block: {
      number: number;
      hash: string;
    };
    deployment: string;
  }> {
    const response = await this.executeQuery<{
      _meta: {
        block: {
          number: number;
          hash: string;
        };
        deployment: string;
      };
    }>(`
      query GetSubgraphMetadata {
        _meta {
          block {
            number
            hash
          }
          deployment
        }
      }
    `);
    return response._meta;
  }

  /**
   * Get health status of the subgraph
   *
   * @returns Promise resolving to health status information
   *
   * @example
   * ```typescript
   * const health = await client.getHealthStatus();
   * console.log("Sync status:", health.synced);
   * ```
   */
  async getHealthStatus(): Promise<{
    synced: boolean;
    latestBlock: number;
    chainHeadBlock: number;
    health: string;
  }> {
    try {
      const metadata = await this.getSubgraphMetadata();
      const isConnected = await this.testConnection();

      return {
        synced: isConnected,
        latestBlock: metadata.block.number,
        chainHeadBlock: metadata.block.number, // Approximation
        health: isConnected ? "healthy" : "unhealthy",
      };
    } catch (error) {
      return {
        synced: false,
        latestBlock: 0,
        chainHeadBlock: 0,
        health: "unhealthy",
      };
    }
  }

  /**
   * Create a new client for different network
   *
   * @param chainId - Target chain ID
   * @param options - Optional configuration overrides
   * @returns New SubgraphClient instance for the target network
   *
   * @example
   * ```typescript
   * const newClient = client.switchNetwork(8453); // Switch to Base Mainnet
   * ```
   */
  switchNetwork(
    chainId: number,
    options: {
      subgraphUrl?: string;
      timeout?: number;
    } = {},
  ): SubgraphClient {
    return SubgraphClient.createForNetwork(chainId, options);
  }
}
