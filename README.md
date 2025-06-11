# 📜 JSON-RPC 3.0 Specification

## Overview

JSON-RPC 3.0 builds on top of [JSON-RPC V2.0](https://www.jsonrpc.org/specification) to support **Streaming** responses while maintaining backward compatibility. It is transport-agnostic and can be used over various transports such as HTTP, WebSocket, MQTT, or in-memory channels, and hence is a perfect tool to implement **LLM** interaction for **AI** backend <-> frontend communications.

Compared to JSON-RPC 2.0, this version introduces:

- Introduction of **request options**
- Support for **streaming responses**
- Structured **acknowledgement** responses

#### Repo
This repo contains: 
  - a [Typescript implementation](json-rpc.ts) for reference, and
  - [JSON-Schema](jsonrpc-3.0.schema.json) file for message validation.

---

## 1. Conformance

A conforming implementation of JSON-RPC 3.0 must support:

- All base request/response types defined in this specification.
- Streaming response extensions when applicable.
- Proper use of extended error codes and structured error contexts.
- Optional fields may be omitted unless required by the method being called.

---

## 2. Protocol Concepts

### 2.1 Message Types

There are four primary types of messages:

- **Request**: Invokes a remote method.
- **Response**: Returns a result or error.
- **Acknowledgement (ACK)**: Acknowledges receipt of a request before processing begins.
- **Stream Response**: Provides incremental results for long-running or streaming operations.

Each message MUST include the `"jsonrpc"` version field set to `"3.0"`.

---

## 3. Data Model

All messages are encoded using JSON and follow strict schema definitions.

### 3.1 Common Fields

| Field      | Type            | Description |
|------------|------------------|-------------|
| `jsonrpc`  | String           | Version of the JSON-RPC protocol (`"3.0"`). |
| `id`       | String \| Number \| Null | Identifier for correlating requests and responses. |
| `method`   | String           | Name of the method to invoke. |
| `params`   | Object \| Array  | Parameters passed to the method. |
| `result`   | Any              | Result returned from the method. |
| `error`    | ErrorObject      | Error information if an error occurred. |
| `ack`      | Object           | Optional acknowledgment payload. |
| `stream`   | StreamObject     | Used in streaming responses to associate multiple parts with a single request. |

---

## 4. Request

### 4.1 Base Request

```json
{
  "jsonrpc": "3.0",
  "method": "example.method",
  "params": { /* parameters object or array */ },
  "id": 1
}
```

#### Fields:

- `jsonrpc`: Must be `"3.0"`.
- `method`: Required string identifying the method to call.
- `params`: Optional parameter object or array.
- `id`: Optional identifier for correlation; omitted for notifications.

### 4.2 Stream Request

```json
{
  "jsonrpc": "3.0",
  "method": "subscribe.stream",
  "params": { /* parameters object or array */ },
  "id": 1,
  "options": {
    "stream": true
  }
}
```

- The `options` object allows specifying additional behavior like streaming.
- When `stream: true`, the server MAY respond with one or more `stream`-tagged messages.

---

## 5. Response

### 5.1 Success Response

```json
{
  "jsonrpc": "3.0",
  "result": "some value",
  "id": 1
}
```

- Exactly one of `result`, `error`, or `ack` MUST be present.

### 5.2 Error Response

```json
{
  "jsonrpc": "3.0",
  "error": {
    "code": -32601,
    "title": "Method Not Found",
    "message": "The requested method does not exist.",
    "data": { "details": "..." }
  },
  "id": 1
}
```

#### Error Context Fields:

| Field   | Type   | Description |
|---------|--------|-------------|
| `code`  | Integer | Standardized error code. |
| `title` | String  | Short summary of the error type. |
| `message` | String | Human-readable explanation. |
| `data`  | Any     | Optional additional information. |

### 5.3 Acknowledgment Response

```json
{
  "jsonrpc": "3.0",
  "ack": {},
  "id": 1
}
```

- Sent by the server to indicate it has received the request and will process it asynchronously.
- Useful for long-running operations or queued tasks.

---

## 6. Streaming Responses

Streaming responses allow the server to return partial results incrementally.

### 6.1 Stream Data

```json
{
  "jsonrpc": "3.0",
  "stream": {
    "id": 1,
    "data": "partial result"
  }
}
```

- Sent during ongoing execution to provide intermediate results.
- No `id` field at the root level; the stream ID is inside the `stream` object.

### 6.2 Stream Done

```json
{
  "jsonrpc": "3.0",
  "stream": {
    "id": 1
  },
  "result": "final result"
}
```

- Indicates the stream has completed successfully.

### 6.3 Stream Error

```json
{
  "jsonrpc": "3.0",
  "stream": {
    "id": 1
  },
  "error": {
    "code": -32800,
    "title": "Client Cancelled",
    "message": "Request cancelled by client."
  }
}
```

- Indicates the stream was terminated due to an error or cancellation.

### 6.4 Stream Abort

```json
{
  "jsonrpc": "3.0",
  "stream": {
    "id": 1
  },
  "error": {
    "code": -32800,
    "title": "Client Cancelled",
    "message": "Request cancelled by client."
  }
}
```

- A special case of `StreamError` indicating client-initiated abortion.

---

## 7. Error Handling

### 7.1 Standard Error Codes

| Code             | Meaning                     |
|------------------|-----------------------------|
| -32700           | Parse error                 |
| -32600           | Invalid Request             |
| -32601           | Method not found            |
| -32602           | Invalid params              |
| -32603           | Internal error              |
| -32800           | Client cancelled request    |

### 7.2 Extended Error Codes

| Code Range        | Purpose                    |
|-------------------|----------------------------|
| -32000 to -32999  | Application-defined errors |
| -32001             | Unauthenticated             |
| -32003             | Forbidden                   |
| -32004             | Resource Not Found          |
| -32005             | Method Not Supported        |
| -32008             | Timeout                     |
| -32009             | Conflict                    |
| -32012             | Precondition Failed         |
| -32013             | Payload Too Large           |
| -32029             | Too Many Requests           |
| -32030             | Connection Failure          |
| -32040 + N         | Send failure status codes   |

---

## 8. Version Negotiation

Servers MUST support `"3.0"` and MAY advertise support for other versions via out-of-band discovery mechanisms.

Clients SHOULD specify `"3.0"` explicitly unless backward compatibility with older versions is required.

---

## 9. Transport Considerations

JSON-RPC 3.0 is transport-agnostic. Implementers MUST ensure:

- Each message is sent as a complete JSON object.
- Batching of multiple messages is allowed where supported.
- Transports supporting bidirectional communication (e.g., WebSocket) are encouraged for streaming use cases.

---

## 10. Security Considerations

Implementers should consider:

- Authenticating and authorizing RPC callers.
- Rate-limiting and throttling requests.
- Securing transport (e.g., using TLS).
- Sanitizing input parameters to prevent injection attacks.

---

## 11. Example Messages

### 11.1 Regular Request / Response

```
--> {"jsonrpc": "3.0", "method": "add", "params": [1, 2], "id": 1}
<-- {"jsonrpc": "3.0", "result": 3, "id": 1}
```

### 11.2 Stream Request / Responses

```
--> {"jsonrpc": "3.0", "method": "listen.logs", "params": {}, "id": 2, "options": {"stream": true}}
<-- {"jsonrpc": "3.0", "stream": {"id": 2}, "data": "Log entry 1"}
<-- {"jsonrpc": "3.0", "stream": {"id": 2}, "data": "Log entry 2"}
<-- {"jsonrpc": "3.0", "stream": {"id": 2}, "result": "End of logs"}
```

### 11.3 Acknowledgment

```
--> {"jsonrpc": "3.0", "method": "start.longTask", "params": {}, "id": 3}
<-- {"jsonrpc": "3.0", "ack": {}, "id": 3}
<-- {"jsonrpc": "3.0", "result": "Task completed", "id": 3}
```

### 11.4 Stream Abort Request / Responses
```
--> {"jsonrpc": "3.0", "method": "listen.logs", "params": {}, "id": 2, "options": {"stream": true}}
<-- {"jsonrpc": "3.0", "stream": {"id": 2}, "data": "Log entry 1"}
<-- {"jsonrpc": "3.0", "stream": {"id": 2}, "data": "Log entry 2"}
--> {"jsonrpc": "3.0", "options": {"stream": 2, "abort": true}}
<-- {"jsonrpc": "3.0", "stream": {"id": 2}, "error": {"code": -32800, "message": "Request cancelled by client."}}
```

---

## 12. Summary of Improvements from JSON-RPC 2.0

| Feature                        | JSON-RPC 2.0 | JSON-RPC 3.0 |
|-------------------------------|--------------|--------------|
| Streaming support             | ❌            | ✅            |
| Acknowledgement mechanism     | ❌            | ✅            |
| Options per request           | ❌            | ✅ (`options` field) |
| Stream abort control          | ❌            | ✅            |
| Multi-message responses       | ✅ (batched)  | ✅            |
| Transport independence        | ✅            | ✅            |

---

## 13. References

- JSON-RPC 2.0 Specification: https://www.jsonrpc.org/specification
- JSON Schema Draft 2020-12: https://json-schema.org/draft/2020-12/schema
- OpenTelemetry Project: https://opentelemetry.io/

---

## 14. Authors & Contributors

This specification was derived from work by [GK Palem](https://gk.palem.in/) incorporates modern RPC design patterns. Contributions were made by engineers working on distributed systems requiring advanced RPC features beyond the scope of JSON-RPC 2.0.
