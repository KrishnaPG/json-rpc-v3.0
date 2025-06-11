// -----------------------------
// Enums & Base Types
// -----------------------------

enum JsonRpcVersion {
  V2_0 = "2.0",
  V3_0 = "3.0",
  VLatest = "3.0",
}

export enum ErrorCode {
  BadRequest = 400,
  UnAuthenticated = 401,
  PaymentRequired = 402,
  UnAuthorized = 403,
  NotFound = 404,
  MethodNotAllowed = 405,
  Timeout = 408,
  Conflict = 409,
  NotReady = 425, // too early, server is not ready
  TooManyRequests = 429,
  InternalError = 500,
  MethodNotImplemented = 501,
  ServerBusy = 503, // overloaded server, unable to complete the request
  ServerDown = 521,

  // JSON-RPC specific
  RPC_InvalidRequest = -32600,
  RPC_MethodNotFound = -32601,
  RPC_InvalidParams = -32602,
  RPC_InternalError = -32603,
  RPC_ParseError = -32700,
  RPC_ClientCancelledRequest = -32800,

  // Enhanced codes
  RPC_Unauthenticated = -32001,
  RPC_Forbidden = -32003,
  RPC_ResourceNotFound = -32004,
  RPC_MethodNotSupported = -32005,
  RPC_Timeout = -32008,
  RPC_Conflict = -32009,
  RPC_PreConditionFailed = -32012,
  RPC_PayloadTooLarge = -32013,
  RPC_TooManyRequests = -32029,
  RPC_ConnectFailure = -32030,

  RPC_SendFailureMax = -32040 + 10,
  RPC_SendConnClosed = -32040 + 2,
  RPC_SendPacketDropped = -32040 + 1,
  RPC_SendFailure = -32040,
}

interface BaseJsonRpcV2 {
  jsonrpc: JsonRpcVersion.V2_0;
}

interface BaseJsonRpcV3 {
  jsonrpc: JsonRpcVersion.V3_0;
}

interface BaseJsonRpcVAny {
  jsonrpc: JsonRpcVersion.V2_0 | JsonRpcVersion.V3_0;
}

export interface JsonRpcId {
  id?: number | string | null;
}

// -----------------------------
// Request Types
// -----------------------------

export interface BaseJsonRpcRequest<TParams = any> extends BaseJsonRpcVAny, JsonRpcId {
  method: string;
  params?: TParams;
}

export interface JsonRpcRequestV3<TParams = any, TOptions = any> extends BaseJsonRpcRequest<TParams> {
  options?: TOptions;
}

interface TOptionsStream {
  stream: boolean | JsonRpcId["id"];
  abort?: boolean;
}

export interface JsonRpcStreamRequest<TParams = any> extends JsonRpcRequestV3<TParams, TOptionsStream> {
  options: TOptionsStream;
}

// -----------------------------
// Response Types
// -----------------------------

export interface JsonRpcSuccessResponse<TResult = any> extends BaseJsonRpcVAny, JsonRpcId {
  result: TResult;
  error?: never;
}

export interface JsonRpcErrorResponse extends BaseJsonRpcV3, JsonRpcId {
  error: ErrorContext;
  result?: never;
}

export interface JsonRpcAck<TAck = any> extends BaseJsonRpcV3, JsonRpcId {
  ack: TAck;
  result?: never;
  error?: never;
}

// -----------------------------
// Error Types
// -----------------------------

export interface ErrorContext<TErrorData = any> {
  code: ErrorCode;
  title: string;
  message?: string;
  data?: TErrorData;
}
type ErrorContextAbort = ErrorContext & { code: ErrorCode.RPC_ClientCancelledRequest };

// -----------------------------
// Helper Functions
// -----------------------------

const RPCError = (err: any, id?: JsonRpcId["id"]): JsonRpcErrorResponse => ({
  jsonrpc: JsonRpcVersion.VLatest,
  id,
  error: { code: err.code, message: err.message || err, title: err.name || err.title || "Error", data: err.data },
});

const ErrorFmt = {
  clientCancelled(): ErrorContextAbort {
    return { code: ErrorCode.RPC_ClientCancelledRequest, message: "Request cancelled by Client", title: "Cancelled" };
  },
  duplicate({ message, data, code = ErrorCode.RPC_Conflict }: ErrorContext) {
    return { code, message, data, title: "Already Exists" };
  },
  invalidRequest({ message, data, code = ErrorCode.RPC_InvalidRequest }: ErrorContext) {
    return { code, message, data, title: "Invalid Request" };
  },
  notFound({ message, data, code = ErrorCode.RPC_MethodNotFound }: ErrorContext) {
    return { code, message, data, title: "NotFound" };
  },
  sendFailure(sendStatus = 0) {
    return {
      code: ErrorCode.RPC_SendFailure + sendStatus,
      message: "Send Failure",
      title: "Send Failure",
    };
  },
  timeout({ message, data, code = ErrorCode.RPC_Timeout }: ErrorContext) {
    return { code, message, data, title: "Timeout" };
  },
  unAuthenticated({ message, data, code = ErrorCode.RPC_Unauthenticated }: ErrorContext) {
    return { code, message, data, title: "UnAuthenticated" };
  },
  unAuthorized({ message, data, code = ErrorCode.RPC_Forbidden }: ErrorContext) {
    return { code, message, data, title: "UnAuthorized" };
  },
  generic({ message, data, title = "Error", code = ErrorCode.RPC_InternalError }: ErrorContext) {
    return { code, message, data, title };
  },
};

// -----------------------------
// Streaming Response Types
//
// They do not return the `id` in the main response, instead `id` is mentioned inside `stream`;
// One stream request can have multiple replies;
// -----------------------------

export interface JsonRpcStreamData<TData = any> extends BaseJsonRpcV3 {
  stream: { id: JsonRpcId["id"]; data?: TData };
  result?: never;
  error?: never;
  id?: never;
}

export interface JsonRpcStreamDone<TResult = any> extends BaseJsonRpcV3 {
  stream: {
    id: JsonRpcId["id"];
  };
  result: TResult;
  error?: never;
  id?: never;
}

export interface JsonRpcStreamError extends BaseJsonRpcV3 {
  stream: {
    id: JsonRpcId["id"];
  };
  error: ErrorContext;
  result?: never;
}

export type JsonRpcStreamAbort = JsonRpcStreamError & { error: ErrorContextAbort };

// -----------------------------
// Union Type for Message Discrimination
// -----------------------------

export type JsonRpcRequest = BaseJsonRpcRequest | JsonRpcRequestV3 | JsonRpcStreamRequest;
export type JsonRpcResponseV2 = JsonRpcSuccessResponse | JsonRpcErrorResponse;
export type JsonRpcStreamResponse = JsonRpcStreamData | JsonRpcStreamDone | JsonRpcStreamError;
export type JsonRpcResponse = JsonRpcAck | JsonRpcStreamResponse;

export type JsonRpcMessage = JsonRpcRequest | JsonRpcResponse;

// -----------------------------
// Message Builders
// -----------------------------

const RPCAck = <T>(id: JsonRpcId["id"], ack: T = {} as T): JsonRpcAck => ({
  jsonrpc: JsonRpcVersion.VLatest,
  id,
  ack,
});

const RPCResponse = <TResult>(result: TResult, id: JsonRpcId["id"] = null): JsonRpcSuccessResponse<TResult> => ({
  jsonrpc: JsonRpcVersion.VLatest,
  id,
  result,
});

const RPCRequest = <TParams>(
  method: string,
  params: TParams = {} as TParams,
  id: JsonRpcId["id"] = null
): BaseJsonRpcRequest<TParams> => ({
  jsonrpc: JsonRpcVersion.VLatest,
  method,
  params,
  id,
});

const RPCStreamRequest = <TParams>(
  method: string,
  params: TParams,
  id: JsonRpcId["id"]
): JsonRpcStreamRequest<TParams> => ({
  jsonrpc: JsonRpcVersion.VLatest,
  method,
  params,
  id,
  options: { stream: true },
});

const RPCStreamResponse = (data: any, id: JsonRpcId["id"]): JsonRpcStreamResponse => ({
  jsonrpc: JsonRpcVersion.VLatest,
  stream: { id, data },
});

const RPCStreamDone = (result: any, id: JsonRpcId["id"]): JsonRpcStreamDone => ({
  jsonrpc: JsonRpcVersion.VLatest,
  stream: { id },
  result,
});

const RPCStreamAbort = (id: JsonRpcId["id"]): JsonRpcStreamAbort => ({
  jsonrpc: JsonRpcVersion.VLatest,
  stream: { id },
  error: ErrorFmt.clientCancelled(),
});

const RPCStreamError = (err: any, id: JsonRpcId["id"]): JsonRpcStreamError => ({
  ...RPCError(err, null),
  stream: { id },
});

// -----------------------------
// Module Exports
// -----------------------------

export const JsonRpc = {
  Version: JsonRpcVersion,
  ErrorCode,
  ErrorFmt,
  RPCAck,
  RPCResponse,
  RPCRequest,
  RPCStreamRequest,
  RPCStreamResponse,
  RPCStreamDone,
  RPCStreamAbort,
  RPCStreamError,
  RPCError,
};

/**
 * @example:
    function handleRpcMessage(msg: JsonRpc.JsonRpcMessage) {
      if ("method" in msg && !("options" in msg)) {
        console.log("Regular Request:", msg);
      } else if ("options" in msg && msg.options?.stream) {
        console.log("Stream Request:", msg);
      } else if ("stream" in msg) {
        if ("data" in msg.stream) {
          console.log("Stream Data:", msg.stream.data);
        } else if ("result" in msg) {
          console.log("Stream Done:", msg.result);
        } else if ("error" in msg) {
          console.error("Stream Error:", msg.error);
        }
      } else if ("result" in msg) {
        console.log("Success Response:", msg.result);
      } else if ("error" in msg) {
        console.error("Error Response:", msg.error);
      } else if ("ack" in msg) {
        console.log("Ack Response for request: ", msg.id)
      }
    }
 */
