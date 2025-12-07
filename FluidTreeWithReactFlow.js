// ==========================================
// FLUID FAMILY TREE WITH REACT FLOW
// Complete implementation of familybushes.com-style relationship lines
// ==========================================

// This file requires React Flow to be loaded. Add this to your HTML:
// <script src="https://cdn.jsdelivr.net/npm/reactflow@11.10.1/dist/umd/index.min.js"></script>
// <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reactflow@11.10.1/dist/style.css">

const {
    ReactFlow,
    Background,
    useNodesState,
    useEdgesState,
    Handle,
    Position,
    getBezierPath,
    EdgeLabelRenderer,
    useReactFlow,
    ReactFlowProvider
} = window.ReactFlow || {};

// ==========================================
// CUSTOM PERSON NODE
// ==========================================
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
            {/* Top Handle */}
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

            {/* Node Content */}
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

            {/* Bottom Handle */}
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

// ==========================================
// CUSTOM MARRIAGE NODE
// ==========================================
const MarriageNode = ({ selected }) => {
    return (
        <div className={`react-flow-marriage-node ${selected ? 'selected' : ''}`}>
            {/* Top Handle */}
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

            {/* Marriage Icon/Circle */}
            <div className="marriage-circle"></div>

            {/* Bottom Handle */}
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

// ==========================================
// CUSTOM FLUID EDGE - Straight Lines for Force-Directed Layout
// ==========================================
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
    // For force-directed layout, draw straight lines from center to center
    // sourceX, sourceY, targetX, targetY are handle positions
    // We need to adjust to node centers

    // Node dimensions
    const personNodeHeight = 140;
    const personNodeWidth = 180;
    const marriageNodeSize = 20;

    // Determine node types from the data or IDs
    const isSourceMarriage = source?.includes('marriage') || false;
    const isTargetMarriage = target?.includes('marriage') || false;

    // Adjust source position to center
    // Note: Handles are offset by 6px (top: -6px, bottom: -6px in CSS)
    let adjustedSourceX = sourceX;
    let adjustedSourceY = sourceY;

    if (sourcePosition === Position.Bottom) {
        // Handle is at bottom + 6px, move up to center
        adjustedSourceY = sourceY - (isSourceMarriage ? marriageNodeSize / 2 : personNodeHeight / 2) - 6;
    } else if (sourcePosition === Position.Top) {
        // Handle is at top - 6px, move down to center
        adjustedSourceY = sourceY + (isSourceMarriage ? marriageNodeSize / 2 : personNodeHeight / 2) + 6;
    }

    // Adjust target position to center
    let adjustedTargetX = targetX;
    let adjustedTargetY = targetY;

    if (targetPosition === Position.Bottom) {
        // Handle is at bottom + 6px, move up to center
        adjustedTargetY = targetY - (isTargetMarriage ? marriageNodeSize / 2 : personNodeHeight / 2) - 6;
    } else if (targetPosition === Position.Top) {
        // Handle is at top - 6px, move down to center
        adjustedTargetY = targetY + (isTargetMarriage ? marriageNodeSize / 2 : personNodeHeight / 2) + 6;
    }

    // Draw straight line from center to center
    const path = `M ${adjustedSourceX},${adjustedSourceY} L ${adjustedTargetX},${adjustedTargetY}`;

    // Determine if this is a marriage edge (parent to marriage) or child edge (marriage to child)
    const isMarriageEdge = data.type === 'marriage';

    // Check if this edge should be highlighted
    // Highlight if edge connects to selectedPerson
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

// ==========================================
// LAYOUT ALGORITHM
// ==========================================
const calculateFluidLayout = (treeData, viewState = null) => {
    const nodes = [];
    const edges = [];
    const nodeWidth = 180;
    const nodeHeight = 140;
    const horizontalSpacing = 100;
    const verticalSpacing = 200;
    const marriageNodeSize = 20;

    // Check if we have saved positions to restore
    const savedPositions = viewState?.nodes ?
        viewState.nodes.reduce((acc, node) => {
            acc[node.id] = { x: node.x, y: node.y };
            return acc;
        }, {}) : null;

    // Track generation levels
    const generations = {};
    const processedMarriages = new Set();

    // Build a map of parent IDs to find roots
    const childIds = new Set();
    const parentIds = new Set();

    treeData.mariages.forEach(marriage => {
        if (marriage.length >= 2) {
            parentIds.add(marriage[0]);
            parentIds.add(marriage[1]);
            marriage.slice(2).forEach(childId => childIds.add(childId));
        }
    });

    // Find root people (those who are parents but not children)
    const rootIds = [...parentIds].filter(id => !childIds.has(id));

    // Assign generations using BFS
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

        // Find marriages involving this person
        treeData.mariages.forEach((marriage, idx) => {
            if (marriage.length >= 2 && (marriage[0] === id || marriage[1] === id)) {
                // Add spouse at same generation
                const spouseId = marriage[0] === id ? marriage[1] : marriage[0];
                if (!visited.has(spouseId)) {
                    queue.push({ id: spouseId, gen });
                }

                // Add children at next generation
                marriage.slice(2).forEach(childId => {
                    if (!visited.has(childId)) {
                        queue.push({ id: childId, gen: gen + 1 });
                    }
                });
            }
        });
    }

    // Add any unvisited people
    Object.keys(treeData.people).forEach(id => {
        if (!visited.has(id)) {
            generationAssignment[id] = 0;
            if (!generations[0]) generations[0] = [];
            generations[0].push(id);
        }
    });

    // Position nodes by generation
    let currentY = 100;
    const generationKeys = Object.keys(generations).sort((a, b) => Number(a) - Number(b));

    generationKeys.forEach(genKey => {
        const gen = Number(genKey);
        const peopleInGen = generations[gen];
        const totalWidth = (peopleInGen.length - 1) * (nodeWidth + horizontalSpacing);
        let currentX = -totalWidth / 2 + 500; // Center around x=500

        peopleInGen.forEach(personId => {
            const person = treeData.people[personId];

            // Use saved position if available, otherwise calculate new position
            const position = savedPositions && savedPositions[personId]
                ? savedPositions[personId]
                : { x: currentX, y: currentY };

            // Calculate relationship to home person
            const isHomePerson = treeData.homePerson === personId;
            const relationship = treeData.homePerson && treeData.homePerson !== personId && window.calculateRelationship
                ? window.calculateRelationship(treeData.homePerson, personId, treeData)
                : null;

            // Add person node
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

    // Create marriage nodes and edges
    treeData.mariages.forEach((marriage, marriageIdx) => {
        if (marriage.length < 2) return;

        const parent1Id = marriage[0];
        const parent2Id = marriage[1];
        const childrenIds = marriage.slice(2);

        const marriageNodeId = `marriage-${parent1Id}-${parent2Id}`;

        if (processedMarriages.has(marriageNodeId)) return;
        processedMarriages.add(marriageNodeId);

        // Find positions of parents
        const parent1Node = nodes.find(n => n.id === parent1Id);
        const parent2Node = nodes.find(n => n.id === parent2Id);

        if (!parent1Node || !parent2Node) return;

        // Use saved position if available, otherwise calculate position between parents
        const defaultMarriageX = (parent1Node.position.x + parent2Node.position.x) / 2 + nodeWidth / 2;
        const defaultMarriageY = Math.max(parent1Node.position.y, parent2Node.position.y) + nodeHeight + 40;

        const marriagePosition = savedPositions && savedPositions[marriageNodeId]
            ? savedPositions[marriageNodeId]
            : { x: defaultMarriageX - marriageNodeSize / 2, y: defaultMarriageY };

        // Add marriage node
        nodes.push({
            id: marriageNodeId,
            type: 'marriageNode',
            position: marriagePosition,
            data: {},
        });

        // Add edges from parents to marriage node
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

        // Add edges from marriage node to children
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

// ==========================================
// WEB MODE FUNCTION
// ==========================================
/**
 * Repositions existing nodes using d3-force for a spider-web layout
 * @param {Array} nodes - Current React Flow nodes
 * @param {Array} edges - Current React Flow edges
 * @returns {Promise<Array>} Updated nodes with new positions
 */
const applyWebMode = async (nodes, edges) => {
    return new Promise((resolve, reject) => {
        console.log('🔧 applyWebMode called with:', {
            nodesCount: nodes?.length,
            edgesCount: edges?.length,
            d3Available: typeof d3 !== 'undefined',
            d3Functions: typeof d3 !== 'undefined' ? Object.keys(d3).slice(0, 10) : 'N/A'
        });

        // Check if d3-force is available
        if (typeof d3 === 'undefined') {
            console.error('❌ d3-force library not loaded!');
            reject(new Error('d3-force library not available'));
            return;
        }

        // Don't modify if there are no nodes
        if (!nodes || nodes.length === 0) {
            console.log('⚠️ No nodes to organize');
            resolve(nodes);
            return;
        }

        // Create a copy of nodes to avoid mutation
        const nodesCopy = nodes.map(n => ({ ...n }));

        // Create simulation nodes with initial positions
        const simNodes = nodesCopy.map(node => ({
            id: node.id,
            x: node.position.x + 90, // Center of node (nodeWidth/2)
            y: node.position.y + 70, // Center of node (nodeHeight/2)
            fx: null, // Allow free movement
            fy: null,
            type: node.type
        }));

        // Create simulation links from edges
        const simLinks = edges.map(edge => ({
            source: edge.source,
            target: edge.target,
            type: edge.data?.type || 'unknown'
        }));

        console.log('🔧 Creating d3 simulation with', simNodes.length, 'nodes and', simLinks.length, 'links');

        // Configure d3-force simulation for tight compact layout
        const simulation = d3.forceSimulation(simNodes)
            // Very strong attraction between connected nodes
            .force('link', d3.forceLink(simLinks)
                .id(d => d.id)
                .distance(d => {
                    // Very short distances to pack nodes tightly
                    if (d.type === 'marriage') return 80;
                    if (d.type === 'child') return 120;
                    return 100;
                })
                .strength(0.9) // Very strong links to minimize edge length and crossings
            )
            // Weaker repulsion to allow nodes to be closer
            .force('charge', d3.forceManyBody()
                .strength(d => {
                    if (d.type === 'marriageNode') return -400;
                    return -1000;
                })
            )
            // Gentle centering
            .force('center', d3.forceCenter(500, 400))
            // Tighter collision detection
            .force('collision', d3.forceCollide()
                .radius(d => {
                    // Smaller radii to pack tighter
                    if (d.type === 'personNode') return 150;
                    return 60;
                })
                .strength(0.9)
                .iterations(4)
            )
            .alphaDecay(0.015) // Slower cooling for better settling
            .velocityDecay(0.5); // Moderate friction

        console.log('✅ Simulation created, starting ticks...');

        // Run simulation asynchronously
        const ticksPerFrame = 10;
        let tickCount = 0;
        const maxTicks = 800; // Many iterations for best convergence

        const tick = () => {
            for (let i = 0; i < ticksPerFrame; i++) {
                simulation.tick();
                tickCount++;
            }

            // Check if simulation has cooled down or reached max iterations
            if (simulation.alpha() < 0.005 || tickCount >= maxTicks) {
                simulation.stop();
                console.log('✅ Simulation complete:', {
                    tickCount,
                    alpha: simulation.alpha(),
                    reason: simulation.alpha() < 0.005 ? 'converged' : 'max iterations'
                });

                // Update node positions from simulation
                nodesCopy.forEach(node => {
                    const simNode = simNodes.find(n => n.id === node.id);
                    if (simNode) {
                        // Convert back from center position to top-left corner
                        node.position = {
                            x: simNode.x - 90,
                            y: simNode.y - 70
                        };
                    }
                });

                console.log('✅ Node positions updated, resolving with', nodesCopy.length, 'nodes');
                resolve(nodesCopy);
            } else {
                // Continue simulation in next frame
                requestAnimationFrame(tick);
            }
        };

        // Start the simulation
        requestAnimationFrame(tick);
    });
};

// ==========================================
// CONTROLS COMPONENT - Inside ReactFlow Context
// ==========================================
const FluidTreeControls = ({ nodes, edges, setNodes }) => {
    const { fitView } = useReactFlow();
    const [isApplyingWebMode, setIsApplyingWebMode] = React.useState(false);

    const handleWebMode = async () => {
        console.log('🎯 Web Mode button clicked!', {
            isApplyingWebMode,
            nodesCount: nodes?.length,
            edgesCount: edges?.length
        });

        if (isApplyingWebMode || !nodes || nodes.length === 0) {
            console.log('⚠️ Aborting: isApplyingWebMode=' + isApplyingWebMode + ', nodes=' + nodes?.length);
            return;
        }

        setIsApplyingWebMode(true);
        console.log('✅ Starting Web Mode...');

        try {
            // Run force-directed layout
            const organizedNodes = await applyWebMode(nodes, edges);
            console.log('✅ Web Mode complete, updating nodes...');

            // Update nodes with new positions
            setNodes(organizedNodes);

            // Fit view after organizing
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

    return (
        <div className="fluid-tree-controls">
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

// ==========================================
// INNER COMPONENT - Has access to ReactFlow context
// ==========================================
const FluidTreeInner = ({ treeData, selectedPerson, onSelectPerson, getNodePositionsRef }) => {
    // Calculate layout with viewState if available
    const { nodes: initialNodes, edges: initialEdges } = React.useMemo(
        () => {
            console.log('Calculating layout for treeData:', treeData);
            const layout = calculateFluidLayout(treeData, treeData.viewState);
            console.log('Layout calculated:', layout.nodes.length, 'nodes,', layout.edges.length, 'edges');
            if (treeData.viewState) {
                console.log('📍 Using saved view state with', treeData.viewState.nodes?.length, 'node positions');
            }
            return layout;
        },
        [treeData]
    );

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    // Track the previous treeData to only reset when it actually changes
    const prevTreeDataRef = React.useRef(treeData);
    const { fitView } = useReactFlow();

    // Set up callback to provide current node positions to parent component
    React.useEffect(() => {
        if (getNodePositionsRef) {
            getNodePositionsRef.current = () => nodes;
        }
    }, [nodes, getNodePositionsRef]);

    // Update nodes when selectedPerson changes to mark the selected node
    React.useEffect(() => {
        setNodes(currentNodes =>
            currentNodes.map(node => ({
                ...node,
                selected: node.id === selectedPerson
            }))
        );
    }, [selectedPerson, setNodes]);

    // Update edges when selectedPerson changes to inject selectedPerson into edge data
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

    // Update nodes and edges when treeData changes (person added/removed/modified)
    React.useEffect(() => {
        // Only recalculate if treeData actually changed (not just a re-render)
        if (prevTreeDataRef.current !== treeData) {
            const hasViewState = treeData.viewState && treeData.viewState.nodes && treeData.viewState.nodes.length > 0;
            console.log('🔄 TreeData changed, recalculating layout', hasViewState ? '(with saved positions)' : '(basic layout only)');

            const { nodes: newNodes, edges: newEdges } = calculateFluidLayout(treeData, treeData.viewState);
            setNodes(newNodes);
            setEdges(newEdges);
            prevTreeDataRef.current = treeData;

            // Fit view to show positions (Web Mode regeneration is now manual only via button)
            setTimeout(() => {
                fitView({
                    padding: 0.2,
                    duration: 800,
                    maxZoom: 1.5
                });
            }, 100);
        }
    }, [treeData, setNodes, setEdges, fitView]);

    // Define custom node types
    const nodeTypes = React.useMemo(() => ({
        personNode: PersonNode,
        marriageNode: MarriageNode,
    }), []);

    // Define custom edge types
    const edgeTypes = React.useMemo(() => ({
        fluidEdge: FluidEdge,
    }), []);

    // Handle node click
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
                minZoom={0.1}
                maxZoom={2}
                defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
                nodesDraggable={true}
                nodesConnectable={false}
                elementsSelectable={true}
            >
                <Background color="#e5ddd2" gap={20} size={1} />
            </ReactFlow>
            <FluidTreeControls nodes={nodes} edges={edges} setNodes={setNodes} />
        </>
    );
};

// ==========================================
// MAIN REACT FLOW COMPONENT - Wrapper with Provider
// ==========================================
const FluidTreeWithReactFlow = ({ treeData, selectedPerson, onSelectPerson, getNodePositionsRef }) => {
    console.log('FluidTreeWithReactFlow called with:', {
        hasTreeData: !!treeData,
        peopleCount: treeData?.people ? Object.keys(treeData.people).length : 0,
        marriagesCount: treeData?.mariages?.length || 0,
        hasReactFlow: !!ReactFlow,
        hasViewState: !!treeData?.viewState
    });

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

    // Check if there's any data to display
    if (!treeData || !treeData.people || Object.keys(treeData.people).length === 0) {
        console.log('No data to display in FluidTreeWithReactFlow');
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

    console.log('Rendering FluidTreeWithReactFlow with data');
    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <ReactFlowProvider>
                <FluidTreeInner
                    treeData={treeData}
                    selectedPerson={selectedPerson}
                    onSelectPerson={onSelectPerson}
                    getNodePositionsRef={getNodePositionsRef}
                />
            </ReactFlowProvider>
        </div>
    );
};

// Export for use in main app
window.FluidTreeWithReactFlow = FluidTreeWithReactFlow;

// Log successful load
console.log('✅ FluidTreeWithReactFlow component loaded and exported to window.FluidTreeWithReactFlow');
console.log('React Flow available:', !!window.ReactFlow);
console.log('d3-force available:', typeof d3 !== 'undefined');
console.log('d3-force functions:', typeof d3 !== 'undefined' ? Object.keys(d3) : 'N/A');
