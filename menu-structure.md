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
    "label": "string",
    "type": "menu | slider | button | placeholder",
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
    "label": "H, L, V einstellen",
    "type": "menu",
    "children": [
        {
        "label": "Volume",
        "type": "slider",
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
    "label": "Brightness",
    "type": "slider",
    "target": "brightness"
}
```

- The target value must correspond to a valid WebSocket target, such as:
  - volume | brightness | vibration | presentation


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
            "label": "H, L, V Settings",
            "type": "menu",
            "children": [
                {
                    "label": "Volume",
                    "type": "slider",
                    "target": "volume"
                },
                {
                    "label": "Brightness",
                    "type": "slider",
                    "target": "brightness"
                },
                {
                    "label": "Vibration",
                    "type": "slider",
                    "target": "vibration"
                }
            ]
        },
        {
            "label": "Presentation",
            "type": "slider",
            "target": "presentation"
        },
        {
            "label": "C",
            "type": "menu",
            "children": [
                {
                    "label": "C1",
                    "type": "placeholder",
                    "target": "text"
                },
                {
                    "label": "C2",
                    "type": "placeholder",
                    "target": "number"
                }
            ]
        }
    ] 
}
```
