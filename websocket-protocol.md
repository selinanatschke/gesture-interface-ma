# WebSocket Protocol Specification

## General
- Transport: WebSocket (JSON)
- Values normalized to 0.0 – 1.0 unless stated otherwise

---
### Slider Update (UI -> UE)

Sent from UI to UE when a slider value changes.

```json
{
  "type": "slider:update",
  "target": "volume | brightness | vibration | presentation",
  "value": 0.0 - 1.0
}
```

### Presentation Command (UI -> UE)
Sent from UI to UE when the user interacts with UI components to pause/play video.
```json
{
  "type": "presentation:command",
  "action": "play | pause"
}

```

### Presentation State (UE -> UI)
Sent from UE to Frontend when the connection starts -> important for presentation slider to show the correct values and not only dummy data.
```json
{
  "type": "presentation:state",
  "duration": 220,
  "currentTime": 94,
  "playing": true
}
```