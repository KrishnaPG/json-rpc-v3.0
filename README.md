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

#### NPM Package
Available at: [https://www.npmjs.com/package/@fict/json-rpc](https://www.npmjs.com/package/@fict/json-rpc)
  - install with `npm install @fict/json-rpc`

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

```json5
{
  "jsonrpc": "3.0",
  "method": "example.method",
  "params": { /* parameters object, if any */ },
  "id": 1
}
```

#### Fields:

- `jsonrpc`: Must be `"3.0"`.
- `method`: Required string identifying the method to call.
- `params`: Optional parameter object or array.
- `id`: Optional identifier for correlation; omitted for notifications.

### 4.2 Stream Request

```json5
{
  "jsonrpc": "3.0",
  "method": "subscribe.stream",
  "params": { /* parameters object */ },
  "id": 1,
  "options": {
    "stream": true
  }
}
```

- The `options` object allows specifying additional behavior like streaming, the output format expected etc. that give hint to the server on what the requestor is expecting (through Extensions, see below).
- When `stream: true`, the server MAY respond with one or more `stream`-tagged messages.

#### Stream Abort Request
The stream abort request can be implemented at the application level like any other method, since only the applications know how to stop / cancel the stream. The application can designate a method as the cancel method, for example `request.cancel`, and the requestor can issue a new request as below:

```json5
{
  "jsonrpc": "3.0",
  "method": "request.cancel",
  "params": { "stream": true, "id": "...<the original stream request id>" }
}
```
Then the application has to handle this method and cancel the ongoing stream requests.

Alternately, when `Option Extensions` are supported, the `options` object may be used to request abort for an ongoing stream.
```json5
{
  "jsonrpc": "3.0",
  "options": {
    "stream": "...<stream id>...",
    "abort": true
  }
}
```
The `Option Extensions`, however, is implementation specific and both the requestor and responder may need to have them enabled and negotiated apriori at the time of connection.

### 4.3 Request Extensions
The protocol allows custom extentions to the `options` and `stream` parameters. The requestor and responder may use custom discovery RPC methods at the start of the communication to negotiate which extensions are supported by each other.
- When the protocol supports `Option Extensions`, the `options` object could be used to convey additional details on what the requestor is expecting. For example, `Encrypted Responses` extension request:
  ```json
  {
    "jsonrpc": "3.0",
    "method": "account.balance",
    "id": 1,
    "options": {
        "encrypt": true,
        "publicKeyB64": "...."
      }
  }
  ```
  The above request is asking the server to send (non-stream) result, in encrypted format using the requestor's given publicKey.
  The difference between `params` and `options` is that `options` works at the meta level that controls the behavior of the server on how to execute and respond the method, where as `params` are direct input to the method. The `options` are interepreted by the server and thus may change how a method is invoked, where as the `options` are to be transparently passed on to the method without affecting the server. Retries, Auth credentials, launching a serverless host to run the method etc. that are beyond the scope of the method are better conveyed through `options` than `params`, keeping the method implementation clean and focused.
- When the protocol supports `Stream Extensions`, the `stream` could be an object holding additional custom parameters specific to the implementation. e.g. `Encrypted Stream` extention request:
  ```json
  {
    "jsonrpc": "3.0",
    "method": "subscribe.stream",
    "id": 1,
    "options": {
      "stream": {
        "encrypt": true,
        "publicKeyB64": "...."
      }
    }
  }
  ``` 

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
| `code`  | Integer | Standardized error code. Useful for programmatic comparisions. |
| `title` | String  | Short summary of the error type. Useful for UI notifications. |
| `message` | String | Human-readable explanation. |
| `data`  | Any     | Optional additional information. |

The `data` field may hold additional errors (recursive) or stack trace etc., based on the implementation.

### 5.3 Acknowledgment Response for Async Requests
After receiving a (non-stream) request, the server may choose to send an `ack` response before sending the final `result` or `error` response.
```json
{
  "jsonrpc": "3.0",
  "ack": {},
  "id": 1
}
```
- Sent by the server to indicate it has received the request and will process it asynchronously.
- Useful for long-running operations or queued tasks.
- When `Acknolwedgement Extensions` are supported, the `ack` object may hold additional details on when, where, how to access the result (or the progress) of the request. For example, the below response returns an acknowledgement with a background `jobId`, where to query for the progress and result, and the `ttl` (how long the result will be available).
  ```json
  {
    "jsonrpc": "3.0",
    "ack": {
      "jobId": "...",
      "jobQ": {
        "url": "...",
        "ttl": "..."
      }
    },
    "id": 1
  }
  ```
This makes it possible to implement decentralized P2P request / response systems, where the request is received by one node, but the results will become available on another node asynchronously.

#### Multiple Ack responses
It is also possible that `ack` responses may be received multiple times before a final `result` or `error` response is seen. 

- When `Acknolwdgement Extensions` are supported, the `ack` object may hold additional details that indicate the progress, such as:
```json
{
  "jsonrpc": "3.0",
  "ack": { "progress": 18, "total": 230 },
  "id": 1
}
```
In this case, the `ack` may be received multiple times, which the requestors can use to reset the request timeout so that long running requests do not timeout early.

- Irrespective of single `ack` or multiple `ack` responses, the requestor is free to ignore them and continue to wait for the final `result` or `error`.

The receiver SHOULD not respond to the `ack` responses, except for may be cancelling the request (by making a new method request that triggers the cancel of current running requests, which is implementation specific).

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

### 6.3 Stream Errored

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

### 6.4 Stream Aborted 

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


### 6.5 Ack Response for Async Streams
When a stream request is received, the responder may choose to first send an `ack` before actually start sending the stream responses. This is specifically useful when the request or stream setup takes time (e.g. LLM responses, Video transformation streams etc.).
```json5
{
  "jsonrpc": "3.0",
  "ack": {
    "id": 1 /** the stream request id */
  },
}
```
Note that for stream acknowledgements, the request `id` should be inside the `ack` object and should not be mentioned at the root level (unlike the `ack` for `Async Requests` where the `id` is mentioned at the root level). 

- When `Acknowledgement Extensions` are supported, the `ack` object may offer additional functionality, such as `async streams` that have different `id` than the original request id, and more functionality such as stream from different sources etc. For example,
```json5
{
  "jsonrpc": "3.0",
  "ack": {
    "id": "a31dbae" /** the original stream request id */
    "stream": {
      "id": "fxr2t6", /** the id the stream response will be using to send data and results */
      "pubServer": {
        "host": "...",
        "port": "...",
        "topic": "..."
      },
      "encryption": {
        "publicKeyB64": "..."
      }
    }
  },
}
```
The above response is acknowledging that a stream request with id `a31dbae` is received and that the response stream will be available in encrypted from from a PubSub server at the specified host, port, topic with a stream id `fxr2t6`.

- Note that for normal streams the request id and the response stream id both will be the same, where as for `async streams` the response stream id may be different from the original request id. 

This kind of mechanism allows to implement privacy preserving streams on public P2P networks. The requestor sends a stream request that everyone can see with a request id, and the responder returns a new stream ID that is encrypted and only the requestor can decrypt, and the actual stream will be publicly available in encrypted form on PUB-SUB channels for everyone to see but only the original requestor knows the correct ID to consume the correct stream.


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

#### 11.1.1 Multiple Regular Requests / Responses

```
--> {"jsonrpc": "3.0", "method": "add", "params": [1, 2], "id": 1}
--> {"jsonrpc": "3.0", "method": "add", "params": [5, 4], "id": 2}
<-- {"jsonrpc": "3.0", "result": 9, "id": 2}
<-- {"jsonrpc": "3.0", "result": 3, "id": 1}
```
Order is not guaranteed for responses. Responses may arrive in any order and need not be same as the order of the requests.

#### 11.1.2 Async Request / Response

```
--> {"jsonrpc": "3.0", "method": "add", "params": [1, 2], "id": 1}
<-- {"jsonrpc": "3.0", "ack": {}, "id": 1}
    /** after a long time */
<-- {"jsonrpc": "3.0", "result": 3, "id": 1}
```

#### 11.1.3 Async Request / Response in Decentralized P2P Mode (with extensions)

```
--> {"jsonrpc": "3.0", "method": "add", "params": [1, 2], "id": 1}
<-- {"jsonrpc": "3.0", "ack": { "jobId": "a2xi87", "jobQ": { url: "q.hwwer8.io", "authToken": "1xsd2", "ttl": "36h" } }, "id": 1}
```
Upon receiving the above `ack` the  requestor connects to the jobQ (using the above url, authToken) to query the progress and fetche the results when available. 
```
--> /** send request to the jobQ url to get the result through appropriate methods */
<-- {"jsonrpc": "3.0", "result": 3, "id": 1}
```

### 11.2 Stream Request / Responses

```
--> {"jsonrpc": "3.0", "method": "listen.logs", "params": {}, "id": 2, "options": {"stream": true}}
<-- {"jsonrpc": "3.0", "stream": {"id": 2}, "data": "Log entry 1"}
<-- {"jsonrpc": "3.0", "stream": {"id": 2}, "data": "Log entry 2"}
<-- {"jsonrpc": "3.0", "stream": {"id": 2}, "result": "End of logs"}
```

### 11.2.1 Multiple Stream Request / Responses

```
--> {"jsonrpc": "3.0", "method": "listen.logs", "params": {}, "id": 2, "options": {"stream": true}}
<-- {"jsonrpc": "3.0", "stream": {"id": 2}, "data": "Log entry 1"}
--> {"jsonrpc": "3.0", "method": "listen.errors", "params": {}, "id": 5, "options": {"stream": true}}
<-- {"jsonrpc": "3.0", "stream": {"id": 2}, "data": "Log entry 2"}
<-- {"jsonrpc": "3.0", "stream": {"id": 5}, "data": "Err entry 1"}
<-- {"jsonrpc": "3.0", "stream": {"id": 5}, "data": "Err entry 2"}
<-- {"jsonrpc": "3.0", "stream": {"id": 2}, "data": "Log entry 3"}
<-- {"jsonrpc": "3.0", "stream": {"id": 2}, "result": "End of logs for Stream 2"}
<-- {"jsonrpc": "3.0", "stream": {"id": 5}, "data": "Err entry 3"}
<-- {"jsonrpc": "3.0", "stream": {"id": 5}, "data": "Err entry 5"}
```
Multiple stream could be active at the same time, and stream responses may arrive in any order. The order of stream data chunks within a single stream, however, depends on the channel being used. For TCP based connections, such as Websocket etc., the stream responses will arrive in the same order as the order they are sent in. If using UDP based connections (such as WebRTC etc.), the order of the responses is not guaranteed.

### 11.3 Acknowledgment

```
--> {"jsonrpc": "3.0", "method": "start.longTask", "params": {}, "id": 3}
<-- {"jsonrpc": "3.0", "ack": {}, "id": 3}
<-- {"jsonrpc": "3.0", "result": "Task completed", "id": 3}
```

#### 11.3.1 Acknowledgment with Progress  (with extensions)

```
--> {"jsonrpc": "3.0", "method": "start.longTask", "params": {}, "id": 3}
<-- {"jsonrpc": "3.0", "ack": {}, "id": 3}
<-- {"jsonrpc": "3.0", "ack": {"progress": 10, "total": 20}, "id": 3}
<-- {"jsonrpc": "3.0", "ack": {"progress": 20, "total": 20}, "id": 3}
<-- {"jsonrpc": "3.0", "result": "Task completed", "id": 3}
```

### 11.4 Stream Abort Request / Responses
```
--> {"jsonrpc": "3.0", "method": "listen.logs", "params": {}, "id": 2, "options": {"stream": true}}
<-- {"jsonrpc": "3.0", "stream": {"id": 2}, "data": "Log entry 1"}
<-- {"jsonrpc": "3.0", "stream": {"id": 2}, "data": "Log entry 2"}
--> {"jsonrpc": "3.0", "method": "request.cancel", "params": {"stream": 2, "abort": true}}
<-- {"jsonrpc": "3.0", "stream": {"id": 2}, "error": {"code": -32800, "message": "Request cancelled by client."}}
```

#### 11.4.1 Stream Abort Request / Responses  (with extensions)
```
--> {"jsonrpc": "3.0", "method": "listen.logs", "params": {}, "id": 2, "options": {"stream": true}}
<-- {"jsonrpc": "3.0", "stream": {"id": 2}, "data": "Log entry 1"}
<-- {"jsonrpc": "3.0", "stream": {"id": 2}, "data": "Log entry 2"}
--> {"jsonrpc": "3.0", "options": {"stream": 2, "abort": true}}
<-- {"jsonrpc": "3.0", "stream": {"id": 2}, "error": {"code": -32800, "message": "Request cancelled by client."}}
```

#### 11.4.2 Async Stream Request / Responses in DeCentralized / P2P mode  (with extensions)
```
--> {"jsonrpc": "3.0", "method": "listen.logs", "params": {}, "id": "a31dbae", "options": {"stream": true}}
<-- {"jsonrpc": "3.0", "ack": {"id": "a31dbae", "stream": {"id": "fxr2t6", "pubServer":{"conn": "12.84.22.32:3564", "topic": "logs" }}}}
```
After receiving the above `ack`, the requestor subscribes to the PUB-SUB server at the above specific connection on the given topic and starts receiving the stream responses:
```
<-- {"jsonrpc": "3.0", "stream": {"id": "fxr2t6"}, "data": "Log entry 1"}
<-- {"jsonrpc": "3.0", "stream": {"id": "fxr2t6"}, "data": "Log entry 2"}
<-- {"jsonrpc": "3.0", "stream": {"id": "fxr2t6"}, "error": {"code": -32800, "message": "Request cancelled by client."}}
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
