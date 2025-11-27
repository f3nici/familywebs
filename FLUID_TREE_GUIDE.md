# Fluid Relationship Line System - Complete Guide

## Overview

This implementation provides a **familybushes.com-style** fluid relationship line system for family trees using React Flow. It features:

- ✨ Smooth curved SVG edges connecting family members
- 👥 Custom person nodes with gender-based styling
- 💍 Marriage nodes as small circles between partners
- 🎯 Top and bottom handles for flexible connections
- 🎨 Elegant dotted/dashed lines with subtle animations
- 📱 Fully responsive and draggable nodes

---

## Core Concepts

### 1. **Node Architecture**

#### Person Nodes
- **Appearance**: Rounded rectangles with avatar circles
- **Handles**: 4 handles (source-top, target-top, source-bottom, target-bottom)
- **Content**: Name, surname, birth/death dates, avatar initials
- **Gender styling**: Different colors for MALE, FEMALE, OTHER

#### Marriage Nodes
- **Appearance**: Small circular nodes (20px)
- **Purpose**: Represent the union between two people
- **Handles**: Same 4-handle system
- **Position**: Sit between partners, slightly below them

### 2. **Connection Pattern**

```
Parent 1 (bottom-handle) ──▶ Marriage Node (top-handle)
Parent 2 (bottom-handle) ──▶ Marriage Node (top-handle)
Marriage Node (bottom-handle) ──▶ Child 1 (top-handle)
Marriage Node (bottom-handle) ──▶ Child 2 (top-handle)
```

### 3. **Edge Curves - The Magic**

The smooth curves are created using **cubic Bezier paths** with control points:

```javascript
// For vertical connections (most common)
controlPoint1 = {
    x: sourceX,  // Same X as source
    y: sourceY + (verticalDistance * 0.5)  // Halfway to target
}

controlPoint2 = {
    x: targetX,  // Same X as target
    y: targetY - (verticalDistance * 0.5)  // Halfway from target
}
```

This creates the characteristic smooth "S-curve" or vertical curve.

**Why this works:**
- Control points share X-coordinates with their respective endpoints
- Y-offset is proportional to vertical distance
- Results in elegant, organic-looking curves

### 4. **Edge Types**

- **Marriage edges** (parent → marriage): Warm color, thicker, slower animation
- **Child edges** (marriage → child): Sage/green color, thinner, faster animation

---

## Code Structure

### Files Created

1. **FluidTreeWithReactFlow.js** - Main component with:
   - `PersonNode` - Custom person node component
   - `MarriageNode` - Custom marriage node component
   - `FluidEdge` - Custom edge with Bezier curves
   - `calculateFluidLayout` - Layout algorithm
   - `FluidTreeWithReactFlow` - Main React Flow wrapper

2. **react-flow-styles.css** - Complete styling:
   - Node styles with hover/selection states
   - Edge styles with animations
   - Handle visibility logic
   - Responsive design

---

## Integration Steps

### Step 1: Add React Flow to HTML

Add to your `index.html` `<head>`:

```html
<!-- React Flow -->
<script src="https://cdn.jsdelivr.net/npm/reactflow@11.10.1/dist/umd/index.min.js"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reactflow@11.10.1/dist/style.css">

<!-- Custom React Flow Styles -->
<link rel="stylesheet" href="react-flow-styles.css">
```

### Step 2: Add Script to HTML

Add before closing `</body>`:

```html
<script type="text/babel" src="FluidTreeWithReactFlow.js"></script>
```

### Step 3: Use in Your App

Replace the existing `FluidTreeView` component in `app.js`:

```javascript
// Instead of the simple FluidTreeView, use:
{viewMode === 'fluid' ? (
    <FluidTreeWithReactFlow
        treeData={treeData}
        selectedPerson={selectedPerson}
        onSelectPerson={setSelectedPerson}
    />
) : (
    <StrictTreeView ... />
)}
```

---

## How the Layout Algorithm Works

### Generation-Based Positioning

1. **Find Root Generation**: People who are parents but not children
2. **BFS Traversal**: Assign generation levels using breadth-first search
3. **Horizontal Spacing**: Distribute people within each generation
4. **Marriage Node Placement**: Position between partners, below them
5. **Edge Creation**: Connect parents → marriage → children

### Example Layout:

```
Gen 0:  [Person A]    [Person B]         [Person C]    [Person D]
              \           /                     \           /
Gen 1:         [Marriage 1]                      [Marriage 2]
                   |                                  |
Gen 2:        [Child 1]  [Child 2]            [Child 3]  [Child 4]
```

### Position Calculation:

```javascript
// Each generation
currentY = generationIndex * verticalSpacing + initialY

// Within generation
totalWidth = (peopleCount - 1) * (nodeWidth + horizontalSpacing)
startX = centerX - (totalWidth / 2)
personX = startX + (index * (nodeWidth + horizontalSpacing))

// Marriage nodes
marriageX = (parent1X + parent2X) / 2
marriageY = max(parent1Y, parent2Y) + nodeHeight + offset
```

---

## Customization Guide

### Adjust Curve Steepness

In `FluidEdge` component, modify `controlOffset`:

```javascript
const controlOffset = verticalDistance * 0.5; // Current: 50%

// More gradual curves:
const controlOffset = verticalDistance * 0.3; // 30%

// Steeper curves:
const controlOffset = verticalDistance * 0.7; // 70%
```

### Change Node Spacing

In `calculateFluidLayout`:

```javascript
const horizontalSpacing = 100; // Pixels between nodes
const verticalSpacing = 200;   // Pixels between generations
```

### Modify Edge Styles

In `react-flow-styles.css`:

```css
/* Marriage edges */
.react-flow-edge-path.marriage-edge {
    stroke-width: 3;           /* Thickness */
    stroke-dasharray: 6 4;     /* Dash pattern: 6px dash, 4px gap */
    animation: dash-flow 20s;  /* Animation speed */
}

/* Child edges */
.react-flow-edge-path.child-edge {
    stroke-width: 2.5;
    stroke-dasharray: 4 3;     /* Different pattern */
    animation: dash-flow 25s;  /* Slower */
}
```

### Change Colors

Use CSS variables in `:root`:

```css
:root {
    --accent-warm: #c4956a;      /* Marriage nodes & edges */
    --accent-sage: #8fa388;      /* Child edges */
    /* ... other colors ... */
}
```

---

## Advanced Features

### Handling Complex Families

The algorithm handles:
- **Remarriages**: Multiple marriage nodes for same person
- **Half-siblings**: Different marriage nodes share a parent
- **Step-families**: Children connected to different marriage nodes
- **Multiple generations**: Unlimited depth

### Draggable Nodes

Nodes are draggable by default. When dragged:
- Edges automatically recalculate curves
- Layout is preserved
- Smooth transitions

Disable dragging:
```javascript
<ReactFlow
    nodesDraggable={false}
    // ...
/>
```

### Add Edge Markers (Arrows)

Uncomment in `FluidEdge`:

```javascript
markerEnd={{
    type: 'arrowclosed',
    color: 'currentColor'
}}
```

---

## Performance Optimization

### For Large Trees (100+ people)

1. **Lazy Loading**: Only render visible generations
2. **Virtualization**: Use React Flow's built-in viewport culling
3. **Simplify Edges**: Reduce `stroke-dasharray` animation
4. **Memoization**: Already implemented with `React.useMemo`

### Reduce Animations

For lower-end devices:

```css
@media (prefers-reduced-motion: reduce) {
    .react-flow-edge-path {
        animation: none !important;
    }
}
```

---

## Troubleshooting

### Issue: Edges don't appear

**Solution**: Ensure React Flow CSS is loaded:
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reactflow@11.10.1/dist/style.css">
```

### Issue: Nodes overlap

**Solution**: Increase spacing in `calculateFluidLayout`:
```javascript
const horizontalSpacing = 150; // Increase from 100
const verticalSpacing = 250;   // Increase from 200
```

### Issue: Curves look jagged

**Solution**: Increase `stroke-width` for smoother appearance:
```css
.react-flow-edge-path {
    stroke-width: 3; /* Up from 2.5 */
}
```

### Issue: React Flow is undefined

**Solution**: Check script load order in HTML:
```html
<!-- Load React first -->
<script src="react..."></script>
<script src="react-dom..."></script>
<!-- Then React Flow -->
<script src="reactflow..."></script>
<!-- Then your code -->
<script src="FluidTreeWithReactFlow.js"></script>
```

---

## Example Data Structure

Your `treeData` should have this shape:

```javascript
{
    "people": {
        "1": {
            "name": "John",
            "surname": "Smith",
            "gender": "MALE",
            "events": [
                { "type": "$_BIRTH", "dateStart": "1950-01-15" }
            ]
        },
        "2": {
            "name": "Jane",
            "surname": "Doe",
            "gender": "FEMALE",
            "events": [
                { "type": "$_BIRTH", "dateStart": "1952-03-20" }
            ]
        },
        "3": {
            "name": "Bob",
            "surname": "Smith",
            "gender": "MALE",
            "events": [
                { "type": "$_BIRTH", "dateStart": "1975-06-10" }
            ]
        }
    },
    "mariages": [
        ["1", "2", "3"]  // John + Jane had child Bob
        // Format: [parent1, parent2, child1, child2, ...]
    ]
}
```

---

## Browser Compatibility

- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ⚠️ IE11: Not supported (React Flow requires modern browsers)

---

## Next Steps

1. ✅ Basic fluid layout working
2. 🎯 Add zoom controls (already in React Flow)
3. 🎯 Implement node editing via drag-and-drop
4. 🎯 Add relationship creation UI
5. 🎯 Export layout as image/PDF
6. 🎯 Add search highlighting
7. 🎯 Implement family statistics sidebar

---

## Credits

- **React Flow**: [reactflow.dev](https://reactflow.dev)
- **Inspiration**: [familybushes.com](https://familybushes.com)
- **Design**: Custom elegant styling with warm earth tones

---

## License

This code is provided as-is for your family tree project. Feel free to modify and extend it.
