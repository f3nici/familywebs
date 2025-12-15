const GenerationalView = ({ treeData, selectedPerson, onSelectPerson, getGenerationalViewStateRef, isMultiSelectMode, selectedNodes, setSelectedNodes }) => {
    const { useMemo, useRef, useState, useCallback, useEffect } = React;
    const containerRef = useRef(null);

    const initialViewState = useMemo(() => {
        const savedState = treeData.viewState?.generationalView;
        if (!savedState) return {
            viewTransform: null,
            nodePositions: new Map(),
            marriageNodePositions: new Map(),
            performanceMode: false // Default to animations on
        };

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
            marriageNodePositions: marriageNodePositionsMap,
            performanceMode: savedState.performanceMode !== undefined ? savedState.performanceMode : false
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
    const [performanceMode, setPerformanceMode] = useState(initialViewState.performanceMode);
    const [selectionRect, setSelectionRect] = useState(null);
    const [selectionStart, setSelectionStart] = useState(null);

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
                    marriageNodePositions: marriageNodePositionsArray,
                    performanceMode: performanceMode
                };
            };
        }
    }, [viewTransform, nodePositions, marriageNodePositions, performanceMode, getGenerationalViewStateRef]);

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

        const generationCache = new Map();
        const visitStack = new Set();

        const resolveGeneration = (personId) => {
            if (generationCache.has(personId)) return generationCache.get(personId);
            if (visitStack.has(personId)) return 0; // Prevent cycles from breaking recursion

            visitStack.add(personId);

            let gen = 0;
            const parents = childToParents.get(personId);
            if (parents) {
                const parentGens = parents.map(resolveGeneration);
                gen = Math.max(...parentGens) + 1;
            }

            visitStack.delete(personId);
            generationCache.set(personId, gen);
            return gen;
        };

        allPeople.forEach(personId => {
            personGeneration.set(personId, resolveGeneration(personId));
        });

        let changed = true;
        let iterations = 0;
        const maxIterations = 100;

        while (changed && iterations < maxIterations) {
            changed = false;
            iterations++;

            treeData.mariages.forEach((marriage) => {
                if (marriage.length < 2) return;
                const [parent1, parent2, ...children] = marriage;

                const p1Gen = personGeneration.get(parent1) ?? 0;
                const p2Gen = personGeneration.get(parent2) ?? 0;

                // Always prioritise spouses sharing the same generation before
                // pushing children downward. When a spouse is raised to match
                // their partner, pull their parents closer so they sit only one
                // generation above the unified couple.
                const unifiedGen = Math.max(p1Gen, p2Gen);

                if (p1Gen !== unifiedGen) {
                    personGeneration.set(parent1, unifiedGen);
                    changed = true;
                }

                if (p2Gen !== unifiedGen) {
                    personGeneration.set(parent2, unifiedGen);
                    changed = true;
                }

                const unifyParentsToCouple = (personId) => {
                    const parents = childToParents.get(personId);
                    if (!parents) return;

                    parents.forEach(parentId => {
                        const currentGen = personGeneration.get(parentId) ?? 0;
                        const targetGen = Math.max(currentGen, Math.max(unifiedGen - 1, 0));
                        if (currentGen !== targetGen) {
                            personGeneration.set(parentId, targetGen);
                            changed = true;
                        }
                    });
                };

                unifyParentsToCouple(parent1);
                unifyParentsToCouple(parent2);

                const childGen = unifiedGen + 1;
                children.forEach(childId => {
                    const currentGen = personGeneration.get(childId) ?? 0;
                    const targetGen = Math.max(currentGen, childGen);
                    if (currentGen !== targetGen) {
                        personGeneration.set(childId, targetGen);
                        changed = true;
                    }
                });
            });
        }

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
        const MARRIAGE_SIZE = 30;

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

        const generationBaseY = new Map();
        initialPositions.forEach(pos => {
            const gen = pos.generation || 0;
            const currentBase = generationBaseY.get(gen);
            if (currentBase === undefined || pos.y < currentBase) {
                generationBaseY.set(gen, pos.y);
            }
        });

        initialPositions.forEach((pos, nodeId) => {
            const gen = pos.generation || 0;
            const yOffset = generationYOffsets.get(gen) || 0;
            const baseY = generationBaseY.get(gen) ?? pos.y;

            const customPos = nodePositions.get(nodeId);
            if (customPos) {
                positions.set(nodeId, {
                    x: customPos.x,
                    y: baseY + yOffset,
                    width: CARD_WIDTH,
                    height: CARD_HEIGHT
                });
            } else {
                positions.set(nodeId, {
                    x: pos.x,
                    y: baseY + yOffset,
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

                    const parent1BottomY = parent1Pos.y + CARD_HEIGHT;
                    const parent2BottomY = parent2Pos.y + CARD_HEIGHT;
                    yPos = (parent1BottomY + parent2BottomY) / 2;
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

    // Extract horizontal and vertical segments from SVG path
    const extractSegments = (path) => {
        const horizontal = [];
        const vertical = [];
        const commands = path.match(/[MLQ]\s*[^MLQ]+/g) || [];

        let currentX = 0, currentY = 0;

        commands.forEach(cmd => {
            const type = cmd[0];
            const coords = cmd.slice(1).trim().split(/\s+/).map(parseFloat);

            if (type === 'M') {
                currentX = coords[0];
                currentY = coords[1];
            } else if (type === 'Q') {
                currentX = coords[2];
                currentY = coords[3];
            } else if (type === 'L') {
                const newX = coords[0];
                const newY = coords[1];

                if (Math.abs(newY - currentY) < 0.1) {
                    horizontal.push({
                        y: currentY,
                        x1: Math.min(currentX, newX),
                        x2: Math.max(currentX, newX)
                    });
                } else if (Math.abs(newX - currentX) < 0.1) {
                    vertical.push({
                        x: currentX,
                        y1: Math.min(currentY, newY),
                        y2: Math.max(currentY, newY)
                    });
                }

                currentX = newX;
                currentY = newY;
            }
        });

        return { horizontal, vertical };
    };

    // Find intersection point between horizontal and vertical segments
    const findHorizontalVerticalIntersection = (hSeg, vSeg) => {
        if (vSeg.x < hSeg.x1 || vSeg.x > hSeg.x2) return null;
        if (hSeg.y < vSeg.y1 || hSeg.y > vSeg.y2) return null;
        return { x: vSeg.x, y: hSeg.y };
    };

    // Add jump arcs to path at specified intersection points
    const addMultipleJumpsToPath = (path, jumpPoints, jumpHeight = 25) => {
        if (jumpPoints.length === 0) return path;

        const commands = path.match(/[MLQ]\s*[^MLQ]+/g) || [];
        let newPath = '';
        let currentX = 0, currentY = 0;

        commands.forEach((cmd, idx) => {
            const type = cmd[0];
            const coords = cmd.slice(1).trim().split(/\s+/).map(parseFloat);

            if (type === 'M') {
                newPath += `M ${coords[0]} ${coords[1]} `;
                currentX = coords[0];
                currentY = coords[1];
            } else if (type === 'Q') {
                newPath += `Q ${coords[0]} ${coords[1]} ${coords[2]} ${coords[3]} `;
                currentX = coords[2];
                currentY = coords[3];
            } else if (type === 'L') {
                const newX = coords[0];
                const newY = coords[1];

                if (Math.abs(newY - currentY) < 0.1) {
                    const jumpsOnThisSegment = jumpPoints.filter(jp =>
                        Math.abs(currentY - jp.y) < 0.1 &&
                        jp.x >= Math.min(currentX, newX) &&
                        jp.x <= Math.max(currentX, newX)
                    );

                    if (jumpsOnThisSegment.length > 0) {
                        const goingLeftToRight = currentX < newX;
                        const sortedJumps = [...jumpsOnThisSegment].sort((a, b) =>
                            goingLeftToRight ? a.x - b.x : b.x - a.x
                        );

                        const jumpWidth = 25;

                        sortedJumps.forEach((jp, jumpIdx) => {
                            const leftSide = jp.x - jumpWidth / 2;
                            const rightSide = jp.x + jumpWidth / 2;

                            if (goingLeftToRight) {
                                newPath += `L ${leftSide} ${currentY} `;
                                newPath += `Q ${jp.x} ${currentY - jumpHeight} ${rightSide} ${currentY} `;
                            } else {
                                newPath += `L ${rightSide} ${currentY} `;
                                newPath += `Q ${jp.x} ${currentY - jumpHeight} ${leftSide} ${currentY} `;
                            }
                        });

                        newPath += `L ${newX} ${newY} `;
                    } else {
                        newPath += `L ${newX} ${newY} `;
                    }
                } else {
                    newPath += `L ${newX} ${newY} `;
                }

                currentX = newX;
                currentY = newY;
            }
        });

        return newPath.trim();
    };

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
            marriages.sort((a, b) => {
                const aMarriageNodeId = `marriage-${a.idx}`;
                const bMarriageNodeId = `marriage-${b.idx}`;
                const aPos = marriageNodePositions.get(aMarriageNodeId);
                const bPos = marriageNodePositions.get(bMarriageNodeId);

                // Sort by x-position of marriage nodes so connection points follow horizontal layout
                if (!aPos || !bPos) return a.idx - b.idx;

                return aPos.x - bPos.x;
            });
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
                relatedPeople: [parent1Id, parent2Id],
                marriageIdx
            });

            lines.push({
                key: `right-parent-to-marriage-${marriageIdx}`,
                path: `M ${rightParent.x} ${rightParent.y} L ${rightParent.x} ${marriageNodePos.y} L ${marriageNodePos.x} ${marriageNodePos.y}`,
                type: 'marriage',
                highlighted: isMarriageHighlighted,
                relatedPeople: [parent1Id, parent2Id],
                marriageIdx
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
                    relatedPeople: [parent1Id, parent2Id, childId],
                    marriageIdx
                });
            });
        });

        // OPTIMIZATION: Extract segments once per line to reduce O(N³) to O(N²)
        const lineSegmentsCache = lines.map(line => ({
            line,
            segments: extractSegments(line.path)
        }));

        // Apply jump effect where lines cross (marriage-marriage, marriage-child, child-child from different marriages)
        const processedLines = lineSegmentsCache.map(({ line, segments: mySegments }, lineIdx) => {
            let modifiedPath = line.path;
            const jumpsForThisLine = [];

            for (let i = 0; i < lineSegmentsCache.length; i++) {
                if (i === lineIdx) continue;

                const { line: otherLine, segments: otherSegments } = lineSegmentsCache[i];

                // Skip sibling lines (child lines from same marriage) to avoid jumps on overlapping segments
                const isSiblingLines = line.type === 'parent' &&
                                      otherLine.type === 'parent' &&
                                      line.marriageIdx === otherLine.marriageIdx;

                if (isSiblingLines) continue;

                mySegments.horizontal.forEach(hSeg => {
                    otherSegments.vertical.forEach(vSeg => {
                        const intersection = findHorizontalVerticalIntersection(hSeg, vSeg);
                        if (intersection !== null) {
                            // Skip corners: 5px deadzone at top of vertical lines, or horizontal endpoint within 15px of vertical top
                            const cornerDeadzone = 5;
                            const distanceFromVerticalTop = Math.abs(intersection.y - vSeg.y1);
                            const isNearVerticalTop = distanceFromVerticalTop < cornerDeadzone;
                            const isHorizontalEndpoint =
                                Math.abs(intersection.x - hSeg.x1) < cornerDeadzone ||
                                Math.abs(intersection.x - hSeg.x2) < cornerDeadzone;
                            const isCorner = isNearVerticalTop || (isHorizontalEndpoint && distanceFromVerticalTop < 15);

                            if (!isCorner) {
                                jumpsForThisLine.push({ intersection, otherLineKey: otherLine.key, otherLineType: otherLine.type });
                            }
                        }
                    });
                });
            }

            if (jumpsForThisLine.length > 0) {
                // De-duplicate intersections at same position (multiple lines crossing at same point)
                const uniqueJumpPoints = [];
                const seenPositions = new Set();

                jumpsForThisLine.forEach(({ intersection }) => {
                    const posKey = `${intersection.x.toFixed(1)},${intersection.y.toFixed(1)}`;
                    if (!seenPositions.has(posKey)) {
                        seenPositions.add(posKey);
                        uniqueJumpPoints.push(intersection);
                    }
                });

                modifiedPath = addMultipleJumpsToPath(line.path, uniqueJumpPoints);
            }

            return {
                ...line,
                path: modifiedPath
            };
        });

        return processedLines;
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

    // OPTIMIZATION: Pre-calculate all relationships to avoid expensive recalculation on every render
    const relationshipsMap = useMemo(() => {
        const map = new Map();
        if (!treeData.homePerson || !window.calculateRelationship) return map;

        Object.keys(treeData.people).forEach(personId => {
            if (personId !== treeData.homePerson) {
                const relationship = window.calculateRelationship(treeData.homePerson, personId, treeData);
                if (relationship) {
                    map.set(personId, relationship);
                }
            }
        });

        return map;
    }, [treeData]);

    // OPTIMIZATION: Calculate visible viewport bounds to cull off-screen nodes
    const visibleElements = useMemo(() => {
        if (!viewTransform || !containerRef.current) {
            return {
                people: new Set(Object.keys(treeData.people)),
                marriages: new Set(marriageNodes.map(n => n.id))
            };
        }

        const rect = containerRef.current.getBoundingClientRect();
        const viewportWidth = rect.width;
        const viewportHeight = rect.height;

        // Calculate viewport bounds in canvas coordinates with some padding
        const padding = 500; // Render nodes slightly outside viewport
        const minX = (-viewTransform.x - padding) / viewTransform.scale;
        const maxX = (viewportWidth - viewTransform.x + padding) / viewTransform.scale;
        const minY = (-viewTransform.y - padding) / viewTransform.scale;
        const maxY = (viewportHeight - viewTransform.y + padding) / viewTransform.scale;

        const visiblePeople = new Set();
        layout.positions.forEach((pos, personId) => {
            const nodeRight = pos.x + pos.width;
            const nodeBottom = pos.y + pos.height;

            // Check if node intersects viewport
            if (nodeRight >= minX && pos.x <= maxX && nodeBottom >= minY && pos.y <= maxY) {
                visiblePeople.add(personId);
            }
        });

        const visibleMarriages = new Set();
        marriageNodes.forEach(node => {
            const halfSize = node.size / 2;
            const nodeLeft = node.x - halfSize;
            const nodeRight = node.x + halfSize;
            const nodeTop = node.y - halfSize;
            const nodeBottom = node.y + halfSize;

            if (nodeRight >= minX && nodeLeft <= maxX && nodeBottom >= minY && nodeTop <= maxY) {
                visibleMarriages.add(node.id);
            }
        });

        return { people: visiblePeople, marriages: visibleMarriages };
    }, [viewTransform, layout, treeData, marriageNodes]);

    // OPTIMIZATION: Calculate visible lines separately to avoid circular dependency
    const visibleLines = useMemo(() => {
        const lines = new Set();
        connectionLines.forEach(line => {
            // Check if any of the people involved in this line are visible
            const hasVisiblePerson = line.relatedPeople.some(personId => visibleElements.people.has(personId));
            if (hasVisiblePerson) {
                lines.add(line.key);
            }
        });
        return lines;
    }, [connectionLines, visibleElements]);

    const handleWheel = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!containerRef.current || !viewTransform) return;

        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.min(Math.max(0.01, viewTransform.scale * delta), 3);

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
                // In multi-select mode, check if clicking on a selected node
                if (isMultiSelectMode && selectedNodes.has(marriageNodeId)) {
                    // Start dragging all selected nodes
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
                } else {
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
                // In multi-select mode, check if clicking on a selected node
                if (isMultiSelectMode && selectedNodes.has(personId)) {
                    // Start dragging all selected nodes
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
                } else {
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
                }
                e.stopPropagation();
                return;
            }
        }

        // If in multi-select mode and clicking on canvas, start selection rectangle
        if (isMultiSelectMode && !isLocked) {
            const canvasRect = containerRef.current.getBoundingClientRect();
            const clickX = (e.clientX - canvasRect.left - viewTransform.x) / viewTransform.scale;
            const clickY = (e.clientY - canvasRect.top - viewTransform.y) / viewTransform.scale;
            setSelectionStart({ x: clickX, y: clickY });
            setSelectionRect({ x: clickX, y: clickY, width: 0, height: 0 });
            e.stopPropagation();
            return;
        }

        // Always allow panning, even when locked
        setIsDragging(true);
        setDragStart({
            x: e.clientX - viewTransform.x,
            y: e.clientY - viewTransform.y
        });
    }, [viewTransform, layout, isLocked, isMultiSelectMode, selectedNodes]);

    const handleMouseMove = useCallback((e) => {
        // Handle selection rectangle drawing
        if (selectionStart && selectionRect) {
            const canvasRect = containerRef.current.getBoundingClientRect();
            const currentX = (e.clientX - canvasRect.left - viewTransform.x) / viewTransform.scale;
            const currentY = (e.clientY - canvasRect.top - viewTransform.y) / viewTransform.scale;

            setSelectionRect({
                x: Math.min(selectionStart.x, currentX),
                y: Math.min(selectionStart.y, currentY),
                width: Math.abs(currentX - selectionStart.x),
                height: Math.abs(currentY - selectionStart.y)
            });
            return;
        }

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

            // If in multi-select mode and dragging a selected node, move all selected nodes
            if (isMultiSelectMode && selectedNodes.has(draggingNode)) {
                const isDraggingMarriage = draggingNode.startsWith('marriage-');
                const oldPos = isDraggingMarriage
                    ? layout.marriageNodePositions.get(draggingNode)
                    : layout.positions.get(draggingNode);

                if (oldPos) {
                    const deltaX = newX - oldPos.x;
                    const deltaY = newY - oldPos.y;

                    // Move all selected nodes by the same delta
                    setNodePositions(prev => {
                        const newPositions = new Map(prev);
                        selectedNodes.forEach(nodeId => {
                            if (!nodeId.startsWith('marriage-')) {
                                const pos = layout.positions.get(nodeId);
                                if (pos) {
                                    newPositions.set(nodeId, {
                                        x: pos.x + deltaX,
                                        y: pos.y
                                    });
                                }
                            }
                        });
                        return newPositions;
                    });

                    setMarriageNodePositions(prev => {
                        const newPositions = new Map(prev);
                        selectedNodes.forEach(nodeId => {
                            if (nodeId.startsWith('marriage-')) {
                                const pos = layout.marriageNodePositions.get(nodeId);
                                if (pos) {
                                    newPositions.set(nodeId, {
                                        x: pos.x + deltaX,
                                        y: pos.y  // Only move horizontally in Generational View
                                    });
                                }
                            }
                        });
                        return newPositions;
                    });
                }
            } else {
                // Single node dragging
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
            }
        } else if (isDragging) {
            setViewTransform(prev => ({
                ...prev,
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            }));
        }
    }, [isDragging, draggingNode, dragStart, nodeDragStart, viewTransform, layout, selectionStart, selectionRect, isMultiSelectMode, selectedNodes]);

    const handleMouseUp = useCallback(() => {
        // Handle selection rectangle completion
        if (selectionRect && selectionStart) {
            const newSelectedNodes = new Set();

            // Check which person nodes are within the selection rectangle
            layout.positions.forEach((pos, personId) => {
                const nodeWidth = 200; // Approximate width of person card
                const nodeHeight = 100; // Approximate height of person card
                const nodeLeft = pos.x;
                const nodeRight = pos.x + nodeWidth;
                const nodeTop = pos.y;
                const nodeBottom = pos.y + nodeHeight;

                const rectLeft = selectionRect.x;
                const rectRight = selectionRect.x + selectionRect.width;
                const rectTop = selectionRect.y;
                const rectBottom = selectionRect.y + selectionRect.height;

                // Check if rectangles overlap
                if (!(nodeRight < rectLeft || nodeLeft > rectRight || nodeBottom < rectTop || nodeTop > rectBottom)) {
                    newSelectedNodes.add(personId);
                }
            });

            // Auto-select marriage nodes that connect selected people
            treeData.mariages.forEach((marriage, idx) => {
                if (marriage.length < 2) return;
                const [parent1, parent2, ...children] = marriage;
                const marriageId = `marriage-${idx}`;

                // Select marriage if both parents are selected
                if (parent1 && parent2 && newSelectedNodes.has(parent1) && newSelectedNodes.has(parent2)) {
                    newSelectedNodes.add(marriageId);
                }
            });

            setSelectedNodes(newSelectedNodes);
            setSelectionRect(null);
            setSelectionStart(null);
        }

        setIsDragging(false);
        setDraggingNode(null);
    }, [selectionRect, selectionStart, layout, treeData]);

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

            const newScale = Math.min(Math.max(0.01, viewTransform.scale * scale), 3);

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

        const newScale = Math.max(viewTransform.scale * 0.8, 0.01);
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

    const handleMinimapClick = useCallback((canvasX, canvasY) => {
        if (!containerRef.current || !viewTransform) return;

        const rect = containerRef.current.getBoundingClientRect();
        const viewportWidth = rect.width;
        const viewportHeight = rect.height;

        // Center the viewport on the clicked position
        const newX = viewportWidth / 2 - canvasX * viewTransform.scale;
        const newY = viewportHeight / 2 - canvasY * viewTransform.scale;

        setViewTransform(prev => ({
            ...prev,
            x: newX,
            y: newY
        }));
    }, [viewTransform]);

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
                <svg className={`gen-tree-lines ${!performanceMode ? 'animations-enabled' : ''}`} style={{ overflow: 'visible' }}>
                    {connectionLines.map(line => {
                        // OPTIMIZATION: Skip rendering off-screen lines
                        if (!visibleLines.has(line.key)) return null;

                        return (
                            <path
                                key={line.key}
                                d={line.path}
                                className={`gen-path gen-path-${line.type} ${line.highlighted ? 'gen-path-highlighted' : ''}`}
                                fill="none"
                            />
                        );
                    })}
                </svg>

                {marriageNodes.map(node => {
                    // OPTIMIZATION: Skip rendering off-screen marriage nodes
                    if (!visibleElements.marriages.has(node.id)) return null;

                    const isSelected = selectedNodes && selectedNodes.has(node.id);

                    return (
                        <div
                            key={node.id}
                            data-marriage-id={node.id}
                            className={`gen-marriage-node ${isSelected ? 'multi-selected' : ''}`}
                            style={{
                                position: 'absolute',
                                left: `${node.x - node.size / 2}px`,
                                top: `${node.y - node.size / 2}px`,
                                width: `${node.size}px`,
                                height: `${node.size}px`,
                                cursor: 'grab'
                            }}
                        />
                    );
                })}

                {generationData.sortedGenerations.map(([genNum, people]) =>
                    people.map(personId => {
                        // OPTIMIZATION: Skip rendering off-screen nodes
                        if (!visibleElements.people.has(personId)) return null;

                        const person = treeData.people[personId];
                        const pos = layout.positions.get(personId);

                        if (!person || !pos) return null;

                        const birthEvent = person.events?.find(e => e.type === '$_BIRTH');
                        const deathEvent = person.events?.find(e => e.type === '$_DEATH');
                        const isDeceased = !!deathEvent;
                        const avatarClass = person.gender === 'MALE' ? 'avatar-male' :
                                          person.gender === 'FEMALE' ? 'avatar-female' : 'avatar-other';

                        const isHomePerson = treeData.homePerson === personId;
                        const relationship = relationshipsMap.get(personId) || null;
                        const isMultiSelected = selectedNodes && selectedNodes.has(personId);

                        return (
                            <div
                                key={personId}
                                data-person-id={personId}
                                className={`gen-person-card ${selectedPerson === personId ? 'selected' : ''} ${isDeceased ? 'deceased' : ''} ${isMultiSelected ? 'multi-selected' : ''}`}
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

                {/* Render selection rectangle */}
                {selectionRect && (
                    <div
                        className="multi-select-rectangle"
                        style={{
                            position: 'absolute',
                            left: `${selectionRect.x}px`,
                            top: `${selectionRect.y}px`,
                            width: `${selectionRect.width}px`,
                            height: `${selectionRect.height}px`,
                            border: '4px dashed var(--primary)',
                            background: 'rgba(74, 144, 226, 0.25)',
                            pointerEvents: 'none'
                        }}
                    />
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

            {/* Legend */}
            {window.Legend && <window.Legend />}

            {/* Minimap */}
            {window.GenerationalMinimap && (
                <window.GenerationalMinimap
                    layout={layout}
                    viewTransform={viewTransform}
                    containerRef={containerRef}
                    onViewportClick={handleMinimapClick}
                />
            )}
        </div>
    );
};

window.GenerationalView = GenerationalView;
