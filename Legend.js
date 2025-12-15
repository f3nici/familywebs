const Legend = () => {
    return (
        <div className="family-tree-legend">
            <div className="legend-title">Line Types</div>
            <div className="legend-items">
                <div className="legend-item">
                    <svg width="60" height="20" className="legend-line">
                        <line
                            x1="0"
                            y1="10"
                            x2="60"
                            y2="10"
                            className="legend-line-marriage"
                        />
                    </svg>
                    <span className="legend-label">Partner/Parent</span>
                </div>
                <div className="legend-item">
                    <svg width="60" height="20" className="legend-line">
                        <line
                            x1="0"
                            y1="10"
                            x2="60"
                            y2="10"
                            className="legend-line-child"
                        />
                    </svg>
                    <span className="legend-label">Child</span>
                </div>
            </div>
        </div>
    );
};

window.Legend = Legend;
