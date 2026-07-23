# K-POP runtime hardening contract

## Query master boundary

`/api/execute/{sqlKey}` treats `query_master.required_params` and
`query_master.param_mapping` as executable security configuration.

- `required_params` is a JSON array of client parameter names.
- `param_mapping` is a JSON object keyed by the exact SQL named parameter.
- Supported types are `string`, `integer`, `long`, `decimal`, `boolean`,
  `date`, `datetime`, `json`, `string_list`, and `long_list`.
- A mapping entry can be a type string or an object such as
  `{"source":"params.region","type":"string","required":false}`.
- `userSqno` and `userId` are reserved. Client input using either name is
  rejected; the authenticated principal is the only source.
- Malformed metadata, unsafe names, or SQL named parameters absent from the
  mapping fail closed before JDBC execution.
- Logs contain the SQL key and parameter **names only**. SQL text, parameter
  values, and raw exception messages are never returned.

Errors retain the common `ApiResponse` shape and include stable `code` and
`requestId`. Unknown keys return 404, request policy violations return 400,
and unsafe configuration or execution failures return 500. Read failures are
never converted to an empty success response.

## Redis keys and TTL

All K-POP keys use the versioned `kpop:v1:` namespace. Variable inputs are
canonicalized and SHA-256 hashed; raw search text and idempotency keys are not
embedded in Redis keys.

| Scope | Key form | Default TTL |
| --- | --- | --- |
| Artist/event catalog | `kpop:v1:catalog:<resource>:<digest>` | 300 seconds |
| Product/search results | `kpop:v1:catalog:<resource>:<digest>` | 180 seconds |
| `query_master` K-POP result | `kpop:v1:query:<sqlKey>:<digest>` | DB TTL, clamped to 30–3600 seconds |
| Analysis idempotency | `kpop:v1:idempotency:<digest>` | 24 hours |
| Short rate window | `kpop:v1:rate:analysis:<user>:<window>` | remaining window + 5 seconds |

Catalog writes on `artist`, `event`, `product_candidate`, and
`kpop_analysis_candidate` emit a PostgreSQL notification. The listener deletes
the catalog/query key registries; TTL remains a safety net if notification or
Redis is unavailable. Cache read, decode, write, and invalidation errors fall
back to PostgreSQL and emit telemetry instead of failing the request.

## Analysis submission controls

Defaults are configurable without a schema or code change:

| Property / environment | Default |
| --- | --- |
| `kpop.analysis.rate.window-capacity` / `KPOP_ANALYSIS_WINDOW_CAPACITY` | 3 |
| `kpop.analysis.rate.window-seconds` / `KPOP_ANALYSIS_WINDOW_SECONDS` | 600 |
| `kpop.analysis.rate.max-active` / `KPOP_ANALYSIS_MAX_ACTIVE` | 2 |
| `kpop.analysis.rate.max-daily` / `KPOP_ANALYSIS_MAX_DAILY` | 10 |
| `kpop.analysis.rate.active-retry-seconds` / `KPOP_ANALYSIS_ACTIVE_RETRY_SECONDS` | 60 |

Limits return HTTP 429 with `Retry-After`: the remaining short-window time,
the configured active retry, or seconds until the next Asia/Seoul midnight.
Redis provides a fast short-window counter, while PostgreSQL counts and a
pessimistic user lock remain the authoritative fallback.

Idempotency is scoped by `(requested_by, idempotency_key)`. The persisted
SHA-256 fingerprint covers `sourceKey`, `contentType`, and `consentScope`.
Reusing the same key and payload returns the existing job with
`idempotentReplay=true`; a different payload returns 409
`IDEMPOTENCY_CONFLICT`. Redis only accelerates lookup—database ownership,
fingerprint comparison, the user lock, and the unique index enforce correctness.

## Observability

Structured audit logs use stable `audit_event`, `outcome`, `subject`,
`keyNames`, and `requestId` fields. The `kride.backend.operations` counter uses
bounded `event` and `outcome` tags. Important outcomes include query policy
rejection/configuration failure, query execution failure, cache fallback,
idempotency replay/conflict, and each rate-limit tier.
