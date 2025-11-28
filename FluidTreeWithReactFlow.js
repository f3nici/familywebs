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
            <div className="node-name-small">{data.person?.name}</div>
            <div className="node-surname-small">{data.person?.surname}</div>
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
// CUSTOM FLUID EDGE - Smooth Curved Lines
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
    markerEnd
}) => {
    // Calculate control points for smooth Bezier curve
    // This creates the characteristic "S" or vertical curve seen in familybushes.com

    const verticalDistance = Math.abs(targetY - sourceY);
    const controlOffset = verticalDistance * 0.5; // 50% of vertical distance

    let path;

    if (sourcePosition === Position.Bottom && targetPosition === Position.Top) {
        // Parent to child or marriage connection (downward)
        // Control points create smooth vertical curve
        const cp1x = sourceX;
        const cp1y = sourceY + controlOffset;
        const cp2x = targetX;
        const cp2y = targetY - controlOffset;

        path = `M ${sourceX},${sourceY} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${targetX},${targetY}`;
    } else if (sourcePosition === Position.Top && targetPosition === Position.Bottom) {
        // Child to parent (upward) - rare but possible
        const cp1x = sourceX;
        const cp1y = sourceY - controlOffset;
        const cp2x = targetX;
        const cp2y = targetY + controlOffset;

        path = `M ${sourceX},${sourceY} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${targetX},${targetY}`;
    } else {
        // Fallback to bezier path for other directions
        const [edgePath] = getBezierPath({
            sourceX,
            sourceY,
            sourcePosition,
            targetX,
            targetY,
            targetPosition,
        });
        path = edgePath;
    }

    // Determine if this is a marriage edge (parent to marriage) or child edge (marriage to child)
    const isMarriageEdge = data.type === 'marriage';
    const edgeClass = isMarriageEdge ? 'marriage-edge' : 'child-edge';

    return (
        <>
            <path
                id={id}
                className={`react-flow-edge-path ${edgeClass}`}
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
const calculateFluidLayout = (treeData) => {
    const nodes = [];
    const edges = [];
    const nodeWidth = 180;
    const nodeHeight = 140;
    const horizontalSpacing = 100;
    const verticalSpacing = 200;
    const marriageNodeSize = 20;

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

            // Add person node
            nodes.push({
                id: personId,
                type: 'personNode',
                position: { x: currentX, y: currentY },
                data: {
                    person,
                    personId,
                    onClick: () => {}
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

        // Position marriage node between parents, slightly below
        const marriageX = (parent1Node.position.x + parent2Node.position.x) / 2 + nodeWidth / 2;
        const marriageY = Math.max(parent1Node.position.y, parent2Node.position.y) + nodeHeight + 40;

        // Add marriage node
        nodes.push({
            id: marriageNodeId,
            type: 'marriageNode',
            position: { x: marriageX - marriageNodeSize / 2, y: marriageY },
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
            data: { type: 'marriage' },
        });

        edges.push({
            id: `edge-${parent2Id}-to-${marriageNodeId}`,
            source: parent2Id,
            sourceHandle: 'source-bottom',
            target: marriageNodeId,
            targetHandle: 'target-top',
            type: 'fluidEdge',
            data: { type: 'marriage' },
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
                data: { type: 'child' },
            });
        });
    });

    return { nodes, edges };
};

// ==========================================
// CONTROLS COMPONENT - Inside ReactFlow Context
// ==========================================
const FluidTreeControls = ({ onResetLayout }) => {
    const { fitView, zoomIn, zoomOut } = useReactFlow();

    const handleAutoOrganize = () => {
        fitView({
            padding: 0.2,
            duration: 800,
            maxZoom: 1
        });
    };

    return (
        <div className="fluid-tree-controls">
            <button
                className="organize-btn"
                onClick={handleAutoOrganize}
                title="Auto-organize and fit all nodes into view"
            >
                <span className="organize-icon">⚡</span>
                <span className="organize-text">Auto-Organize</span>
            </button>
            <div className="control-divider"></div>
            <button
                className="organize-btn-small"
                onClick={onResetLayout}
                title="Reset layout to original positions"
            >
                ↻ Reset
            </button>
        </div>
    );
};

// ==========================================
// INNER COMPONENT - Has access to ReactFlow context
// ==========================================
const FluidTreeInner = ({ treeData, selectedPerson, onSelectPerson }) => {
    // Calculate layout
    const { nodes: initialNodes, edges: initialEdges } = React.useMemo(
        () => calculateFluidLayout(treeData),
        [treeData]
    );

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

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

    // Reset layout to initial positions
    const handleResetLayout = React.useCallback(() => {
        const { nodes: newNodes, edges: newEdges } = calculateFluidLayout(treeData);
        setNodes(newNodes);
        setEdges(newEdges);

        // Fit view after resetting
        setTimeout(() => {
            const { fitView } = useReactFlow;
            if (fitView) {
                fitView({ padding: 0.2, duration: 800 });
            }
        }, 100);
    }, [treeData, setNodes, setEdges]);

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
            <FluidTreeControls onResetLayout={handleResetLayout} />
        </>
    );
};

// ==========================================
// MAIN REACT FLOW COMPONENT - Wrapper with Provider
// ==========================================
const FluidTreeWithReactFlow = ({ treeData, selectedPerson, onSelectPerson }) => {
    if (!ReactFlow) {
        return (
            <div className="empty-state">
                <p className="empty-text">React Flow library not loaded. Please add the script tag to your HTML.</p>
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
                />
            </ReactFlowProvider>
        </div>
    );
};

// Export for use in main app
window.FluidTreeWithReactFlow = FluidTreeWithReactFlow;
