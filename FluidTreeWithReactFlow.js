const {
    ReactFlow,
    Background,
    MiniMap,
    useNodesState,
    useEdgesState,
    Handle,
    Position,
    getBezierPath,
    EdgeLabelRenderer,
    useReactFlow,
    ReactFlowProvider
} = window.ReactFlow || {};

const PersonNode = ({ data, selected }) => {
    const getInitials = (name) => {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-AU', {
            year: 'numeric',
            month: 'short'
        });
    };

    const birthEvent = data.person?.events?.find(e => e.type === '$_BIRTH');
    const deathEvent = data.person?.events?.find(e => e.type === '$_DEATH');
    const isDeceased = !!deathEvent;

    const avatarClass = data.person?.gender === 'MALE' ? 'avatar-male' :
                       data.person?.gender === 'FEMALE' ? 'avatar-female' : 'avatar-other';

    return (
        <div className={`react-flow-person-node ${selected ? 'selected' : ''} ${isDeceased ? 'deceased' : ''}`}>
            <Handle
                type="target"
                position={Position.Top}
                id="target-top"
                className="react-flow-handle handle-top"
            />
            <Handle
                type="source"
                position={Position.Top}
                id="source-top"
                className="react-flow-handle handle-top"
            />

            <div className={`node-avatar-small ${avatarClass}`}>
                {getInitials(data.person?.name)}
            </div>
            <div className="node-name-small">
                {data.person?.name}
                {data.isHomePerson && (
                    <span style={{marginLeft: '6px', fontSize: '0.85em'}} title="Home Person">
                        🏠
                    </span>
                )}
            </div>
            <div className="node-surname-small">
                {data.person?.surname}
                {data.person?.maidenName && ` (née ${data.person.maidenName})`}
            </div>
            {data.relationship && (
                <div style={{
                    fontSize: '0.7rem',
                    color: 'var(--primary)',
                    fontWeight: '500',
                    marginTop: '2px'
                }}>
                    {data.relationship}
                </div>
            )}
            {(birthEvent?.dateStart || deathEvent?.dateStart) && (
                <div className="node-dates-small">
                    {birthEvent?.dateStart && formatDate(birthEvent.dateStart)}
                    {birthEvent?.dateStart && deathEvent?.dateStart && ' — '}
                    {deathEvent?.dateStart && formatDate(deathEvent.dateStart)}
                </div>
            )}

            <Handle
                type="target"
                position={Position.Bottom}
                id="target-bottom"
                className="react-flow-handle handle-bottom"
            />
            <Handle
                type="source"
                position={Position.Bottom}
                id="source-bottom"
                className="react-flow-handle handle-bottom"
            />
        </div>
    );
};

const MarriageNode = ({ selected }) => {
    return (
        <div className={`react-flow-marriage-node ${selected ? 'selected' : ''}`}>
            <Handle
                type="target"
                position={Position.Top}
                id="target-top"
                className="react-flow-handle handle-top"
            />
            <Handle
                type="source"
                position={Position.Top}
                id="source-top"
                className="react-flow-handle handle-top"
            />

            <div className="marriage-circle"></div>

            <Handle
                type="target"
                position={Position.Bottom}
                id="target-bottom"
                className="react-flow-handle handle-bottom"
            />
            <Handle
                type="source"
                position={Position.Bottom}
                id="source-bottom"
                className="react-flow-handle handle-bottom"
            />
        </div>
    );
};

const FluidEdge = ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    data = {},
    markerEnd,
    source,
    target,
    selected
}) => {
    const personNodeHeight = 140;
    const personNodeWidth = 180;
    const marriageNodeSize = 30;

    const isSourceMarriage = source?.includes('marriage') || false;
    const isTargetMarriage = target?.includes('marriage') || false;

    let adjustedSourceX = sourceX;
    let adjustedSourceY = sourceY;

    if (sourcePosition === Position.Bottom) {
        adjustedSourceY = sourceY - (isSourceMarriage ? marriageNodeSize / 2 : personNodeHeight / 2) - 6;
    } else if (sourcePosition === Position.Top) {
        adjustedSourceY = sourceY + (isSourceMarriage ? marriageNodeSize / 2 : personNodeHeight / 2) + 6;
    }

    let adjustedTargetX = targetX;
    let adjustedTargetY = targetY;

    if (targetPosition === Position.Bottom) {
        adjustedTargetY = targetY - (isTargetMarriage ? marriageNodeSize / 2 : personNodeHeight / 2) - 6;
    } else if (targetPosition === Position.Top) {
        adjustedTargetY = targetY + (isTargetMarriage ? marriageNodeSize / 2 : personNodeHeight / 2) + 6;
    }

    const path = `M ${adjustedSourceX},${adjustedSourceY} L ${adjustedTargetX},${adjustedTargetY}`;

    const isMarriageEdge = data.type === 'marriage';

    const isHighlighted = data.selectedPerson && (
        data.parent1Id === data.selectedPerson ||
        data.parent2Id === data.selectedPerson ||
        data.childId === data.selectedPerson
    );

    const edgeClass = isMarriageEdge ? 'marriage-edge' : 'child-edge';
    const highlightClass = isHighlighted ? 'highlighted' : '';

    return (
        <>
            <path
                id={id}
                className={`react-flow-edge-path ${edgeClass} ${highlightClass}`}
                d={path}
                markerEnd={markerEnd}
                style={style}
            />
        </>
    );
};

const calculateFluidLayout = (treeData, viewState = null) => {
    const nodes = [];
    const edges = [];
    const nodeWidth = 180;
    const nodeHeight = 140;
    const horizontalSpacing = 100;
    const verticalSpacing = 200;
    const marriageNodeSize = 30;

    const savedPositions = viewState?.nodes ?
        viewState.nodes.reduce((acc, node) => {
            acc[node.id] = { x: node.x, y: node.y };
            return acc;
        }, {}) : null;

    const generations = {};
    const processedMarriages = new Set();

    const childIds = new Set();
    const parentIds = new Set();

    treeData.mariages.forEach(marriage => {
        if (marriage.length >= 2) {
            parentIds.add(marriage[0]);
            parentIds.add(marriage[1]);
            marriage.slice(2).forEach(childId => childIds.add(childId));
        }
    });

    const rootIds = [...parentIds].filter(id => !childIds.has(id));

    const generationAssignment = {};
    const queue = rootIds.map(id => ({ id, gen: 0 }));
    const visited = new Set();

    while (queue.length > 0) {
        const { id, gen } = queue.shift();
        if (visited.has(id)) continue;
        visited.add(id);
        generationAssignment[id] = gen;

        if (!generations[gen]) generations[gen] = [];
        generations[gen].push(id);

        treeData.mariages.forEach((marriage, idx) => {
            if (marriage.length >= 2 && (marriage[0] === id || marriage[1] === id)) {
                const spouseId = marriage[0] === id ? marriage[1] : marriage[0];
                if (!visited.has(spouseId)) {
                    queue.push({ id: spouseId, gen });
                }

                marriage.slice(2).forEach(childId => {
                    if (!visited.has(childId)) {
                        queue.push({ id: childId, gen: gen + 1 });
                    }
                });
            }
        });
    }

    Object.keys(treeData.people).forEach(id => {
        if (!visited.has(id)) {
            generationAssignment[id] = 0;
            if (!generations[0]) generations[0] = [];
            generations[0].push(id);
        }
    });

    let currentY = 100;
    const generationKeys = Object.keys(generations).sort((a, b) => Number(a) - Number(b));

    generationKeys.forEach(genKey => {
        const gen = Number(genKey);
        const peopleInGen = generations[gen];
        const totalWidth = (peopleInGen.length - 1) * (nodeWidth + horizontalSpacing);
        let currentX = -totalWidth / 2 + 500; // Center around x=500

        peopleInGen.forEach(personId => {
            const person = treeData.people[personId];

            const position = savedPositions && savedPositions[personId]
                ? savedPositions[personId]
                : { x: currentX, y: currentY };

            const isHomePerson = treeData.homePerson === personId;
            const relationship = treeData.homePerson && treeData.homePerson !== personId && window.calculateRelationship
                ? window.calculateRelationship(treeData.homePerson, personId, treeData)
                : null;

            nodes.push({
                id: personId,
                type: 'personNode',
                position: position,
                data: {
                    person,
                    personId,
                    onClick: () => {},
                    isHomePerson,
                    relationship
                },
            });

            currentX += nodeWidth + horizontalSpacing;
        });

        currentY += verticalSpacing;
    });

    treeData.mariages.forEach((marriage, marriageIdx) => {
        if (marriage.length < 2) return;

        const parent1Id = marriage[0];
        const parent2Id = marriage[1];
        const childrenIds = marriage.slice(2);

        const marriageNodeId = `marriage-${parent1Id}-${parent2Id}`;

        if (processedMarriages.has(marriageNodeId)) return;
        processedMarriages.add(marriageNodeId);

        const parent1Node = nodes.find(n => n.id === parent1Id);
        const parent2Node = nodes.find(n => n.id === parent2Id);

        if (!parent1Node || !parent2Node) return;

        const defaultMarriageX = (parent1Node.position.x + parent2Node.position.x) / 2 + nodeWidth / 2;
        const defaultMarriageY = Math.max(parent1Node.position.y, parent2Node.position.y) + nodeHeight + 40;

        const marriagePosition = savedPositions && savedPositions[marriageNodeId]
            ? savedPositions[marriageNodeId]
            : { x: defaultMarriageX - marriageNodeSize / 2, y: defaultMarriageY };

        nodes.push({
            id: marriageNodeId,
            type: 'marriageNode',
            position: marriagePosition,
            data: {},
        });

        edges.push({
            id: `edge-${parent1Id}-to-${marriageNodeId}`,
            source: parent1Id,
            sourceHandle: 'source-bottom',
            target: marriageNodeId,
            targetHandle: 'target-top',
            type: 'fluidEdge',
            data: {
                type: 'marriage',
                parent1Id,
                parent2Id
            },
        });

        edges.push({
            id: `edge-${parent2Id}-to-${marriageNodeId}`,
            source: parent2Id,
            sourceHandle: 'source-bottom',
            target: marriageNodeId,
            targetHandle: 'target-top',
            type: 'fluidEdge',
            data: {
                type: 'marriage',
                parent1Id,
                parent2Id
            },
        });

        childrenIds.forEach(childId => {
            edges.push({
                id: `edge-${marriageNodeId}-to-${childId}`,
                source: marriageNodeId,
                sourceHandle: 'source-bottom',
                target: childId,
                targetHandle: 'target-top',
                type: 'fluidEdge',
                data: {
                    type: 'child',
                    parent1Id,
                    parent2Id,
                    childId
                },
            });
        });
    });

    return { nodes, edges };
};

const applyWebMode = async (nodes, edges) => {
    return new Promise((resolve, reject) => {
        if (typeof d3 === 'undefined') {
            console.error('❌ d3-force library not loaded!');
            reject(new Error('d3-force library not available'));
            return;
        }

        if (!nodes || nodes.length === 0) {
            resolve(nodes);
            return;
        }

        const nodesCopy = nodes.map(n => ({ ...n }));

        const simNodes = nodesCopy.map(node => ({
            id: node.id,
            x: node.position.x + 90, // Center of node (nodeWidth/2)
            y: node.position.y + 70, // Center of node (nodeHeight/2)
            fx: null, // Allow free movement
            fy: null,
            type: node.type
        }));

        const simLinks = edges.map(edge => ({
            source: edge.source,
            target: edge.target,
            type: edge.data?.type || 'unknown'
        }));

        const simulation = d3.forceSimulation(simNodes)
            .force('link', d3.forceLink(simLinks)
                .id(d => d.id)
                .distance(d => {
                    if (d.type === 'marriage') return 80;
                    if (d.type === 'child') return 120;
                    return 100;
                })
                .strength(0.9)
            )
            .force('charge', d3.forceManyBody()
                .strength(d => {
                    if (d.type === 'marriageNode') return -400;
                    return -1000;
                })
            )
            .force('center', d3.forceCenter(500, 400))
            .force('collision', d3.forceCollide()
                .radius(d => {
                    if (d.type === 'personNode') return 150;
                    return 60;
                })
                .strength(0.9)
                .iterations(4)
            )
            .alphaDecay(0.015)
            .velocityDecay(0.5);

        const ticksPerFrame = 10;
        let tickCount = 0;
        const maxTicks = 800;

        const tick = () => {
            for (let i = 0; i < ticksPerFrame; i++) {
                simulation.tick();
                tickCount++;
            }

            if (simulation.alpha() < 0.005 || tickCount >= maxTicks) {
                simulation.stop();

                nodesCopy.forEach(node => {
                    const simNode = simNodes.find(n => n.id === node.id);
                    if (simNode) {
                        node.position = {
                            x: simNode.x - 90,
                            y: simNode.y - 70
                        };
                    }
                });

                resolve(nodesCopy);
            } else {
                requestAnimationFrame(tick);
            }
        };

        requestAnimationFrame(tick);
    });
};

const FluidTreeControls = ({ nodes, edges, setNodes, isLocked, setIsLocked }) => {
    const { fitView, zoomIn, zoomOut } = useReactFlow();
    const [isApplyingWebMode, setIsApplyingWebMode] = React.useState(false);

    const handleWebMode = async () => {
        if (isApplyingWebMode || !nodes || nodes.length === 0) {
            return;
        }

        setIsApplyingWebMode(true);

        try {
            const organizedNodes = await applyWebMode(nodes, edges);

            setNodes(organizedNodes);

            setTimeout(() => {
                fitView({
                    padding: 0.2,
                    duration: 800,
                    maxZoom: 1.5
                });
            }, 100);
        } catch (error) {
            console.error('Error during Web Mode:', error);
        } finally {
            setIsApplyingWebMode(false);
        }
    };

    const handleFitView = () => {
        fitView({
            padding: 0.2,
            duration: 800,
            maxZoom: 1.5
        });
    };

    return (
        <div className="fluid-tree-controls">
            <div className="gen-view-controls">
                <button className="gen-control-btn mobile-hide" onClick={() => zoomIn({ duration: 200 })} title="Zoom in">+</button>
                <button className="gen-control-btn mobile-hide" onClick={() => zoomOut({ duration: 200 })} title="Zoom out">−</button>
                <button className="gen-control-btn" onClick={handleFitView} title="Fit to screen">⛶</button>
                <button
                    className={`gen-control-btn ${isLocked ? 'active' : ''}`}
                    onClick={() => setIsLocked(!isLocked)}
                    title={isLocked ? "Unlock" : "Lock"}
                >
                    {isLocked ? '🔒' : '🔓'}
                </button>
            </div>
            <button
                className="organize-btn"
                onClick={handleWebMode}
                disabled={isApplyingWebMode}
                title="Apply Web Mode using force-directed layout"
            >
                <span className="organize-icon">{isApplyingWebMode ? '⏳' : '🔄'}</span>
                <span className="organize-text">{isApplyingWebMode ? 'Applying...' : 'Regenerate'}</span>
            </button>
        </div>
    );
};

const FluidTreeInner = ({ treeData, selectedPerson, onSelectPerson, getNodePositionsRef, isMultiSelectMode, selectedNodes, setSelectedNodes }) => {
    const { nodes: initialNodes, edges: initialEdges } = React.useMemo(
        () => calculateFluidLayout(treeData, treeData.viewState),
        [treeData]
    );

    const [nodes, setNodes, onNodesChangeBase] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [isLocked, setIsLocked] = React.useState(true);

    const prevTreeDataRef = React.useRef(treeData);
    const { fitView } = useReactFlow();

    // Custom onNodesChange handler that adds marriage nodes to selection
    const onNodesChange = React.useCallback((changes) => {
        // First apply the changes normally
        onNodesChangeBase(changes);

        // If in multi-select mode and there are selection changes, add marriage nodes
        if (isMultiSelectMode) {
            const hasSelectionChange = changes.some(change => change.type === 'select');
            if (hasSelectionChange) {
                // Small delay to let the base selection update first
                setTimeout(() => {
                    setNodes(currentNodes => {
                        const selectedIds = new Set();

                        // Collect currently selected nodes
                        currentNodes.forEach(node => {
                            if (node.selected) {
                                selectedIds.add(node.id);
                            }
                        });

                        // Find marriage nodes that should be selected
                        treeData.mariages.forEach((marriage, idx) => {
                            if (marriage.length < 2) return;
                            const [parent1, parent2] = marriage;
                            const marriageId = `marriage-${idx}`;

                            // If both parents are selected, select the marriage node
                            if (parent1 && parent2 && selectedIds.has(parent1) && selectedIds.has(parent2)) {
                                selectedIds.add(marriageId);
                            }
                        });

                        // Update nodes with marriage nodes selected
                        return currentNodes.map(node => ({
                            ...node,
                            selected: selectedIds.has(node.id)
                        }));
                    });
                }, 0);
            }
        }
    }, [onNodesChangeBase, isMultiSelectMode, treeData, setNodes]);

    React.useEffect(() => {
        if (getNodePositionsRef) {
            getNodePositionsRef.current = () => nodes;
        }
    }, [nodes, getNodePositionsRef]);

    React.useEffect(() => {
        // Only handle single selection when not in multi-select mode
        if (!isMultiSelectMode) {
            setNodes(currentNodes =>
                currentNodes.map(node => ({
                    ...node,
                    selected: node.id === selectedPerson
                }))
            );
        }
    }, [selectedPerson, setNodes, isMultiSelectMode]);

    React.useEffect(() => {
        setEdges(currentEdges =>
            currentEdges.map(edge => ({
                ...edge,
                data: {
                    ...edge.data,
                    selectedPerson
                }
            }))
        );
    }, [selectedPerson, setEdges]);

    React.useEffect(() => {
        if (prevTreeDataRef.current !== treeData) {
            const { nodes: newNodes, edges: newEdges } = calculateFluidLayout(treeData, treeData.viewState);
            setNodes(newNodes);
            setEdges(newEdges);
            prevTreeDataRef.current = treeData;

            setTimeout(() => {
                fitView({
                    padding: 0.2,
                    duration: 800,
                    maxZoom: 1.5
                });
            }, 100);
        }
    }, [treeData, setNodes, setEdges, fitView]);

    // Clear selection when exiting multi-select mode
    React.useEffect(() => {
        if (!isMultiSelectMode) {
            setNodes(currentNodes =>
                currentNodes.map(node => ({
                    ...node,
                    selected: node.id === selectedPerson
                }))
            );
        }
    }, [isMultiSelectMode, selectedPerson, setNodes]);

    const nodeTypes = React.useMemo(() => ({
        personNode: PersonNode,
        marriageNode: MarriageNode,
    }), []);

    const edgeTypes = React.useMemo(() => ({
        fluidEdge: FluidEdge,
    }), []);

    const onNodeClick = React.useCallback((event, node) => {
        if (node.type === 'personNode' && node.data.personId) {
            onSelectPerson(node.data.personId);
        }
    }, [onSelectPerson]);

    return (
        <>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
                minZoom={0.01}
                maxZoom={2}
                defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
                nodesDraggable={!isLocked}
                nodesConnectable={false}
                elementsSelectable={true}
                panOnDrag={isMultiSelectMode ? [2] : true}
                selectionOnDrag={isMultiSelectMode}
                panOnScroll={isMultiSelectMode}
            >
                <Background color="#e5ddd2" gap={20} size={1} />
                {MiniMap && (
                    <MiniMap
                        position="bottom-left"
                        nodeColor={(node) => {
                            if (node.type === 'personNode') {
                                return 'var(--primary)';
                            }
                            return 'var(--accent-warm)';
                        }}
                        maskColor="rgba(196, 149, 106, 0.1)"
                        style={{
                            background: 'var(--bg-card)',
                            border: '2px solid var(--border-subtle)',
                            borderRadius: '8px'
                        }}
                    />
                )}
            </ReactFlow>
            <FluidTreeControls nodes={nodes} edges={edges} setNodes={setNodes} isLocked={isLocked} setIsLocked={setIsLocked} />

            {/* Legend */}
            {window.Legend && <window.Legend />}
        </>
    );
};

const FluidTreeWithReactFlow = ({ treeData, selectedPerson, onSelectPerson, getNodePositionsRef, isMultiSelectMode, selectedNodes, setSelectedNodes }) => {
    if (!ReactFlow) {
        console.error('React Flow not available!');
        return (
            <div className="empty-state">
                <div className="empty-icon">⚠️</div>
                <h3 className="empty-title">React Flow Not Loaded</h3>
                <p className="empty-text">
                    The React Flow library is required for the fluid view.
                    Please check your internet connection and refresh the page.
                </p>
            </div>
        );
    }

    if (!treeData || !treeData.people || Object.keys(treeData.people).length === 0) {
        return (
            <div className="empty-state">
                <div className="empty-icon">🌳</div>
                <h3 className="empty-title">No Family Members Yet</h3>
                <p className="empty-text">
                    Add your first family member to see the relationship lines.
                </p>
            </div>
        );
    }

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <ReactFlowProvider>
                <FluidTreeInner
                    treeData={treeData}
                    selectedPerson={selectedPerson}
                    onSelectPerson={onSelectPerson}
                    getNodePositionsRef={getNodePositionsRef}
                    isMultiSelectMode={isMultiSelectMode}
                    selectedNodes={selectedNodes}
                    setSelectedNodes={setSelectedNodes}
                />
            </ReactFlowProvider>
        </div>
    );
};

window.FluidTreeWithReactFlow = FluidTreeWithReactFlow;
