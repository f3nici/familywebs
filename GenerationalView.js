const GenerationalView = ({ treeData, selectedPerson, onSelectPerson, getGenerationalViewStateRef }) => {
    const { useMemo, useRef, useState, useCallback, useEffect } = React;
    const containerRef = useRef(null);

    const initialViewState = useMemo(() => {
        const savedState = treeData.viewState?.generationalView;
        if (!savedState) return { viewTransform: null, nodePositions: new Map(), marriageNodePositions: new Map() };

        const nodePositionsMap = new Map();
        if (savedState.nodePositions) {
            savedState.nodePositions.forEach(({ id, x, y }) => {
                nodePositionsMap.set(id, { x, y });
            });
        }

        const marriageNodePositionsMap = new Map();
        if (savedState.marriageNodePositions) {
            savedState.marriageNodePositions.forEach(({ id, x, y }) => {
                marriageNodePositionsMap.set(id, { x, y });
            });
        }

        return {
            viewTransform: savedState.viewTransform || null,
            nodePositions: nodePositionsMap,
            marriageNodePositions: marriageNodePositionsMap
        };
    }, []);

    const [viewTransform, setViewTransform] = useState(initialViewState.viewTransform);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [initialZoomSet, setInitialZoomSet] = useState(!!initialViewState.viewTransform);
    const [draggingNode, setDraggingNode] = useState(null);
    const [nodeDragStart, setNodeDragStart] = useState({ x: 0, y: 0 });
    const [nodePositions, setNodePositions] = useState(initialViewState.nodePositions);
    const [marriageNodePositions, setMarriageNodePositions] = useState(initialViewState.marriageNodePositions);
    const [lastTouchDistance, setLastTouchDistance] = useState(null);
    const [touchStart, setTouchStart] = useState(null);
    const [isLocked, setIsLocked] = useState(true);

    useEffect(() => {
        if (getGenerationalViewStateRef) {
            getGenerationalViewStateRef.current = () => {
                const nodePositionsArray = Array.from(nodePositions.entries()).map(([id, pos]) => ({
                    id,
                    x: pos.x,
                    y: pos.y
                }));

                const marriageNodePositionsArray = Array.from(marriageNodePositions.entries()).map(([id, pos]) => ({
                    id,
                    x: pos.x,
                    y: pos.y
                }));

                return {
                    viewTransform: viewTransform,
                    nodePositions: nodePositionsArray,
                    marriageNodePositions: marriageNodePositionsArray
                };
            };
        }
    }, [viewTransform, nodePositions, marriageNodePositions, getGenerationalViewStateRef]);

    const generationData = useMemo(() => {
        const allPeople = Object.keys(treeData.people);
        const personGeneration = new Map();

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
        });

        const rootPeople = allPeople.filter(id => !childToParents.has(id));

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

        return {
            sortedGenerations,
            personGeneration,
            childToParents,
            personToSpouses
        };
    }, [treeData]);

    const layout = useMemo(() => {
        const CARD_WIDTH = 200;
        const CARD_HEIGHT = 150;
        const MARRIAGE_SIZE = 20;

        const marriagesPerGeneration = new Map();
        treeData.mariages.forEach((marriage, idx) => {
            if (marriage.length < 2) return;
            const [parent1, parent2] = marriage;
            const gen = generationData.personGeneration.get(parent1);
            if (gen !== undefined) {
                marriagesPerGeneration.set(gen, (marriagesPerGeneration.get(gen) || 0) + 1);
            }
        });

        const dagreGraph = new dagre.graphlib.Graph();
        dagreGraph.setDefaultEdgeLabel(() => ({}));
        dagreGraph.setGraph({
            rankdir: 'TB',
            nodesep: 80,
            ranksep: 120
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

        const BASE_SPACING_PER_MARRIAGE = 25;
        const generationYOffsets = new Map();
        let cumulativeOffset = 0;

        const sortedGens = Array.from(marriagesPerGeneration.keys()).sort((a, b) => a - b);
        generationYOffsets.set(0, 0);

        sortedGens.forEach(gen => {
            const marriageCount = marriagesPerGeneration.get(gen) || 0;
            const additionalSpacing = marriageCount * BASE_SPACING_PER_MARRIAGE;
            cumulativeOffset += additionalSpacing;
            generationYOffsets.set(gen + 1, cumulativeOffset);
        });

        initialPositions.forEach((pos, nodeId) => {
            const gen = pos.generation || 0;
            const yOffset = generationYOffsets.get(gen) || 0;

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

        initialMarriagePositions.forEach((pos, nodeId) => {
            const idx = parseInt(nodeId.split('-')[1]);
            const marriage = treeData.mariages[idx];
            if (marriage && marriage.length >= 2) {
                const parentGen = generationData.personGeneration.get(marriage[0]) || 0;
                const yOffset = generationYOffsets.get(parentGen) || 0;

                const parent1Pos = positions.get(marriage[0]);
                const parent2Pos = positions.get(marriage[1]);

                let xPos = pos.x;
                let yPos = pos.y + yOffset;

                if (parent1Pos && parent2Pos) {
                    const parent1CenterX = parent1Pos.x + CARD_WIDTH / 2;
                    const parent2CenterX = parent2Pos.x + CARD_WIDTH / 2;
                    xPos = (parent1CenterX + parent2CenterX) / 2;
                }

                const customPos = marriageNodePositions.get(nodeId);
                if (customPos) {
                    xPos = customPos.x;
                    yPos = customPos.y;
                }

                calculatedMarriageNodePositions.set(nodeId, {
                    x: xPos,
                    y: yPos,
                    size: MARRIAGE_SIZE
                });
            } else {
                calculatedMarriageNodePositions.set(nodeId, pos);
            }
        });

        const personMarriages = new Map();
        treeData.mariages.forEach((marriage, idx) => {
            if (marriage.length < 2) return;
            const [parent1, parent2] = marriage;

            if (!personMarriages.has(parent1)) personMarriages.set(parent1, []);
            if (!personMarriages.has(parent2)) personMarriages.set(parent2, []);

            personMarriages.get(parent1).push({ idx, spouse: parent2, marriageId: `marriage-${idx}` });
            personMarriages.get(parent2).push({ idx, spouse: parent1, marriageId: `marriage-${idx}` });
        });

        const MARRIAGE_STACK_OFFSET = 40;
        const MARRIAGE_BASE_OFFSET = 60;
        const adjustedMarriages = new Set();

        personMarriages.forEach((marriages, personId) => {
            if (marriages.length > 1) {
                marriages.sort((a, b) => a.idx - b.idx);

                marriages.forEach((marriage, stackIndex) => {
                    if (!adjustedMarriages.has(marriage.marriageId)) {
                        // Skip auto-adjustment if there's a custom position
                        const hasCustomPosition = marriageNodePositions.has(marriage.marriageId);
                        if (!hasCustomPosition) {
                            const marriagePos = calculatedMarriageNodePositions.get(marriage.marriageId);

                            if (marriagePos) {
                                const personPos = positions.get(personId);
                                if (personPos) {
                                    const offset = MARRIAGE_BASE_OFFSET + (stackIndex * MARRIAGE_STACK_OFFSET);
                                    marriagePos.y = personPos.y + CARD_HEIGHT + offset;
                                    adjustedMarriages.add(marriage.marriageId);
                                }
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

    const connectionLines = useMemo(() => {
        const lines = [];
        const { positions, marriageNodePositions, CARD_WIDTH, CARD_HEIGHT } = layout;

        const personMarriagesMap = new Map();
        treeData.mariages.forEach((marriage, idx) => {
            if (marriage.length < 2) return;
            const [parent1, parent2] = marriage;

            if (!personMarriagesMap.has(parent1)) personMarriagesMap.set(parent1, []);
            if (!personMarriagesMap.has(parent2)) personMarriagesMap.set(parent2, []);

            personMarriagesMap.get(parent1).push({ idx, spouse: parent2 });
            personMarriagesMap.get(parent2).push({ idx, spouse: parent1 });
        });

        personMarriagesMap.forEach((marriages, personId) => {
            marriages.sort((a, b) => a.idx - b.idx);
        });

        const getConnectionOffset = (personId, marriageIdx) => {
            const marriages = personMarriagesMap.get(personId) || [];
            const totalMarriages = marriages.length;

            if (totalMarriages === 0) return 0.5;
            if (totalMarriages === 1) return 0.5;

            const marriageIndex = marriages.findIndex(m => m.idx === marriageIdx);
            if (marriageIndex === -1) return 0.5;

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

            const p1Offset = getConnectionOffset(parent1Id, marriageIdx);
            const p2Offset = getConnectionOffset(parent2Id, marriageIdx);

            const p1ConnectX = p1Pos.x + (CARD_WIDTH * p1Offset);
            const p1BottomY = p1Pos.y + CARD_HEIGHT;
            const p2ConnectX = p2Pos.x + (CARD_WIDTH * p2Offset);
            const p2BottomY = p2Pos.y + CARD_HEIGHT;

            const p1CenterX = p1Pos.x + CARD_WIDTH / 2;
            const p2CenterX = p2Pos.x + CARD_WIDTH / 2;

            const leftParent = p1CenterX < p2CenterX ?
                { id: parent1Id, x: p1ConnectX, y: p1BottomY } :
                { id: parent2Id, x: p2ConnectX, y: p2BottomY };
            const rightParent = p1CenterX < p2CenterX ?
                { id: parent2Id, x: p2ConnectX, y: p2BottomY } :
                { id: parent1Id, x: p1ConnectX, y: p1BottomY };

            const isMarriageHighlighted = selectedPerson && (parent1Id === selectedPerson || parent2Id === selectedPerson);

            lines.push({
                key: `left-parent-to-marriage-${marriageIdx}`,
                path: `M ${leftParent.x} ${leftParent.y} L ${leftParent.x} ${marriageNodePos.y} L ${marriageNodePos.x} ${marriageNodePos.y}`,
                type: 'marriage',
                highlighted: isMarriageHighlighted,
                relatedPeople: [parent1Id, parent2Id]
            });

            lines.push({
                key: `right-parent-to-marriage-${marriageIdx}`,
                path: `M ${rightParent.x} ${rightParent.y} L ${rightParent.x} ${marriageNodePos.y} L ${marriageNodePos.x} ${marriageNodePos.y}`,
                type: 'marriage',
                highlighted: isMarriageHighlighted,
                relatedPeople: [parent1Id, parent2Id]
            });

            childrenIds.forEach((childId, childIdx) => {
                const childPos = positions.get(childId);
                if (!childPos) return;

                const childCenterX = childPos.x + CARD_WIDTH / 2;
                const childTopY = childPos.y;

                const intermediateY = (marriageNodePos.y + childTopY) / 2;

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

        return lines;
    }, [layout, treeData, selectedPerson]);

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

    const handleWheel = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!containerRef.current || !viewTransform) return;

        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.min(Math.max(0.1, viewTransform.scale * delta), 3);

        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const canvasX = (mouseX - viewTransform.x) / viewTransform.scale;
        const canvasY = (mouseY - viewTransform.y) / viewTransform.scale;

        const newX = mouseX - canvasX * newScale;
        const newY = mouseY - canvasY * newScale;

        setViewTransform({ x: newX, y: newY, scale: newScale });
    }, [viewTransform]);

    const handleMouseDown = useCallback((e) => {
        const marriageNode = e.target.closest('.gen-marriage-node');
        if (marriageNode) {
            if (isLocked) return; // Don't allow node dragging when locked
            const marriageNodeId = marriageNode.getAttribute('data-marriage-id');
            if (marriageNodeId) {
                setDraggingNode(marriageNodeId);
                const pos = layout.marriageNodePositions.get(marriageNodeId);
                if (pos) {
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

        const personCard = e.target.closest('.gen-person-card');
        if (personCard) {
            if (isLocked) return; // Don't allow node dragging when locked
            const personId = personCard.getAttribute('data-person-id');
            if (personId) {
                setDraggingNode(personId);
                const pos = layout.positions.get(personId);
                if (pos) {
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

        // Always allow panning, even when locked
        setIsDragging(true);
        setDragStart({
            x: e.clientX - viewTransform.x,
            y: e.clientY - viewTransform.y
        });
    }, [viewTransform, layout, isLocked]);

    const handleMouseMove = useCallback((e) => {
        if (draggingNode) {
            const canvasRect = containerRef.current.getBoundingClientRect();
            const mouseX = (e.clientX - canvasRect.left - viewTransform.x) / viewTransform.scale;
            const mouseY = (e.clientY - canvasRect.top - viewTransform.y) / viewTransform.scale;

            let newX = mouseX - nodeDragStart.x;
            let newY = mouseY - nodeDragStart.y;

            const GRID_SIZE_X = 20;
            const GRID_SIZE_Y = 40;
            newX = Math.round(newX / GRID_SIZE_X) * GRID_SIZE_X;
            newY = Math.round(newY / GRID_SIZE_Y) * GRID_SIZE_Y;

            if (draggingNode.startsWith('marriage-')) {
                setMarriageNodePositions(prev => {
                    const newPositions = new Map(prev);
                    newPositions.set(draggingNode, { x: newX, y: newY });
                    return newPositions;
                });
            } else {
                const currentPos = layout.positions.get(draggingNode);
                if (currentPos) {
                    setNodePositions(prev => {
                        const newPositions = new Map(prev);
                        newPositions.set(draggingNode, { x: newX, y: currentPos.y });
                        return newPositions;
                    });
                }
            }
        } else if (isDragging) {
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

    const getTouchDistance = (touch1, touch2) => {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    const getTouchCenter = (touch1, touch2) => {
        return {
            x: (touch1.clientX + touch2.clientX) / 2,
            y: (touch1.clientY + touch2.clientY) / 2
        };
    };

    const handleTouchStart = useCallback((e) => {
        if (e.touches.length === 2) {
            // Pinch zoom start - always allow
            e.preventDefault();
            e.stopPropagation();
            const distance = getTouchDistance(e.touches[0], e.touches[1]);
            setLastTouchDistance(distance);
        } else if (e.touches.length === 1) {
            // Single touch - check if it's on a node
            const touch = e.touches[0];
            const target = document.elementFromPoint(touch.clientX, touch.clientY);

            const marriageNode = target?.closest('.gen-marriage-node');
            if (marriageNode) {
                if (isLocked) return; // Don't allow node dragging when locked
                const marriageNodeId = marriageNode.getAttribute('data-marriage-id');
                if (marriageNodeId) {
                    setDraggingNode(marriageNodeId);
                    const pos = layout.marriageNodePositions.get(marriageNodeId);
                    if (pos && containerRef.current) {
                        const canvasRect = containerRef.current.getBoundingClientRect();
                        const touchX = (touch.clientX - canvasRect.left - viewTransform.x) / viewTransform.scale;
                        const touchY = (touch.clientY - canvasRect.top - viewTransform.y) / viewTransform.scale;
                        setNodeDragStart({
                            x: touchX - pos.x,
                            y: touchY - pos.y
                        });
                    }
                    return;
                }
            }

            const personCard = target?.closest('.gen-person-card');
            if (personCard) {
                if (isLocked) return; // Don't allow node dragging when locked
                const personId = personCard.getAttribute('data-person-id');
                if (personId) {
                    setDraggingNode(personId);
                    const pos = layout.positions.get(personId);
                    if (pos && containerRef.current) {
                        const canvasRect = containerRef.current.getBoundingClientRect();
                        const touchX = (touch.clientX - canvasRect.left - viewTransform.x) / viewTransform.scale;
                        const touchY = (touch.clientY - canvasRect.top - viewTransform.y) / viewTransform.scale;
                        setNodeDragStart({
                            x: touchX - pos.x,
                            y: touchY - pos.y
                        });
                    }
                    return;
                }
            }

            // Pan start - always allow
            setTouchStart({
                x: touch.clientX - viewTransform.x,
                y: touch.clientY - viewTransform.y
            });
        }
    }, [viewTransform, layout, isLocked]);

    const handleTouchMove = useCallback((e) => {
        if (e.touches.length === 2 && lastTouchDistance && viewTransform) {
            // Pinch zoom - always allow
            e.preventDefault();
            e.stopPropagation();
            const distance = getTouchDistance(e.touches[0], e.touches[1]);
            const scale = distance / lastTouchDistance;

            const newScale = Math.min(Math.max(0.1, viewTransform.scale * scale), 3);

            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const center = getTouchCenter(e.touches[0], e.touches[1]);
            const centerX = center.x - rect.left;
            const centerY = center.y - rect.top;

            const canvasX = (centerX - viewTransform.x) / viewTransform.scale;
            const canvasY = (centerY - viewTransform.y) / viewTransform.scale;

            const newX = centerX - canvasX * newScale;
            const newY = centerY - canvasY * newScale;

            setViewTransform({ x: newX, y: newY, scale: newScale });
            setLastTouchDistance(distance);
        } else if (e.touches.length === 1) {
            const touch = e.touches[0];

            if (draggingNode && containerRef.current && !isLocked) {
                // Node dragging - only when not locked
                const canvasRect = containerRef.current.getBoundingClientRect();
                const touchX = (touch.clientX - canvasRect.left - viewTransform.x) / viewTransform.scale;
                const touchY = (touch.clientY - canvasRect.top - viewTransform.y) / viewTransform.scale;

                let newX = touchX - nodeDragStart.x;
                let newY = touchY - nodeDragStart.y;

                const GRID_SIZE_X = 20;
                const GRID_SIZE_Y = 40;
                newX = Math.round(newX / GRID_SIZE_X) * GRID_SIZE_X;
                newY = Math.round(newY / GRID_SIZE_Y) * GRID_SIZE_Y;

                if (draggingNode.startsWith('marriage-')) {
                    setMarriageNodePositions(prev => {
                        const newPositions = new Map(prev);
                        newPositions.set(draggingNode, { x: newX, y: newY });
                        return newPositions;
                    });
                } else {
                    const currentPos = layout.positions.get(draggingNode);
                    if (currentPos) {
                        setNodePositions(prev => {
                            const newPositions = new Map(prev);
                            newPositions.set(draggingNode, { x: newX, y: currentPos.y });
                            return newPositions;
                        });
                    }
                }
            } else if (touchStart) {
                // Pan - always allow
                e.preventDefault();
                setViewTransform(prev => ({
                    ...prev,
                    x: touch.clientX - touchStart.x,
                    y: touch.clientY - touchStart.y
                }));
            }
        }
    }, [lastTouchDistance, viewTransform, draggingNode, touchStart, nodeDragStart, layout, isLocked]);

    const handleTouchEnd = useCallback(() => {
        setLastTouchDistance(null);
        setTouchStart(null);
        setDraggingNode(null);
    }, []);

    const zoomToFit = useCallback(() => {
        if (!containerRef.current) return;

        const { positions, marriageNodePositions } = layout;
        if (positions.size === 0) return;

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

        const containerRect = containerRef.current.getBoundingClientRect();
        const viewportWidth = containerRect.width;
        const viewportHeight = containerRect.height;

        const padding = 100;
        const scaleX = (viewportWidth - padding * 2) / contentWidth;
        const scaleY = (viewportHeight - padding * 2) / contentHeight;
        const scale = Math.min(scaleX, scaleY, 1);

        const x = (viewportWidth - contentWidth * scale) / 2 - minX * scale;
        const y = (viewportHeight - contentHeight * scale) / 2 - minY * scale;

        setViewTransform({ x, y, scale });
    }, [layout]);

    const resetView = useCallback(() => {
        zoomToFit();
    }, [zoomToFit]);

    const recalculateLayout = useCallback(() => {
        setNodePositions(new Map());
        setMarriageNodePositions(new Map());
        // Reset zoom after a short delay to allow layout to recalculate
        setTimeout(() => {
            zoomToFit();
        }, 100);
    }, [zoomToFit]);

    const zoomIn = useCallback(() => {
        if (!viewTransform || !containerRef.current) return;

        const newScale = Math.min(viewTransform.scale * 1.2, 3);
        const rect = containerRef.current.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const canvasX = (centerX - viewTransform.x) / viewTransform.scale;
        const canvasY = (centerY - viewTransform.y) / viewTransform.scale;

        const newX = centerX - canvasX * newScale;
        const newY = centerY - canvasY * newScale;

        setViewTransform({ x: newX, y: newY, scale: newScale });
    }, [viewTransform]);

    const zoomOut = useCallback(() => {
        if (!viewTransform || !containerRef.current) return;

        const newScale = Math.max(viewTransform.scale * 0.8, 0.1);
        const rect = containerRef.current.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const canvasX = (centerX - viewTransform.x) / viewTransform.scale;
        const canvasY = (centerY - viewTransform.y) / viewTransform.scale;

        const newX = centerX - canvasX * newScale;
        const newY = centerY - canvasY * newScale;

        setViewTransform({ x: newX, y: newY, scale: newScale });
    }, [viewTransform]);

    useEffect(() => {
        if (layout.positions.size > 0 && containerRef.current && !initialZoomSet) {
            const { positions, marriageNodePositions } = layout;

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

            const containerRect = containerRef.current.getBoundingClientRect();
            const viewportWidth = containerRect.width;
            const viewportHeight = containerRect.height;

            const padding = 100;
            const scaleX = (viewportWidth - padding * 2) / contentWidth;
            const scaleY = (viewportHeight - padding * 2) / contentHeight;
            const scale = Math.min(scaleX, scaleY, 1);

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
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ cursor: isLocked ? 'default' : (draggingNode ? 'grabbing' : (isDragging ? 'grabbing' : 'grab')), touchAction: 'none' }}
        >
            <div className="gen-view-controls">
                <button className="gen-control-btn" onClick={zoomIn} title="Zoom in">+</button>
                <button className="gen-control-btn" onClick={zoomOut} title="Zoom out">−</button>
                <button className="gen-control-btn" onClick={resetView} title="Fit to screen">⛶</button>
                <button
                    className={`gen-control-btn ${isLocked ? 'active' : ''}`}
                    onClick={() => setIsLocked(!isLocked)}
                    title={isLocked ? "Unlock" : "Lock"}
                >
                    {isLocked ? '🔒' : '🔓'}
                </button>
                <button
                    className="gen-control-btn"
                    onClick={recalculateLayout}
                    title="Recalculate layout (reset all custom positions)"
                >
                    ↻
                </button>
            </div>

            {viewTransform && (
                <div
                    className="generational-view-canvas"
                    style={{
                        transform: `translate(${viewTransform.x}px, ${viewTransform.y}px) scale(${viewTransform.scale})`,
                        transformOrigin: '0 0'
                    }}
                >
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
