const GenerationalMinimap = ({ layout, viewTransform, containerRef, onViewportClick }) => {
    const { useMemo, useCallback } = React;
    const canvasRef = React.useRef(null);

    const minimapWidth = 200;
    const minimapHeight = 150;

    // Calculate bounds of all nodes
    const bounds = useMemo(() => {
        if (!layout || !layout.positions || layout.positions.size === 0) {
            return { minX: 0, maxX: 1000, minY: 0, maxY: 1000, width: 1000, height: 1000 };
        }

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        layout.positions.forEach(pos => {
            minX = Math.min(minX, pos.x);
            maxX = Math.max(maxX, pos.x + pos.width);
            minY = Math.min(minY, pos.y);
            maxY = Math.max(maxY, pos.y + pos.height);
        });

        if (layout.marriageNodePositions) {
            layout.marriageNodePositions.forEach(pos => {
                const halfSize = pos.size / 2;
                minX = Math.min(minX, pos.x - halfSize);
                maxX = Math.max(maxX, pos.x + halfSize);
                minY = Math.min(minY, pos.y - halfSize);
                maxY = Math.max(maxY, pos.y + halfSize);
            });
        }

        const padding = 50;
        minX -= padding;
        maxX += padding;
        minY -= padding;
        maxY += padding;

        return {
            minX,
            maxX,
            minY,
            maxY,
            width: maxX - minX,
            height: maxY - minY
        };
    }, [layout]);

    // Calculate scale to fit content in minimap
    const scale = useMemo(() => {
        const scaleX = minimapWidth / bounds.width;
        const scaleY = minimapHeight / bounds.height;
        return Math.min(scaleX, scaleY);
    }, [bounds]);

    // Calculate viewport rectangle in minimap coordinates
    const viewportRect = useMemo(() => {
        if (!viewTransform || !containerRef.current) {
            return null;
        }

        const rect = containerRef.current.getBoundingClientRect();
        const viewportWidth = rect.width;
        const viewportHeight = rect.height;

        // Calculate viewport bounds in canvas coordinates
        const vpMinX = (-viewTransform.x) / viewTransform.scale;
        const vpMaxX = (viewportWidth - viewTransform.x) / viewTransform.scale;
        const vpMinY = (-viewTransform.y) / viewTransform.scale;
        const vpMaxY = (viewportHeight - viewTransform.y) / viewTransform.scale;

        // Convert to minimap coordinates
        const x = (vpMinX - bounds.minX) * scale;
        const y = (vpMinY - bounds.minY) * scale;
        const width = (vpMaxX - vpMinX) * scale;
        const height = (vpMaxY - vpMinY) * scale;

        return { x, y, width, height };
    }, [viewTransform, bounds, scale, containerRef]);

    // Draw minimap
    React.useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !layout) return;

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        // Set canvas size accounting for device pixel ratio
        canvas.width = minimapWidth * dpr;
        canvas.height = minimapHeight * dpr;
        canvas.style.width = `${minimapWidth}px`;
        canvas.style.height = `${minimapHeight}px`;
        ctx.scale(dpr, dpr);

        // Clear canvas
        ctx.clearRect(0, 0, minimapWidth, minimapHeight);

        // Get computed colors
        const computedStyle = getComputedStyle(document.documentElement);
        const bgCard = computedStyle.getPropertyValue('--bg-card').trim();
        const accentWarm = computedStyle.getPropertyValue('--accent-warm').trim();
        const accentSage = computedStyle.getPropertyValue('--accent-sage').trim();
        const primary = computedStyle.getPropertyValue('--primary').trim();

        // Draw background
        ctx.fillStyle = bgCard || '#ffffff';
        ctx.fillRect(0, 0, minimapWidth, minimapHeight);

        // Draw person nodes
        ctx.fillStyle = primary || '#c4956a';
        layout.positions.forEach(pos => {
            const x = (pos.x - bounds.minX) * scale;
            const y = (pos.y - bounds.minY) * scale;
            const width = pos.width * scale;
            const height = pos.height * scale;

            ctx.fillRect(x, y, width, height);
        });

        // Draw marriage nodes
        if (layout.marriageNodePositions) {
            ctx.fillStyle = accentWarm || '#c4956a';
            layout.marriageNodePositions.forEach(pos => {
                const x = (pos.x - bounds.minX) * scale;
                const y = (pos.y - bounds.minY) * scale;
                const size = pos.size * scale;

                ctx.beginPath();
                ctx.arc(x, y, size / 2, 0, 2 * Math.PI);
                ctx.fill();
            });
        }
    }, [layout, bounds, scale]);

    const handleClick = useCallback((e) => {
        if (!onViewportClick || !containerRef.current) return;

        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        // Convert minimap coordinates to canvas coordinates
        const canvasX = (clickX / scale) + bounds.minX;
        const canvasY = (clickY / scale) + bounds.minY;

        onViewportClick(canvasX, canvasY);
    }, [onViewportClick, bounds, scale, containerRef]);

    if (!layout || !layout.positions || layout.positions.size === 0) {
        return null;
    }

    return (
        <div className="gen-minimap">
            <canvas
                ref={canvasRef}
                className="gen-minimap-canvas"
                onClick={handleClick}
            />
            {viewportRect && (
                <div
                    className="gen-minimap-viewport"
                    style={{
                        left: `${viewportRect.x}px`,
                        top: `${viewportRect.y}px`,
                        width: `${viewportRect.width}px`,
                        height: `${viewportRect.height}px`
                    }}
                />
            )}
        </div>
    );
};

window.GenerationalMinimap = GenerationalMinimap;
