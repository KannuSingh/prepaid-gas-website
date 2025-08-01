//file:prepaid-gas-website/apps/web/lib/api/response.ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { ApiResponse } from "./type";

/**
 * Create a success response
 */
export function createSuccessResponse<T>(
  data: T,
  meta?: any,
  pagination?: any,
  requestId?: string,
): NextResponse<ApiResponse<T>> {
  const response = NextResponse.json(
    {
      success: true,
      data,
      meta,
      pagination,
    },
    { status: 200 },
  );

  // Add common headers
  if (requestId) {
    response.headers.set("X-Request-ID", requestId);
  }
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");

  return response;
}

/**
 * Create an error response
 */
export function createErrorResponse(
  message: string,
  code: string,
  status: number = 500,
  requestId?: string,
): NextResponse<ApiResponse> {
  const response = NextResponse.json(
    {
      success: false,
      error: {
        message,
        code,
        timestamp: new Date().toISOString(),
      },
      meta: requestId ? { requestId } : undefined,
    },
    { status },
  );

  if (requestId) {
    response.headers.set("X-Request-ID", requestId);
  }

  return response;
}

/**
 * Create a validation error response
 */
export function createValidationErrorResponse(
  errors: string[],
  requestId?: string,
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error: {
        message: "Invalid query parameters",
        code: "VALIDATION_ERROR",
        timestamp: new Date().toISOString(),
      },
      meta: requestId ? { requestId } : undefined,
    },
    { status: 400 },
  );
}

/**
 * Get request ID from headers or generate one
 */
export async function getRequestId(): Promise<string> {
  const headersList = await headers();
  return headersList.get("x-request-id") || crypto.randomUUID();
}

/**
 * Handle common API errors
 */
export function handleApiError(
  error: unknown,
  requestId: string,
): NextResponse<ApiResponse> {
  console.error(`[${requestId}] API Error:`, error);

  if (error instanceof Error) {
    // Handle specific error types
    if (error.message === "Request timeout") {
      return createErrorResponse(
        "Request timeout",
        "REQUEST_TIMEOUT",
        504,
        requestId,
      );
    }

    if (error.message.includes("not found")) {
      return createErrorResponse(error.message, "NOT_FOUND", 404, requestId);
    }

    // Generic error
    return createErrorResponse(error.message, "INTERNAL_ERROR", 500, requestId);
  }

  // Unknown error
  return createErrorResponse(
    "An unknown error occurred",
    "UNKNOWN_ERROR",
    500,
    requestId,
  );
}

/**
 * Set caching headers
 */
export function setCacheHeaders(
  response: NextResponse,
  cacheSeconds: number,
): void {
  response.headers.set(
    "Cache-Control",
    `public, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}`,
  );
}
