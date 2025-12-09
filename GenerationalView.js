// ==========================================
// GENERATIONAL VIEW COMPONENT
// Infinite canvas with proper hierarchical generation calculation
// ==========================================

const GenerationalView = ({ treeData, selectedPerson, onSelectPerson }) => {
    const { useMemo, useRef, useState, useCallback, useEffect } = React;
    const containerRef = useRef(null);
    const [viewTransform, setViewTransform] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [initialZoomSet, setInitialZoomSet] = useState(false);
    const [draggingNode, setDraggingNode] = useState(null);
    const [nodeDragStart, setNodeDragStart] = useState({ x: 0, y: 0 });
    const [nodePositions, setNodePositions] = useState(new Map());
    const [marriageNodePositions, setMarriageNodePositions] = useState(new Map());

    // STEP 1: Calculate generations with proper conflict resolution
    const generationData = useMemo(() => {
        console.log('🔍 Calculating generations from tree data');

        const allPeople = Object.keys(treeData.people);
        const personGeneration = new Map();

        // Build relationship maps
        const childToParents = new Map();
        const personToSpouses = new Map();
        const personToChildren = new Map();

        treeData.mariages.forEach((marriage, idx) => {
            if (marriage.length < 2) return;

            const [parent1, parent2, ...children] = marriage;

            if (!personToSpouses.has(parent1)) personToSpouses.set(parent1, new Set());
            if (!personToSpouses.has(parent2)) personToSpouses.set(parent2, new Set());
            personToSpouses.get(parent1).add(parent2);
            personToSpouses.get(parent2).add(parent1);

            if (!personToChildren.has(parent1)) personToChildren.set(parent1, new Set());
            if (!personToChildren.has(parent2)) personToChildren.set(parent2, new Set());
            children.forEach(childId => {
                personToChildren.get(parent1).add(childId);
                personToChildren.get(parent2).add(childId);
                childToParents.set(childId, [parent1, parent2]);
            });

            console.log(`Marriage ${idx}: [${parent1}, ${parent2}] -> children: [${children.join(', ')}]`);
        });

        const rootPeople = allPeople.filter(id => !childToParents.has(id));
        console.log('Root people (no parents):', rootPeople);

        rootPeople.forEach(rootId => {
            personGeneration.set(rootId, 0);
        });

        const normalizeGenerations = () => {
            let changed = true;
            let iterations = 0;
            const maxIterations = 100;

            while (changed && iterations < maxIterations) {
                changed = false;
                iterations++;

                personToSpouses.forEach((spouses, personId) => {
                    if (!personGeneration.has(personId)) return;

                    const personGen = personGeneration.get(personId);
                    spouses.forEach(spouseId => {
                        if (!personGeneration.has(spouseId)) {
                            personGeneration.set(spouseId, personGen);
                            changed = true;
                        } else if (personGeneration.get(spouseId) !== personGen) {
                            const minGen = Math.min(personGen, personGeneration.get(spouseId));
                            personGeneration.set(personId, minGen);
                            personGeneration.set(spouseId, minGen);
                            changed = true;
                        }
                    });
                });

                childToParents.forEach((parents, childId) => {
                    const [parent1, parent2] = parents;

                    if (!personGeneration.has(parent1) || !personGeneration.has(parent2)) {
                        return;
                    }

                    const p1Gen = personGeneration.get(parent1);
                    const p2Gen = personGeneration.get(parent2);

                    if (p1Gen !== p2Gen) {
                        const minGen = Math.min(p1Gen, p2Gen);
                        personGeneration.set(parent1, minGen);
                        personGeneration.set(parent2, minGen);
                        changed = true;
                    }

                    const parentGen = personGeneration.get(parent1);
                    const childGen = parentGen + 1;

                    if (!personGeneration.has(childId)) {
                        personGeneration.set(childId, childGen);
                        changed = true;
                    } else if (personGeneration.get(childId) !== childGen) {
                        const currentChildGen = personGeneration.get(childId);

                        if (currentChildGen < childGen) {
                            const newParentGen = currentChildGen - 1;
                            personGeneration.set(parent1, newParentGen);
                            personGeneration.set(parent2, newParentGen);
                            changed = true;
                        } else {
                            personGeneration.set(childId, childGen);
                            changed = true;
                        }
                    }
                });

                personGeneration.forEach((gen, personId) => {
                    if (personToSpouses.has(personId)) {
                        personToSpouses.get(personId).forEach(spouseId => {
                            if (!personGeneration.has(spouseId) || personGeneration.get(spouseId) !== gen) {
                                personGeneration.set(spouseId, gen);
                                changed = true;
                            }
                        });
                    }
                });
            }

            console.log(`Normalization complete after ${iterations} iterations`);
        };

        normalizeGenerations();

        allPeople.forEach(personId => {
            if (!personGeneration.has(personId)) {
                personGeneration.set(personId, 0);
            }
        });

        const generationMap = new Map();
        personGeneration.forEach((gen, personId) => {
            if (!generationMap.has(gen)) generationMap.set(gen, []);
            generationMap.get(gen).push(personId);
        });

        const sortedGenerations = Array.from(generationMap.entries())
            .sort((a, b) => a[0] - b[0]);

        console.log('Final generations:', sortedGenerations);

        return {
            sortedGenerations,
            personGeneration,
            childToParents,
            personToSpouses
        };
    }, [treeData]);

    // STEP 2: Calculate layout positions using Dagre for hierarchical arrangement
    const layout = useMemo(() => {
        const CARD_WIDTH = 200;
        const CARD_HEIGHT = 150;
        const MARRIAGE_SIZE = 20; // Increased to match Web View

        // Calculate marriages per generation for adaptive spacing
        const marriagesPerGeneration = new Map();
        treeData.mariages.forEach((marriage, idx) => {
            if (marriage.length < 2) return;
            const [parent1, parent2] = marriage;
            const gen = generationData.personGeneration.get(parent1);
            if (gen !== undefined) {
                marriagesPerGeneration.set(gen, (marriagesPerGeneration.get(gen) || 0) + 1);
            }
        });

        console.log('📊 Marriages per generation:', Object.fromEntries(marriagesPerGeneration));

        const dagreGraph = new dagre.graphlib.Graph();
        dagreGraph.setDefaultEdgeLabel(() => ({}));
        dagreGraph.setGraph({
            rankdir: 'TB',
            nodesep: 80,
            ranksep: 120 // Base spacing between generations
        });

        const nodes = [];
        const edges = [];

        Object.keys(treeData.people).forEach(personId => {
            nodes.push({ id: personId, type: 'person' });
        });

        treeData.mariages.forEach((marriage, idx) => {
            if (marriage.length < 2) return;

            const [parent1, parent2, ...children] = marriage;
            const marriageId = `marriage-${idx}`;

            nodes.push({ id: marriageId, type: 'marriage' });

            edges.push({ id: `edge-${parent1}-${marriageId}`, source: parent1, target: marriageId });
            edges.push({ id: `edge-${parent2}-${marriageId}`, source: parent2, target: marriageId });

            children.forEach(childId => {
                edges.push({ id: `edge-${marriageId}-${childId}`, source: marriageId, target: childId });
            });
        });

        nodes.forEach(node => {
            const width = node.type === 'marriage' ? MARRIAGE_SIZE * 2 : CARD_WIDTH;
            const height = node.type === 'marriage' ? MARRIAGE_SIZE * 2 : CARD_HEIGHT;
            dagreGraph.setNode(node.id, { width, height });
        });

        edges.forEach(edge => {
            dagreGraph.setEdge(edge.source, edge.target);
        });

        dagre.layout(dagreGraph);

        const positions = new Map();
        const calculatedMarriageNodePositions = new Map();

        // First pass: Get initial positions from Dagre
        const initialPositions = new Map();
        const initialMarriagePositions = new Map();

        nodes.forEach(node => {
            const dagreNode = dagreGraph.node(node.id);
            if (!dagreNode) return;

            if (node.type === 'person') {
                initialPositions.set(node.id, {
                    x: dagreNode.x - CARD_WIDTH / 2,
                    y: dagreNode.y - CARD_HEIGHT / 2,
                    width: CARD_WIDTH,
                    height: CARD_HEIGHT,
                    generation: generationData.personGeneration.get(node.id)
                });
            } else {
                initialMarriagePositions.set(node.id, {
                    x: dagreNode.x,
                    y: dagreNode.y,
                    size: MARRIAGE_SIZE
                });
            }
        });

        // Calculate adaptive Y offsets based on marriage count per generation
        const BASE_SPACING_PER_MARRIAGE = 25; // Additional spacing per marriage
        const generationYOffsets = new Map();
        let cumulativeOffset = 0;

        // Sort generations to process them in order
        const sortedGens = Array.from(marriagesPerGeneration.keys()).sort((a, b) => a - b);
        generationYOffsets.set(0, 0); // First generation has no offset

        sortedGens.forEach(gen => {
            const marriageCount = marriagesPerGeneration.get(gen) || 0;
            const additionalSpacing = marriageCount * BASE_SPACING_PER_MARRIAGE;
            cumulativeOffset += additionalSpacing;
            generationYOffsets.set(gen + 1, cumulativeOffset); // Offset applies to next generation
            console.log(`  Gen ${gen}: ${marriageCount} marriages → +${additionalSpacing}px spacing to Gen ${gen + 1} (cumulative: ${cumulativeOffset}px)`);
        });

        // Second pass: Apply custom positions and adaptive spacing
        initialPositions.forEach((pos, nodeId) => {
            const gen = pos.generation || 0;
            const yOffset = generationYOffsets.get(gen) || 0;

            // Check if we have a custom dragged position (only X changes, Y stays with generation)
            const customPos = nodePositions.get(nodeId);
            if (customPos) {
                positions.set(nodeId, {
                    x: customPos.x,
                    y: pos.y + yOffset,
                    width: CARD_WIDTH,
                    height: CARD_HEIGHT
                });
            } else {
                positions.set(nodeId, {
                    x: pos.x,
                    y: pos.y + yOffset,
                    width: CARD_WIDTH,
                    height: CARD_HEIGHT
                });
            }
        });

        // Apply same offsets to marriage nodes based on their parent's generation
        // and center them between their two parents
        initialMarriagePositions.forEach((pos, nodeId) => {
            // Extract marriage index from nodeId (format: "marriage-{idx}")
            const idx = parseInt(nodeId.split('-')[1]);
            const marriage = treeData.mariages[idx];
            if (marriage && marriage.length >= 2) {
                const parentGen = generationData.personGeneration.get(marriage[0]) || 0;
                const yOffset = generationYOffsets.get(parentGen) || 0;

                // Get parent positions to center the marriage node
                const parent1Pos = positions.get(marriage[0]);
                const parent2Pos = positions.get(marriage[1]);

                let xPos = pos.x; // Default to Dagre position
                if (parent1Pos && parent2Pos) {
                    // Center between the two parents
                    const parent1CenterX = parent1Pos.x + CARD_WIDTH / 2;
                    const parent2CenterX = parent2Pos.x + CARD_WIDTH / 2;
                    xPos = (parent1CenterX + parent2CenterX) / 2;
                }

                // Check if we have a custom dragged position from state
                const customPos = marriageNodePositions.get(nodeId);
                if (customPos) {
                    xPos = customPos.x;
                }

                calculatedMarriageNodePositions.set(nodeId, {
                    x: xPos,
                    y: pos.y + yOffset,
                    size: MARRIAGE_SIZE
                });
            } else {
                calculatedMarriageNodePositions.set(nodeId, pos);
            }
        });

        // Now adjust marriage node positions for stacked marriages
        // Group marriages by person to detect multiple marriages
        const personMarriages = new Map();
        treeData.mariages.forEach((marriage, idx) => {
            if (marriage.length < 2) return;
            const [parent1, parent2] = marriage;

            if (!personMarriages.has(parent1)) personMarriages.set(parent1, []);
            if (!personMarriages.has(parent2)) personMarriages.set(parent2, []);

            personMarriages.get(parent1).push({ idx, spouse: parent2, marriageId: `marriage-${idx}` });
            personMarriages.get(parent2).push({ idx, spouse: parent1, marriageId: `marriage-${idx}` });
        });

        // Adjust marriage node Y positions for people with multiple marriages
        const MARRIAGE_STACK_OFFSET = 40; // Distance between stacked marriages
        const MARRIAGE_BASE_OFFSET = 60; // Initial distance below person
        const adjustedMarriages = new Set(); // Track which marriages we've already adjusted

        personMarriages.forEach((marriages, personId) => {
            if (marriages.length > 1) {
                // Sort marriages to ensure consistent ordering
                marriages.sort((a, b) => a.idx - b.idx);

                marriages.forEach((marriage, stackIndex) => {
                    // Only adjust each marriage node once
                    if (!adjustedMarriages.has(marriage.marriageId)) {
                        const marriagePos = calculatedMarriageNodePositions.get(marriage.marriageId);

                        if (marriagePos) {
                            const personPos = positions.get(personId);
                            if (personPos) {
                                // Stack marriages vertically below the person
                                const offset = MARRIAGE_BASE_OFFSET + (stackIndex * MARRIAGE_STACK_OFFSET);
                                marriagePos.y = personPos.y + CARD_HEIGHT + offset;
                                adjustedMarriages.add(marriage.marriageId);
                            }
                        }
                    }
                });
            }
        });

        return {
            positions,
            marriageNodePositions: calculatedMarriageNodePositions,
            CARD_WIDTH,
            CARD_HEIGHT,
            MARRIAGE_SIZE,
            marriagesPerGeneration
        };
    }, [generationData, treeData, nodePositions, marriageNodePositions]);

    // STEP 3: Generate connection lines using orthogonal (right angle) routing
    const connectionLines = useMemo(() => {
        const lines = [];
        const { positions, marriageNodePositions, CARD_WIDTH, CARD_HEIGHT } = layout;

        // First, build a map of marriages per person to determine connection point offsets
        const personMarriagesMap = new Map();
        treeData.mariages.forEach((marriage, idx) => {
            if (marriage.length < 2) return;
            const [parent1, parent2] = marriage;

            if (!personMarriagesMap.has(parent1)) personMarriagesMap.set(parent1, []);
            if (!personMarriagesMap.has(parent2)) personMarriagesMap.set(parent2, []);

            personMarriagesMap.get(parent1).push({ idx, spouse: parent2 });
            personMarriagesMap.get(parent2).push({ idx, spouse: parent1 });
        });

        // Sort marriages for each person to ensure consistent ordering
        personMarriagesMap.forEach((marriages, personId) => {
            marriages.sort((a, b) => a.idx - b.idx);
        });

        // Helper function to calculate connection point offset
        const getConnectionOffset = (personId, marriageIdx) => {
            const marriages = personMarriagesMap.get(personId) || [];
            const totalMarriages = marriages.length;

            if (totalMarriages === 0) return 0.5; // Center (shouldn't happen)
            if (totalMarriages === 1) return 0.5; // Center

            // Find which index this marriage is for this person
            const marriageIndex = marriages.findIndex(m => m.idx === marriageIdx);
            if (marriageIndex === -1) return 0.5; // Fallback to center

            // Calculate offset based on position
            // For n marriages, use positions: 1/(n+1), 2/(n+1), 3/(n+1), ..., n/(n+1)
            return (marriageIndex + 1) / (totalMarriages + 1);
        };

        treeData.mariages.forEach((marriage, marriageIdx) => {
            if (marriage.length < 2) return;

            const [parent1Id, parent2Id, ...childrenIds] = marriage;
            const p1Pos = positions.get(parent1Id);
            const p2Pos = positions.get(parent2Id);
            const marriageNodeId = `marriage-${marriageIdx}`;
            const marriageNodePos = marriageNodePositions.get(marriageNodeId);

            if (!p1Pos || !p2Pos || !marriageNodePos) return;

            // Calculate connection offsets for each parent
            const p1Offset = getConnectionOffset(parent1Id, marriageIdx);
            const p2Offset = getConnectionOffset(parent2Id, marriageIdx);

            // Calculate connection points with offsets
            const p1ConnectX = p1Pos.x + (CARD_WIDTH * p1Offset);
            const p1BottomY = p1Pos.y + CARD_HEIGHT;
            const p2ConnectX = p2Pos.x + (CARD_WIDTH * p2Offset);
            const p2BottomY = p2Pos.y + CARD_HEIGHT;

            // Determine which parent is on the left and which is on the right
            const p1CenterX = p1Pos.x + CARD_WIDTH / 2;
            const p2CenterX = p2Pos.x + CARD_WIDTH / 2;

            const leftParent = p1CenterX < p2CenterX ?
                { id: parent1Id, x: p1ConnectX, y: p1BottomY } :
                { id: parent2Id, x: p2ConnectX, y: p2BottomY };
            const rightParent = p1CenterX < p2CenterX ?
                { id: parent2Id, x: p2ConnectX, y: p2BottomY } :
                { id: parent1Id, x: p1ConnectX, y: p1BottomY };

            // Check if this marriage involves the selected person
            const isMarriageHighlighted = selectedPerson && (parent1Id === selectedPerson || parent2Id === selectedPerson);

            // Connect from bottom of left parent to center of marriage circle node
            lines.push({
                key: `left-parent-to-marriage-${marriageIdx}`,
                path: `M ${leftParent.x} ${leftParent.y} L ${leftParent.x} ${marriageNodePos.y} L ${marriageNodePos.x} ${marriageNodePos.y}`,
                type: 'marriage',
                highlighted: isMarriageHighlighted,
                relatedPeople: [parent1Id, parent2Id]
            });

            // Connect from bottom of right parent to center of marriage circle node
            lines.push({
                key: `right-parent-to-marriage-${marriageIdx}`,
                path: `M ${rightParent.x} ${rightParent.y} L ${rightParent.x} ${marriageNodePos.y} L ${marriageNodePos.x} ${marriageNodePos.y}`,
                type: 'marriage',
                highlighted: isMarriageHighlighted,
                relatedPeople: [parent1Id, parent2Id]
            });

            // Lines from marriage node to children (from bottom of marriage node to top of child)
            childrenIds.forEach((childId, childIdx) => {
                const childPos = positions.get(childId);
                if (!childPos) return;

                const childCenterX = childPos.x + CARD_WIDTH / 2;
                const childTopY = childPos.y;

                // Down from marriage node, then across to child, then up to child
                const intermediateY = (marriageNodePos.y + childTopY) / 2;

                // Check if this parent-child relationship involves the selected person
                const isParentChildHighlighted = selectedPerson &&
                    (parent1Id === selectedPerson || parent2Id === selectedPerson || childId === selectedPerson);

                lines.push({
                    key: `marriage-to-child-${marriageIdx}-${childIdx}`,
                    path: `M ${marriageNodePos.x} ${marriageNodePos.y} L ${marriageNodePos.x} ${intermediateY} L ${childCenterX} ${intermediateY} L ${childCenterX} ${childTopY}`,
                    type: 'parent',
                    highlighted: isParentChildHighlighted,
                    relatedPeople: [parent1Id, parent2Id, childId]
                });
            });
        });

        console.log(`✅ Generated ${lines.length} connection lines`);
        return lines;
    }, [layout, treeData, selectedPerson]);

    // Marriage nodes for rendering
    const marriageNodes = useMemo(() => {
        const nodes = [];
        const { marriageNodePositions } = layout;

        marriageNodePositions.forEach((pos, nodeId) => {
            nodes.push({
                id: nodeId,
                x: pos.x,
                y: pos.y,
                size: pos.size
            });
        });

        return nodes;
    }, [layout]);

    // Pan and zoom handlers
    const handleWheel = useCallback((e) => {
        e.preventDefault();

        if (!containerRef.current || !viewTransform) return;

        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.min(Math.max(0.1, viewTransform.scale * delta), 3);

        // Get cursor position relative to the container
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Calculate the point in the canvas that's under the cursor
        const canvasX = (mouseX - viewTransform.x) / viewTransform.scale;
        const canvasY = (mouseY - viewTransform.y) / viewTransform.scale;

        // Calculate new position to keep the same point under the cursor
        const newX = mouseX - canvasX * newScale;
        const newY = mouseY - canvasY * newScale;

        setViewTransform({ x: newX, y: newY, scale: newScale });
    }, [viewTransform]);

    const handleMouseDown = useCallback((e) => {
        // Check if clicking on a marriage node for node dragging
        const marriageNode = e.target.closest('.gen-marriage-node');
        if (marriageNode) {
            const marriageNodeId = marriageNode.getAttribute('data-marriage-id');
            if (marriageNodeId) {
                setDraggingNode(marriageNodeId);
                const pos = layout.marriageNodePositions.get(marriageNodeId);
                if (pos) {
                    // Store the offset from the node's center to the click point
                    const canvasRect = containerRef.current.getBoundingClientRect();
                    const clickX = (e.clientX - canvasRect.left - viewTransform.x) / viewTransform.scale;
                    setNodeDragStart({
                        x: clickX - pos.x,
                        y: 0
                    });
                }
                e.stopPropagation();
                return;
            }
        }

        // Check if clicking on a person card for node dragging
        const personCard = e.target.closest('.gen-person-card');
        if (personCard) {
            const personId = personCard.getAttribute('data-person-id');
            if (personId) {
                setDraggingNode(personId);
                const pos = layout.positions.get(personId);
                if (pos) {
                    // Store the offset from the card's top-left to the click point
                    const rect = personCard.getBoundingClientRect();
                    const canvasRect = containerRef.current.getBoundingClientRect();
                    const clickX = (e.clientX - canvasRect.left - viewTransform.x) / viewTransform.scale;
                    const clickY = (e.clientY - canvasRect.top - viewTransform.y) / viewTransform.scale;
                    setNodeDragStart({
                        x: clickX - pos.x,
                        y: clickY - pos.y
                    });
                }
                e.stopPropagation();
                return;
            }
        }

        // Otherwise, start canvas panning
        setIsDragging(true);
        setDragStart({
            x: e.clientX - viewTransform.x,
            y: e.clientY - viewTransform.y
        });
    }, [viewTransform, layout]);

    const handleMouseMove = useCallback((e) => {
        if (draggingNode) {
            // Dragging a node - horizontal only
            const canvasRect = containerRef.current.getBoundingClientRect();
            const mouseX = (e.clientX - canvasRect.left - viewTransform.x) / viewTransform.scale;

            // Calculate new X position only (constrain to horizontal movement)
            let newX = mouseX - nodeDragStart.x;

            // Snap to 20px grid
            const GRID_SIZE = 20;
            newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;

            // Check if dragging a person node or marriage node
            if (draggingNode.startsWith('marriage-')) {
                // Dragging a marriage node
                const currentPos = layout.marriageNodePositions.get(draggingNode);
                if (currentPos) {
                    // Update marriage node position (X only, keep original Y)
                    setMarriageNodePositions(prev => {
                        const newPositions = new Map(prev);
                        newPositions.set(draggingNode, { x: newX, y: currentPos.y });
                        return newPositions;
                    });
                }
            } else {
                // Dragging a person node
                const currentPos = layout.positions.get(draggingNode);
                if (currentPos) {
                    // Update node position (X only, keep original Y)
                    setNodePositions(prev => {
                        const newPositions = new Map(prev);
                        newPositions.set(draggingNode, { x: newX, y: currentPos.y });
                        return newPositions;
                    });
                }
            }
        } else if (isDragging) {
            // Panning the canvas - support both X and Y directions
            setViewTransform(prev => ({
                ...prev,
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            }));
        }
    }, [isDragging, draggingNode, dragStart, nodeDragStart, viewTransform, layout]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        setDraggingNode(null);
    }, []);

    // Calculate zoom-to-fit
    const zoomToFit = useCallback(() => {
        if (!containerRef.current) return;

        const { positions, marriageNodePositions } = layout;
        if (positions.size === 0) return;

        // Get bounds of all cards
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        positions.forEach(pos => {
            minX = Math.min(minX, pos.x);
            maxX = Math.max(maxX, pos.x + pos.width);
            minY = Math.min(minY, pos.y);
            maxY = Math.max(maxY, pos.y + pos.height);
        });

        marriageNodePositions.forEach(pos => {
            const halfSize = pos.size / 2;
            minX = Math.min(minX, pos.x - halfSize);
            maxX = Math.max(maxX, pos.x + halfSize);
            minY = Math.min(minY, pos.y - halfSize);
            maxY = Math.max(maxY, pos.y + halfSize);
        });

        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;

        // Get container dimensions
        const containerRect = containerRef.current.getBoundingClientRect();
        const viewportWidth = containerRect.width;
        const viewportHeight = containerRect.height;

        // Calculate scale to fit with padding
        const padding = 100;
        const scaleX = (viewportWidth - padding * 2) / contentWidth;
        const scaleY = (viewportHeight - padding * 2) / contentHeight;
        const scale = Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 100%

        // Calculate center offset
        const x = (viewportWidth - contentWidth * scale) / 2 - minX * scale;
        const y = (viewportHeight - contentHeight * scale) / 2 - minY * scale;

        setViewTransform({ x, y, scale });
    }, [layout]);

    const resetView = useCallback(() => {
        zoomToFit();
    }, [zoomToFit]);

    // Auto zoom-to-fit on initial load only (not when dragging nodes)
    useEffect(() => {
        if (layout.positions.size > 0 && containerRef.current && !initialZoomSet) {
            // Only auto zoom-to-fit on initial load, not when nodes are dragged
            const { positions, marriageNodePositions } = layout;

            // Get bounds of all cards
            let minX = Infinity, maxX = -Infinity;
            let minY = Infinity, maxY = -Infinity;

            positions.forEach(pos => {
                minX = Math.min(minX, pos.x);
                maxX = Math.max(maxX, pos.x + pos.width);
                minY = Math.min(minY, pos.y);
                maxY = Math.max(maxY, pos.y + pos.height);
            });

            marriageNodePositions.forEach(pos => {
                const halfSize = pos.size / 2;
                minX = Math.min(minX, pos.x - halfSize);
                maxX = Math.max(maxX, pos.x + halfSize);
                minY = Math.min(minY, pos.y - halfSize);
                maxY = Math.max(maxY, pos.y + halfSize);
            });

            const contentWidth = maxX - minX;
            const contentHeight = maxY - minY;

            // Get container dimensions
            const containerRect = containerRef.current.getBoundingClientRect();
            const viewportWidth = containerRect.width;
            const viewportHeight = containerRect.height;

            // Calculate scale to fit with padding
            const padding = 100;
            const scaleX = (viewportWidth - padding * 2) / contentWidth;
            const scaleY = (viewportHeight - padding * 2) / contentHeight;
            const scale = Math.min(scaleX, scaleY, 1);

            // Calculate center offset
            const x = (viewportWidth - contentWidth * scale) / 2 - minX * scale;
            const y = (viewportHeight - contentHeight * scale) / 2 - minY * scale;

            setViewTransform({ x, y, scale });
            setInitialZoomSet(true);
        }
    }, [layout, initialZoomSet]);

    const getInitials = (name) => {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-AU', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    return (
        <div
            className="generational-view-container"
            ref={containerRef}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ cursor: draggingNode ? 'grabbing' : (isDragging ? 'grabbing' : 'grab') }}
        >
            {/* Zoom controls */}
            <div className="gen-view-controls">
                <button className="gen-control-btn" onClick={resetView} title="Fit to screen">⛶</button>
            </div>

            {/* Canvas with transform */}
            {viewTransform && (
                <div
                    className="generational-view-canvas"
                    style={{
                        transform: `translate(${viewTransform.x}px, ${viewTransform.y}px) scale(${viewTransform.scale})`,
                        transformOrigin: '0 0'
                    }}
                >
                {/* SVG overlay for lines */}
                <svg className="gen-tree-lines" style={{ overflow: 'visible' }}>
                    {connectionLines.map(line => (
                        <path
                            key={line.key}
                            d={line.path}
                            className={`gen-path gen-path-${line.type} ${line.highlighted ? 'gen-path-highlighted' : ''}`}
                            fill="none"
                        />
                    ))}
                </svg>

                {/* Marriage nodes (small circles like Web Mode) */}
                {marriageNodes.map(node => (
                    <div
                        key={node.id}
                        data-marriage-id={node.id}
                        className="gen-marriage-node"
                        style={{
                            position: 'absolute',
                            left: `${node.x - node.size / 2}px`,
                            top: `${node.y - node.size / 2}px`,
                            width: `${node.size}px`,
                            height: `${node.size}px`,
                            cursor: 'grab'
                        }}
                    />
                ))}

                {/* Render person cards */}
                {generationData.sortedGenerations.map(([genNum, people]) =>
                    people.map(personId => {
                        const person = treeData.people[personId];
                        const pos = layout.positions.get(personId);

                        if (!person || !pos) return null;

                        const birthEvent = person.events?.find(e => e.type === '$_BIRTH');
                        const deathEvent = person.events?.find(e => e.type === '$_DEATH');
                        const isDeceased = !!deathEvent;
                        const avatarClass = person.gender === 'MALE' ? 'avatar-male' :
                                          person.gender === 'FEMALE' ? 'avatar-female' : 'avatar-other';

                        // Calculate relationship to home person
                        const isHomePerson = treeData.homePerson === personId;
                        const relationship = treeData.homePerson && treeData.homePerson !== personId && window.calculateRelationship
                            ? window.calculateRelationship(treeData.homePerson, personId, treeData)
                            : null;

                        return (
                            <div
                                key={personId}
                                data-person-id={personId}
                                className={`gen-person-card ${selectedPerson === personId ? 'selected' : ''} ${isDeceased ? 'deceased' : ''}`}
                                style={{
                                    position: 'absolute',
                                    left: `${pos.x}px`,
                                    top: `${pos.y}px`,
                                    width: `${pos.width}px`
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectPerson(personId);
                                }}
                            >
                                <div className={`node-avatar ${avatarClass}`}>
                                    {getInitials(person.name)}
                                </div>
                                <div className="node-name">
                                    {person.name}
                                    {isHomePerson && (
                                        <span style={{marginLeft: '6px', fontSize: '0.85em'}} title="Home Person">
                                            🏠
                                        </span>
                                    )}
                                </div>
                                <div className="node-surname">
                                    {person.surname}
                                    {person.maidenName && ` (née ${person.maidenName})`}
                                </div>
                                {relationship && (
                                    <div style={{
                                        fontSize: '0.75rem',
                                        color: 'var(--primary)',
                                        fontWeight: '500',
                                        marginTop: '4px'
                                    }}>
                                        {relationship}
                                    </div>
                                )}
                                <div className="node-dates">
                                    {birthEvent?.dateStart && formatDate(birthEvent.dateStart)}
                                    {birthEvent?.dateStart && deathEvent?.dateStart && ' — '}
                                    {deathEvent?.dateStart && formatDate(deathEvent.dateStart)}
                                </div>
                            </div>
                        );
                    })
                )}

                {generationData.sortedGenerations.length === 0 && (
                    <div className="empty-state" style={{ position: 'absolute', top: 200, left: 200 }}>
                        <div className="empty-icon">👥</div>
                        <h3 className="empty-title">No Family Members Yet</h3>
                        <p className="empty-text">
                            Add family members and relationships to see the generational tree view.
                        </p>
                    </div>
                )}
            </div>
            )}
        </div>
    );
};

window.GenerationalView = GenerationalView;
console.log('✅ GenerationalView component loaded');
