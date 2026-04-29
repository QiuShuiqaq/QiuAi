# QiuAi Permanent Device Lock Design

Date: 2026-04-29

## Goal

Add a simple permanent single-device activation mechanism to QiuAi.

The design must satisfy these confirmed product rules:

- No website, account system, or cloud-based user management.
- Activation is permanent once completed.
- One authorization binds to one Windows device.
- The user can send a device code to the operator, then import a locally generated license file.
- Unauthorized devices can open the app shell but cannot enter the main workflow or submit tasks.
- Existing image-generation, queue, export, and local storage flows must remain intact.

## Scope

This design applies to the Windows desktop application only.

In scope:

- device fingerprint generation
- local license import and validation
- activation gate before the main workspace
- activation status display in the desktop UI
- a local operator script for generating license files

Out of scope:

- expiration dates
- subscription logic
- seat counts
- online validation
- account login
- backend service deployment
- anti-tamper hardening beyond basic signature verification

## Product Rules

### User-Facing Rules

- On first launch without a valid license, QiuAi opens an activation screen.
- The activation screen shows the current device code and allows:
  - copying the device code
  - importing a license file
  - refreshing validation state
- After a valid license is imported, the app immediately unlocks and enters the normal workspace.
- On future launches, a valid bound license skips the activation screen.
- If the local license does not match the current device, the app returns to the activation screen.

### Operator Rules

- The operator manually receives a device code from the customer.
- The operator runs a local script to generate a signed `license.qai` file.
- The operator sends that file back to the customer.
- The operator does not need a website or remote admin console.

## Recommended Architecture

### Main Components

- `deviceFingerprintService`
  - reads Windows device identifiers
  - generates a stable hashed device code
- `licenseService`
  - reads and validates the local license file
  - verifies the digital signature
  - compares the licensed device code with the current device
- `licenseIpc`
  - exposes activation-related actions to the renderer
- `activation screen`
  - blocks the main workspace until a valid license is present
- `generate-license` operator script
  - creates signed license files from a customer name and device code

### Storage Location

License data must not be stored under `DATA/`.

Recommended location:

- `app.getPath('userData')/license/license.qai`

Reasoning:

- keeps authorization separate from business output
- avoids accidental deletion by existing cleanup flows
- behaves correctly in packaged app installs

## Device Code Design

### Source Fields

Use a simple two-field Windows fingerprint:

- `MachineGuid`
- system drive volume serial number

### Normalization

Before hashing:

- trim whitespace
- uppercase values
- replace missing values with a fixed placeholder
- concatenate using a fixed delimiter

### Output

Hash the normalized raw fingerprint with `sha256`.

Expose only a formatted device code to the UI, for example:

- `QAI-7C3D-8A91-24F0-...`

The raw hardware values must never be shown in the renderer.

### Stability Tradeoff

This is intentionally a medium-strength lock:

- stronger than hostname-based locking
- much simpler than full hardware binding
- stable enough for normal use
- reinstalling Windows may require reactivation

That tradeoff is acceptable for this product stage.

## License File Format

Use one small JSON-based file with extension:

- `license.qai`

Recommended structure:

```json
{
  "version": 1,
  "customerName": "Customer Name",
  "deviceCode": "QAI-XXXX-XXXX-XXXX",
  "activatedAt": "2026-04-29T12:00:00.000Z",
  "signature": "base64-signature"
}
```

### Field Rules

- `version`
  - allows future format evolution
- `customerName`
  - shown in the UI after activation
- `deviceCode`
  - must exactly match the current generated device code
- `activatedAt`
  - informational only
- `signature`
  - covers the unsigned payload

No expiration or feature flags are included in this version.

## Signature Model

Use public-key signature verification.

### Rules

- the app contains the public key only
- the operator-side script contains the private key only
- the customer never receives the private key

### Why This Is Required

Without signature verification, users could edit the license JSON and self-activate on other machines.

This level of protection is sufficient for the current product stage without introducing heavy DRM complexity.

## Activation Flow

### First Activation

1. App starts.
2. Main process computes the current device code.
3. Main process tries to load `license.qai` from the local license directory.
4. If no valid bound license exists, renderer shows the activation screen.
5. User copies the device code and sends it to the operator.
6. Operator generates `license.qai`.
7. User imports the file through the activation screen.
8. Main process validates and stores the file.
9. On success, renderer switches into the main workspace immediately.

### Future Launches

1. App starts.
2. Main process computes the device code.
3. Main process validates the stored license.
4. If valid, renderer opens the normal workspace.
5. If invalid or mismatched, renderer opens the activation screen.

## Renderer Behavior

### Activation Screen

Required controls:

- read-only device code display
- `复制设备码`
- `导入授权文件`
- `刷新校验`
- status message area

Required states:

- loading
- not activated
- activated
- invalid license
- device mismatch

### Main Workspace Integration

After activation, show a small non-intrusive status element:

- `已激活`
- `客户名：XXX`

Optional later action:

- `重新导入授权文件`

The first implementation should keep this status lightweight and avoid additional management panels.

## Main Process Integration

### New IPC Surface

Expose these methods through preload:

- `getActivationStatus`
- `getDeviceCode`
- `importLicenseFile`
- `reloadActivation`

### Task Submission Guard

All generation entry points must verify activation before executing.

If the app is not activated:

- do not enqueue a task
- do not call remote APIs
- return a structured failure to the renderer
- show a top-level failure message

This guard must be centralized, not duplicated inconsistently across modules.

## Error Handling

Show simple product-facing messages.

Recommended messages:

- `未检测到授权文件`
- `授权文件已损坏或格式无效`
- `当前设备与授权不匹配`
- `授权校验失败，请重新导入授权文件`
- `导入授权成功`

Do not expose technical details such as stack traces, key material, or signature internals in the renderer.

Detailed failures may still be written to existing local logs for debugging.

## Data Flow

### Activation Read Path

1. Renderer requests activation status.
2. Preload forwards request to main process.
3. Main process loads current device code.
4. Main process loads local license file.
5. `licenseService` validates structure, signature, and device match.
6. Main process returns a normalized activation state object.

### License Import Path

1. Renderer triggers file selection.
2. Main process reads the selected `license.qai`.
3. `licenseService` validates content against the current device.
4. If valid, main process stores the file in the local license directory.
5. Main process returns success status and normalized activation data.

## Security Boundaries

This design is intended to reduce casual sharing, not defeat a determined reverse engineer.

Protected well enough:

- installer copied to another PC without operator approval
- casual JSON editing
- accidental reuse of one customer license on another machine

Not explicitly protected:

- deep binary patching
- advanced runtime hook bypass
- OS-level spoofing by technical users

That boundary is acceptable for the current product stage.

## Testing Strategy

### Unit Tests

- device code generation returns a stable formatted value
- missing device fields still produce a deterministic code
- valid license signature passes
- tampered license payload fails
- mismatched device code fails
- malformed JSON fails

### Integration Tests

- first launch without license shows activation state
- importing a valid license unlocks the app
- importing an invalid license keeps the app blocked
- activated app allows task submission
- non-activated app blocks task submission
- cleanup actions do not remove the stored license

### Manual Verification

- launch unpackaged dev app without license
- activate using generated license
- relaunch and confirm persistent activation
- copy the stored license to another machine and confirm mismatch blocking

## Implementation Order

1. Add `deviceFingerprintService`
2. Add `licenseService`
3. Add `licenseIpc` and preload bridge methods
4. Add renderer activation screen and activation state handling
5. Add centralized activation guard to task submission paths
6. Add the local operator `generate-license` script
7. Add tests for validation and activation flow

## Open Decisions Resolved

- Activation model: permanent local activation
- Binding model: one Windows device
- License format: signed local file
- Storage location: `userData`, not `DATA`
- UX model: activation screen before workspace

No unresolved functional questions remain for the first implementation.
