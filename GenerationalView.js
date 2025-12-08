// ==========================================
// GENERATIONAL VIEW COMPONENT
// Infinite canvas with proper hierarchical generation calculation
// ==========================================

const GenerationalView = ({ treeData, selectedPerson, onSelectPerson }) => {
    const { useMemo, useRef, useState, useCallback, useEffect } = React;
    const containerRef = useRef(null);
    const [viewTransform, setViewTransform] = useState({ x: 100, y: 100, scale: 1 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0 });
    const [initialZoomSet, setInitialZoomSet] = useState(false);

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
        const MARRIAGE_SIZE = 16;

        const dagreGraph = new dagre.graphlib.Graph();
        dagreGraph.setDefaultEdgeLabel(() => ({}));
        dagreGraph.setGraph({ rankdir: 'TB', nodesep: 80, ranksep: 180 });

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
        const marriageNodePositions = new Map();

        nodes.forEach(node => {
            const dagreNode = dagreGraph.node(node.id);
            if (!dagreNode) return;

            if (node.type === 'person') {
                positions.set(node.id, {
                    x: dagreNode.x - CARD_WIDTH / 2,
                    y: dagreNode.y - CARD_HEIGHT / 2,
                    width: CARD_WIDTH,
                    height: CARD_HEIGHT
                });
            } else {
                marriageNodePositions.set(node.id, {
                    x: dagreNode.x,
                    y: dagreNode.y,
                    size: MARRIAGE_SIZE * 2
                });
            }
        });

        return {
            positions,
            marriageNodePositions,
            CARD_WIDTH,
            CARD_HEIGHT,
            MARRIAGE_SIZE
        };
    }, [generationData, treeData]);

    // STEP 3: Generate connection lines using orthogonal (right angle) routing
    const connectionLines = useMemo(() => {
        const lines = [];
        const { positions, marriageNodePositions, CARD_WIDTH, CARD_HEIGHT } = layout;

        treeData.mariages.forEach((marriage, marriageIdx) => {
            if (marriage.length < 2) return;

            const [parent1Id, parent2Id, ...childrenIds] = marriage;
            const p1Pos = positions.get(parent1Id);
            const p2Pos = positions.get(parent2Id);
            const marriageNodeId = `marriage-${marriageIdx}`;
            const marriageNodePos = marriageNodePositions.get(marriageNodeId);

            if (!p1Pos || !p2Pos || !marriageNodePos) return;

            const p1CenterX = p1Pos.x + CARD_WIDTH / 2;
            const p1BottomY = p1Pos.y + CARD_HEIGHT;
            const p2CenterX = p2Pos.x + CARD_WIDTH / 2;
            const p2BottomY = p2Pos.y + CARD_HEIGHT;

            const marriageSpacing = 14;

            // Check if this marriage involves the selected person
            const isMarriageHighlighted = selectedPerson && (parent1Id === selectedPerson || parent2Id === selectedPerson);

            // Orthogonal line from parent 1 to marriage node (down then across)
            lines.push({
                key: `p1-to-marriage-${marriageIdx}`,
                path: `M ${p1CenterX} ${p1BottomY} L ${p1CenterX} ${marriageNodePos.y - marriageSpacing} L ${marriageNodePos.x} ${marriageNodePos.y - marriageSpacing} L ${marriageNodePos.x} ${marriageNodePos.y}`,
                type: 'marriage',
                highlighted: isMarriageHighlighted,
                relatedPeople: [parent1Id, parent2Id]
            });

            // Orthogonal line from parent 2 to marriage node (down then across)
            lines.push({
                key: `p2-to-marriage-${marriageIdx}`,
                path: `M ${p2CenterX} ${p2BottomY} L ${p2CenterX} ${marriageNodePos.y + marriageSpacing} L ${marriageNodePos.x} ${marriageNodePos.y + marriageSpacing} L ${marriageNodePos.x} ${marriageNodePos.y}`,
                type: 'marriage',
                highlighted: isMarriageHighlighted,
                relatedPeople: [parent1Id, parent2Id]
            });

            // Orthogonal lines from marriage node to children
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

        if (!containerRef.current) return;

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
        if (e.target.closest('.gen-person-card')) return;
        setIsDragging(true);
        setDragStart({ x: e.clientX - viewTransform.x });
    }, [viewTransform.x]);

    const handleMouseMove = useCallback((e) => {
        if (!isDragging) return;
        setViewTransform(prev => ({
            ...prev,
            x: e.clientX - dragStart.x
        }));
    }, [isDragging, dragStart]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
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

    // Auto zoom-to-fit on initial load
    useEffect(() => {
        if (!initialZoomSet && layout.positions.size > 0 && containerRef.current) {
            const timer = setTimeout(() => {
                zoomToFit();
                setInitialZoomSet(true);
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [initialZoomSet, layout, zoomToFit]);

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
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
            {/* Zoom controls */}
            <div className="gen-view-controls">
                <button className="gen-control-btn" onClick={() => setViewTransform(prev => ({ ...prev, scale: Math.min(prev.scale * 1.2, 3) }))}>+</button>
                <button className="gen-control-btn" onClick={() => setViewTransform(prev => ({ ...prev, scale: Math.max(prev.scale * 0.8, 0.1) }))}>−</button>
                <button className="gen-control-btn" onClick={resetView}>⟲</button>
            </div>

            {/* Canvas with transform */}
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
                        className="gen-marriage-node"
                        style={{
                            position: 'absolute',
                            left: `${node.x - node.size / 2}px`,
                            top: `${node.y - node.size / 2}px`,
                            width: `${node.size}px`,
                            height: `${node.size}px`
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
        </div>
    );
};

window.GenerationalView = GenerationalView;
console.log('✅ GenerationalView component loaded');
