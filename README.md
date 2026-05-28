# Email Verification Module

A robust email verification system built with Node.js that validates email addresses using syntax checks, DNS MX lookup, SMTP mailbox verification, and typo detection.

---

# Features

## Core Email Verification

* Validates email syntax using strict regex patterns
* Performs DNS MX record lookup
* Connects to SMTP servers
* Verifies mailbox existence using SMTP `RCPT TO` command
* Returns structured verification results

## "Did You Mean?" Typo Detection

* Detects common email domain typos
* Uses Levenshtein Distance Algorithm
* Suggests corrected domains automatically

Examples:

* `gmial.com → gmail.com`
* `hotmial.com → hotmail.com`
* `outlok.com → outlook.com`

## Structured Verification Response

Returns:

* `email`
* `result`
* `resultcode`
* `subresult`
* `domain`
* `mxRecords`
* `executiontime`
* `error`
* `timestamp`
* `didyoumean`

---

# Result Codes

| Result Code | Meaning                   |
| ----------- | ------------------------- |
| 1           | Valid Email               |
| 3           | Unknown / Temporary Issue |
| 6           | Invalid Email             |

---

# Tech Stack

* Node.js
* TypeScript / JavaScript
* DNS MX Lookup
* SMTP Protocol
* Levenshtein Distance Algorithm
* Jest (Unit Testing)

---

# SMTP Validation Logic

The module:

1. Extracts the email domain
2. Performs MX lookup
3. Connects to the mail server
4. Sends SMTP commands
5. Uses `RCPT TO` to verify mailbox existence
6. Maps SMTP responses into structured verification results

SMTP Error Mapping:

* `550` → Invalid mailbox
* `450/451/452` → Unknown / Temporary issue

---

# Typo Detection

The typo detection system:

* Uses edit distance ≤ 2
* Detects domain misspellings
* Suggests corrected domains automatically

Example:

```json
{
  "email": "user@gmial.com",
  "didyoumean": "user@gmail.com"
}
```

---

# Unit Test Coverage

Total Test Cases: **57**

## Test Breakdown

### Levenshtein Distance Tests (10)

* String comparison validation
* Edit distance calculations

### Syntax Validation Tests (7)

* Missing `@`
* Double `@`
* Double dots
* Invalid formats

### Typo Detection Tests (8)

* Common domain typos
* Edge cases

### verifyEmail Syntax Failure Tests (16)

* Invalid emails rejected early

### DNS Failure Tests (5)

* Non-existent domains

### Live SMTP Tests (8)

* Structure validation
* Real network probe

### Typo Suggestion Integration Tests (3)

* `didyoumean` field verification

---

# Edge Cases Handled

* Empty strings
* Null / undefined values
* Multiple `@` symbols
* Very long email addresses
* Connection timeouts
* Invalid domains

---

# Test Results

```bash
57/57 tests passed ✅
0 failed ❌
```

---

# Example Verification Response

```json
{
  "email": "example@gmail.com",
  "result": "valid",
  "resultcode": 1,
  "subresult": "mailbox_exists",
  "domain": "gmail.com",
  "mxRecords": ["gmail-smtp-in.l.google.com"],
  "executiontime": "320ms",
  "error": null,
  "timestamp": "2026-05-24T12:00:00Z",
  "didyoumean": null
}
```

---

# Future Improvements

* Catch-all domain detection
* Disposable email detection
* Role-based email filtering
* API rate limiting
* Bulk email verification
* Web dashboard integration

---

# Author

Amir Hussain
