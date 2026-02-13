# Radial Menu Configuration

This document describes how the radial menu must be structured and how menu items are defined.

The menu is fully data-driven and configured via a JSON object.
Each menu item must follow a simple rule:

A menu item can either open a submenu or trigger an UI action (e.g., open a slider).

---
## Root Structure
```json
{
    "radius": number,
    "subRadius": number,
    "items": [ MenuItem ]
}
```

### Properties

- radius: Radius of the main radial menu. 
- subRadius: Radius used for submenu levels.
- items: Array of top-level menu items.

---
## Menu Item Structure

Each item in items or children must follow this structure:

```json
{
    "id": "number",
    "label": "string",
    "type": "menu | slider | button | placeholder",
    "icon": "name of .png file (string)",
    "target": "string (optional)",
    "children": [ MenuItem ] (optional)
}
```

### Rules
#### 1. Submenu Items 
- If a menu item opens a submenu:
  - type must be "menu"
  - children must be defined 
  - target must NOT be defined

Example:
```json
{
    "id": 0,
    "label": "H, L, V einstellen",
    "type": "menu",
    "icon": "H, L, V einstellen",
    "children": [
        {
        "id": 0,
        "label": "Volume",
        "type": "slider",
         "icon": "volume",
         "target": "volume"
        }
    ] 
}
```

#### 2. Slider Items
- If a menu item opens a slider:
  - type must be "slider"
  - target must match a valid system target 
  - children must NOT be defined

Example:
```json
{
    "id": 0,
    "label": "Brightness",
    "type": "slider",
    "icon": "brightness",
    "target": "brightness"
}
```

- The target value must correspond to a valid WebSocket target, such as:
  - volume | brightness | vibration | presentation

#### 2. Button Items
- If a menu item has a button action:
  - type must be "button"
  - target must match a valid system target
  - children must NOT be defined
  - in case that the action sets a flag, the icon can be used to determine its state
    - in this case the icon has two states: default and action which are switched to give the user feedback

Example:
```json
{
    "id": 0,
    "label": "Play/Pause",
    "type": "button",
    "icon": {
      "default": "play",
      "active": "pause"
    },
    "target": "presentation"
}
```

### Structural Constraints
- A menu item must not contain both children and target. 
- A menu item must always define a type. 
- children is only allowed if type is "menu".

Complete Example
```json
{
  "radius": 200,
  "subRadius": 100,
  "items": [
    {
      "id": 1,
      "label": "H, V, L einstellen",
      "type": "menu",
      "icon": "hvl-settings",
      "children": [
        {
          "id": 11,
          "label": "Lautstärke",
          "type": "slider",
          "icon": "volume",
          "target": "volume"
        },
        {
          "id": 12,
          "label": "Helligkeit",
          "type": "slider",
          "icon": "brightness",
          "target": "brightness"
        },
        {
          "id": 13,
          "label": "Vibration",
          "type": "slider",
          "icon": "vibration",
          "target": "vibration"
        }
      ]
    },
    {
      "id": 2,
      "label": "Präsentationssteuerung",
      "type": "slider",
      "icon": "presentation",
      "children": [
        {
          "id": 21,
          "label": "Präsentationssteuerung",
          "type": "slider",
          "icon": "presentation-length",
          "target": "presentation"
        },
        {
          "id": 22,
          "label": "Play/Pause",
          "type": "button",
          "icon": "play",
          "target": "presentation"
        }
      ]
    },
    {
      "id": 3,
      "label": "C",
      "type": "menu",
      "icon": "C",
      "children": [
        {
          "id": 31,
          "label": "C1",
          "type": "placeholder",
          "icon": "C1",
          "target": "text"
        },
        {
          "id": 32,
          "label": "C2",
          "type": "placeholder",
          "icon": "C2",
          "target": "number"
        }
      ]
    }
  ]
}
```
