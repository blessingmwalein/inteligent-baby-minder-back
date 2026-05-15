# Intelligent Baby Minder Backend — API Examples (v2)

## Base URLs

- Dev (local): `http://localhost:3000`
- Prod: `http://31.220.82.129:5002`

All endpoints are prefixed with `/api`.

## Authentication

- Auth is **optional** for most chat endpoints. Guest users can create sessions and chat without a token.
- Listing all your sessions (`GET /api/chat/sessions`) requires a JWT.
- Send the JWT in the `Authorization` header: `Bearer <token>`.

## Breaking changes from v1

The decision-tree endpoints (`POST /api/nlp/intent`, `POST /api/chat/start`, `POST /api/chat/answer`) are **removed**. They are replaced by a single conversational endpoint backed by Google Gemini.

## 1. Create a chat session

**`POST /api/chat/sessions`** (auth optional)

**Response**:
```json
{
  "sessionId": "a1b2c3d4-e5f6-...",
  "greeting": "Hi! I'm Baby Minder. Tell me what's happening with your little one...",
  "createdAt": "2026-05-15T10:00:00.000Z"
}
```

## 2. Send a message

**`POST /api/chat/sessions/:id/messages`** (auth optional)

Runs the safety pre-filter, then Gemini, then the safety post-filter. Persists both the user message and the assistant reply.

**Request**:
```json
{ "content": "My baby has had a red rash on her cheek for two days." }
```

**Response**:
```json
{
  "messageId": "uuid",
  "reply": "That sounds uncomfortable. A short-lived red patch on the cheek is often eczema or contact irritation...",
  "triageLevel": "CONSULT_DOCTOR",
  "followUpQuestions": [
    "Is the rash dry and rough, or wet and weeping?",
    "Has she had any fever?"
  ],
  "topic": "skin",
  "safetyOverride": false,
  "degraded": false
}
```

**Safety override example** — a message containing a red-flag phrase bypasses Gemini:
```bash
curl -X POST .../api/chat/sessions/$ID/messages \
  -H 'Content-Type: application/json' \
  -d '{"content":"My baby is not breathing"}'
```
Response includes `"safetyOverride": true` and `"triageLevel": "EMERGENCY"`.

## 3. Fetch a session's message history

**`GET /api/chat/sessions/:id/messages`** (auth optional)

```json
{
  "sessionId": "uuid",
  "messages": [
    { "id": "...", "role": "USER", "content": "...", "createdAt": "..." },
    { "id": "...", "role": "ASSISTANT", "content": "...", "triageLevel": "NORMAL", "createdAt": "..." }
  ]
}
```

## 4. List your sessions

**`GET /api/chat/sessions`** (auth **required**)

```json
[
  {
    "id": "uuid",
    "topic": "rash",
    "title": null,
    "lastTriageLevel": "CONSULT_DOCTOR",
    "createdAt": "...",
    "updatedAt": "..."
  }
]
```

## 5. Delete a session

**`DELETE /api/chat/sessions/:id`** (auth optional for anonymous sessions; required if the session has an owner)

```json
{ "success": true }
```

## 6. Sign up

**`POST /api/auth/signup`**

```json
{ "email": "parent@example.com", "password": "secret123", "name": "Jane Doe" }
```

→

```json
{
  "access_token": "<jwt>",
  "user": { "id": "uuid", "email": "parent@example.com", "name": "Jane Doe" }
}
```

## 7. Log in

**`POST /api/auth/login`**

```json
{ "email": "parent@example.com", "password": "secret123" }
```

## 8. Profile

**`GET /api/users/profile`** (auth required)

```json
{
  "id": "uuid",
  "email": "parent@example.com",
  "name": "Jane Doe",
  "createdAt": "..."
}
```

## Manual verification checklist

```bash
BASE=http://localhost:3000/api

# Create session
SID=$(curl -s -X POST $BASE/chat/sessions | jq -r .sessionId)

# Normal message
curl -s -X POST $BASE/chat/sessions/$SID/messages \
  -H 'Content-Type: application/json' \
  -d '{"content":"My baby has been crying for 2 hours"}' | jq

# Safety override
curl -s -X POST $BASE/chat/sessions/$SID/messages \
  -H 'Content-Type: application/json' \
  -d '{"content":"baby is not breathing"}' | jq
# Expect: safetyOverride=true, triageLevel=EMERGENCY, hardcoded reply.

# History
curl -s $BASE/chat/sessions/$SID/messages | jq
```

## Environment variables

See `.env.example`. Required: `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`.
