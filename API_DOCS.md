# Intelligent Baby Minder Backend - API Examples

## Base URLs

- Dev (local): `http://localhost:3000`
- Prod: `http://31.220.82.129:5002`

All endpoints below are prefixed with `/api`.

## Authentication Notes

- Auth is optional for chat. Guest users can start chat sessions without a token.
- When authenticated, include the JWT in the `Authorization` header: `Bearer <token>`.

## 1. NLP Intent Detection

**Endpoint**: `POST /api/nlp/intent`  
**Description**: Analyzes raw text using rule-based algorithms to detect the core infant issue (CRY, FACE, SKIN, UNKNOWN).

**Request Body:**
```json
{
  "message": "The baby is making a high pitched wail and pulling legs up."
}
```

**Response:**
```json
{
  "intent": "CRY"
}
```

## 2. Start Chat Session (Optional Auth)

**Endpoint**: `POST /api/chat/start`  
**Description**: Initializes a new decision tree flow for a specific intent type. Works in guest mode or with JWT.

**Request Body:**
```json
{
  "flowType": "CRY"
}
```

**Response:**
```json
{
  "sessionId": "a1b2c3d4-e5f6-...",
  "question": "Is the baby crying continuously for more than 3 hours a day?",
  "isFinal": false,
  "nodeId": "1111-2222-3333"
}
```

## 3. Answer Chat Session

**Endpoint**: `POST /api/chat/answer`  
**Description**: Continues the chat flow based on user input, returning the next question or final triage advice.

**Request Body:**
```json
{
  "sessionId": "a1b2c3d4-e5f6-...",
  "answer": "yes"
}
```

**Response (Continuing flow):**
```json
{
  "isFinal": false,
  "question": "Does the baby pull their legs to their stomach or clench their fists?",
  "nodeId": "5555-6666-7777"
}
```

**Response (Final state reached):**
```json
{
  "isFinal": true,
  "advice": "This might be colic. Try gentle rocking, a pacifier, or consult your pediatrician if worried.",
  "triageLevel": "CONSULT_DOCTOR"
}
```

## 4. Sign Up

**Endpoint**: `POST /api/auth/signup`
**Description**: Creates a new user and returns a JWT access token.

**Request Body:**
```json
{
  "email": "parent@example.com",
  "password": "secret123",
  "name": "Jane Doe"
}
```

**Response:**
```json
{
  "access_token": "<jwt>",
  "user": {
    "id": "a1b2c3d4-e5f6-...",
    "email": "parent@example.com",
    "name": "Jane Doe"
  }
}
```

## 5. Login

**Endpoint**: `POST /api/auth/login`
**Description**: Logs in an existing user and returns a JWT access token.

**Request Body:**
```json
{
  "email": "parent@example.com",
  "password": "secret123"
}
```

**Response:**
```json
{
  "access_token": "<jwt>",
  "user": {
    "id": "a1b2c3d4-e5f6-...",
    "email": "parent@example.com",
    "name": "Jane Doe"
  }
}
```

## 6. Get Current User Profile

**Endpoint**: `GET /api/users/profile`
**Description**: Returns the current authenticated user's profile.

**Headers:**
```
Authorization: Bearer <jwt>
```

**Response:**
```json
{
  "id": "a1b2c3d4-e5f6-...",
  "email": "parent@example.com",
  "name": "Jane Doe",
  "createdAt": "2026-05-04T10:20:30.000Z"
}
```
