        const { useState, useEffect, useRef, useCallback, useMemo } = React;
        window.__FAMILY_TREE_APP_LOADED__ = true;

        // Icons
        const Icons = {
            tree: '🌳',
            search: '🔍',
            plus: '+',
            edit: '✏️',
            trash: '🗑️',
            download: '⬇️',
            upload: '⬆️',
            close: '×',
            birth: '👶',
            death: '✝',
            marriage: '💍',
            person: '👤',
            male: '♂',
            female: '♀',
            zoomIn: '+',
            zoomOut: '−',
            reset: '⟲',
            list: '☰',
            grid: '⊞',
            eye: '👁',
            share: '↗',
        };

        // Utility Functions
        const formatDate = (dateStr) => {
            if (!dateStr) return '';
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-AU', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
            });
        };

        const getInitials = (name) => {
            if (!name) return '?';
            return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        };

        const getAge = (birthDate, deathDate = null) => {
            if (!birthDate) return null;
            const birth = new Date(birthDate);
            const end = deathDate ? new Date(deathDate) : new Date();
            const age = Math.floor((end - birth) / (365.25 * 24 * 60 * 60 * 1000));
            return age;
        };

        const generateId = () => {
            return Math.random().toString(36).substr(2, 9);
        };

        // Initial empty tree data
        const emptyTreeData = {
            id: generateId(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            name: "New Family Tree",
            events: [
                "$_BIRTH",
                "$_MARRIED",
                "$_LIVED_AT",
                "$_DEATH"
            ],
            attributes: [],
            people: {},
            mariages: []
        };

        const NODE_WIDTH = 180;
        const NODE_HEIGHT = 140;
        const H_SPACING = 80;
        const V_SPACING = 180;
        const COUPLE_GAP = 30;
        const CANVAS_PADDING = 140;

        const buildGenerations = (treeData) => {
            const people = treeData.people;
            const marriages = treeData.mariages;
            const personGenerations = {};
            const visited = new Set();

            const childIds = new Set();
            const parentIds = new Set();

            marriages.forEach(marriage => {
                if (marriage.length >= 2) {
                    parentIds.add(marriage[0]);
                    parentIds.add(marriage[1]);
                    marriage.slice(2).forEach(childId => childIds.add(childId));
                }
            });

            const rootIds = [...parentIds].filter(id => !childIds.has(id));

            if (rootIds.length === 0) {
                const sortedByBirth = Object.entries(people).sort((a, b) => {
                    const birthA = a[1].events?.find(e => e.type === '$_BIRTH')?.dateStart || '9999';
                    const birthB = b[1].events?.find(e => e.type === '$_BIRTH')?.dateStart || '9999';
                    return birthA.localeCompare(birthB);
                });
                if (sortedByBirth.length > 0) {
                    rootIds.push(sortedByBirth[0][0]);
                }
            }

            const queue = rootIds.map(id => ({ id, gen: 0 }));

            while (queue.length > 0) {
                const { id, gen } = queue.shift();
                if (visited.has(id)) continue;
                visited.add(id);
                personGenerations[id] = gen;

                marriages.forEach(marriage => {
                    if (marriage.length >= 2 && (marriage[0] === id || marriage[1] === id)) {
                        const spouseId = marriage[0] === id ? marriage[1] : marriage[0];
                        if (spouseId && !visited.has(spouseId)) {
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

            Object.keys(people).forEach(id => {
                if (!visited.has(id)) {
                    personGenerations[id] = 0;
                }
            });

            const generations = {};
            Object.entries(personGenerations).forEach(([id, gen]) => {
                if (!generations[gen]) generations[gen] = [];
                generations[gen].push(id);
            });

            return generations;
        };

        const findParents = (treeData, childId) => {
            return treeData.mariages
                .filter(marriage => marriage.slice(2).includes(childId))
                .flatMap(marriage => marriage.slice(0, 2).filter(Boolean));
        };

        const computeStrictLayout = (treeData) => {
            const generations = buildGenerations(treeData);
            const sortedGenerations = Object.entries(generations).sort((a, b) => Number(a[0]) - Number(b[0]));
            const positions = {};
            let maxX = 0;

            sortedGenerations.forEach(([gen, ids]) => {
                const y = CANVAS_PADDING + Number(gen) * (NODE_HEIGHT + V_SPACING);
                const groupings = [];
                const used = new Set();

                treeData.mariages.forEach(marriage => {
                    const [p1, p2] = marriage;
                    if (ids.includes(p1) && ids.includes(p2)) {
                        groupings.push({ type: 'couple', members: [p1, p2] });
                        used.add(p1);
                        used.add(p2);
                    }
                });

                ids.forEach(id => {
                    if (!used.has(id)) {
                        groupings.push({ type: 'single', members: [id] });
                    }
                });

                groupings.sort((a, b) => a.members[0].localeCompare(b.members[0]));

                let x = CANVAS_PADDING;
                groupings.forEach(group => {
                    const width = group.members.length * NODE_WIDTH + (group.members.length - 1) * COUPLE_GAP;
                    group.members.forEach((id, idx) => {
                        positions[id] = { x: x + idx * (NODE_WIDTH + COUPLE_GAP), y };
                        maxX = Math.max(maxX, positions[id].x + NODE_WIDTH);
                    });
                    x += width + H_SPACING;
                });
            });

            sortedGenerations.forEach(([gen, ids]) => {
                if (Number(gen) === 0) return;
                const y = CANVAS_PADDING + Number(gen) * (NODE_HEIGHT + V_SPACING);
                const placements = ids.map(id => {
                    const parents = findParents(treeData, id);
                    const parentCenters = parents
                        .map(pid => positions[pid]?.x + NODE_WIDTH / 2)
                        .filter(v => typeof v === 'number');
                    const target = parentCenters.length
                        ? parentCenters.reduce((sum, val) => sum + val, 0) / parentCenters.length
                        : null;
                    return { id, target };
                }).sort((a, b) => (a.target ?? 0) - (b.target ?? 0));

                let x = CANVAS_PADDING;
                placements.forEach(item => {
                    const ideal = item.target ?? (x + NODE_WIDTH / 2);
                    x = Math.max(x, ideal - NODE_WIDTH / 2);
                    positions[item.id] = { x, y };
                    maxX = Math.max(maxX, x + NODE_WIDTH);
                    x += NODE_WIDTH + H_SPACING;
                });
            });

            const marriages = treeData.mariages.map((marriage, idx) => ({
                id: `marriage-${idx}`,
                parents: marriage.slice(0, 2).filter(Boolean),
                children: marriage.slice(2)
            }));

            const size = {
                width: Math.max(maxX + CANVAS_PADDING, window.innerWidth || 1200),
                height: CANVAS_PADDING + sortedGenerations.length * (NODE_HEIGHT + V_SPACING) + CANVAS_PADDING,
            };

            return { positions, marriages, size };
        };

        const computeFluidLayout = (treeData) => {
            const positions = {};
            const marriages = treeData.mariages.map((marriage, idx) => ({
                id: `marriage-${idx}`,
                parents: marriage.slice(0, 2).filter(Boolean),
                children: marriage.slice(2)
            }));

            const sortedPeople = Object.entries(treeData.people).sort((a, b) => {
                const birthA = a[1].events?.find(e => e.type === '$_BIRTH')?.dateStart || '9999';
                const birthB = b[1].events?.find(e => e.type === '$_BIRTH')?.dateStart || '9999';
                return birthA.localeCompare(birthB);
            });

            const groups = [];
            const placed = new Set();

            marriages.forEach(m => {
                if (m.parents.length > 0) {
                    groups.push({
                        type: 'family',
                        members: m.parents,
                        children: m.children,
                    });
                    m.parents.forEach(p => placed.add(p));
                }
            });

            sortedPeople.forEach(([id]) => {
                if (!placed.has(id)) {
                    groups.push({ type: 'single', members: [id], children: [] });
                }
            });

            const groupsPerRow = 3;
            let currentRow = 0;
            let currentCol = 0;
            let maxWidth = 0;
            let maxHeight = 0;

            groups.forEach((group, index) => {
                if (index > 0 && index % groupsPerRow === 0) {
                    currentRow += 1;
                    currentCol = 0;
                }

                const baseX = CANVAS_PADDING + currentCol * (NODE_WIDTH * 2 + H_SPACING * 2);
                const baseY = CANVAS_PADDING + currentRow * (NODE_HEIGHT * 2 + V_SPACING);

                group.members.forEach((id, idx) => {
                    if (!positions[id]) {
                        positions[id] = {
                            x: baseX + idx * (NODE_WIDTH + COUPLE_GAP),
                            y: baseY,
                        };
                        maxWidth = Math.max(maxWidth, positions[id].x + NODE_WIDTH);
                        maxHeight = Math.max(maxHeight, positions[id].y + NODE_HEIGHT);
                    }
                });

                const childStartX = baseX;
                group.children.forEach((id, idx) => {
                    if (!positions[id]) {
                        positions[id] = {
                            x: childStartX + idx * (NODE_WIDTH + COUPLE_GAP),
                            y: baseY + NODE_HEIGHT + V_SPACING / 2,
                        };
                        maxWidth = Math.max(maxWidth, positions[id].x + NODE_WIDTH);
                        maxHeight = Math.max(maxHeight, positions[id].y + NODE_HEIGHT);
                    }
                });

                currentCol += 1;
            });

            const size = {
                width: Math.max(maxWidth + CANVAS_PADDING, window.innerWidth || 1200),
                height: Math.max(maxHeight + CANVAS_PADDING, window.innerHeight || 800),
            };

            return { positions, marriages, size };
        };

        const computeTreeLayout = (treeData, mode) => {
            if (!treeData || Object.keys(treeData.people).length === 0) {
                return { positions: {}, marriages: [], size: { width: 1200, height: 800 } };
            }

            return mode === 'strict'
                ? computeStrictLayout(treeData)
                : computeFluidLayout(treeData);
        };

        // Person Card Component
        const PersonCard = ({ person, personId, isSelected, onClick, isEditMode, compact = false, style = {}, className = '' }) => {
            const birthEvent = person.events?.find(e => e.type === '$_BIRTH');
            const deathEvent = person.events?.find(e => e.type === '$_DEATH');
            const isDeceased = !!deathEvent;
            
            const avatarClass = person.gender === 'MALE' ? 'avatar-male' : 
                              person.gender === 'FEMALE' ? 'avatar-female' : 'avatar-other';

            return (
                <div
                    className={`tree-node ${isSelected ? 'selected' : ''} ${isDeceased ? 'deceased' : ''} ${className}`}
                    onClick={() => onClick(personId)}
                    style={{ ...(compact ? { minWidth: '140px', padding: '16px 20px' } : {}), ...style }}
                >
                    <div className={`node-avatar ${avatarClass}`} style={compact ? { width: '50px', height: '50px', fontSize: '1.2rem' } : {}}>
                        {getInitials(person.name)}
                    </div>
                    <div className="node-name">{person.name}</div>
                    <div className="node-surname">{person.surname}</div>
                    <div className="node-dates">
                        {birthEvent?.dateStart && formatDate(birthEvent.dateStart)}
                        {birthEvent?.dateStart && deathEvent?.dateStart && ' — '}
                        {deathEvent?.dateStart && formatDate(deathEvent.dateStart)}
                    </div>
                </div>
            );
        };

        // Person List Item
        const PersonListItem = ({ person, personId, isSelected, onClick }) => {
            const birthEvent = person.events?.find(e => e.type === '$_BIRTH');
            const deathEvent = person.events?.find(e => e.type === '$_DEATH');
            
            const avatarClass = person.gender === 'MALE' ? 'avatar-male' : 
                              person.gender === 'FEMALE' ? 'avatar-female' : 'avatar-other';

            const age = getAge(birthEvent?.dateStart, deathEvent?.dateStart);

            return (
                <div 
                    className={`person-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => onClick(personId)}
                >
                    <div className={`person-avatar ${avatarClass}`}>
                        {getInitials(person.name)}
                    </div>
                    <div className="person-info">
                        <div className="person-name">{person.name} {person.surname}</div>
                        <div className="person-dates">
                            {birthEvent?.dateStart ? formatDate(birthEvent.dateStart) : 'Birth unknown'}
                            {age !== null && ` • ${age} ${deathEvent ? 'years old at death' : 'years old'}`}
                        </div>
                    </div>
                </div>
            );
        };

        // Detail Panel Component
        const DetailPanel = ({ person, personId, treeData, isEditMode, onUpdate, onClose, onSelectPerson }) => {
            const [editedPerson, setEditedPerson] = useState({...person});
            
            useEffect(() => {
                setEditedPerson({...person});
            }, [person, personId]);

            const birthEvent = person.events?.find(e => e.type === '$_BIRTH');
            const deathEvent = person.events?.find(e => e.type === '$_DEATH');
            
            const avatarClass = person.gender === 'MALE' ? 'avatar-male' : 
                              person.gender === 'FEMALE' ? 'avatar-female' : 'avatar-other';

            // Find relationships
            const relationships = useMemo(() => {
                const rels = { parents: [], spouses: [], children: [], siblings: [] };
                
                treeData.mariages.forEach(marriage => {
                    if (marriage.length < 2) return;
                    
                    const parents = marriage.slice(0, 2);
                    const children = marriage.slice(2);
                    
                    // Check if this person is a child in this marriage
                    if (children.includes(personId)) {
                        parents.forEach(parentId => {
                            if (treeData.people[parentId]) {
                                rels.parents.push({ id: parentId, person: treeData.people[parentId] });
                            }
                        });
                        // Siblings from same marriage
                        children.forEach(childId => {
                            if (childId !== personId && treeData.people[childId]) {
                                rels.siblings.push({ id: childId, person: treeData.people[childId] });
                            }
                        });
                    }
                    
                    // Check if this person is a parent in this marriage
                    if (parents.includes(personId)) {
                        const spouseId = parents.find(id => id !== personId);
                        if (spouseId && treeData.people[spouseId]) {
                            if (!rels.spouses.find(s => s.id === spouseId)) {
                                rels.spouses.push({ id: spouseId, person: treeData.people[spouseId] });
                            }
                        }
                        children.forEach(childId => {
                            if (treeData.people[childId] && !rels.children.find(c => c.id === childId)) {
                                rels.children.push({ id: childId, person: treeData.people[childId] });
                            }
                        });
                    }
                });
                
                return rels;
            }, [treeData, personId]);

            const handleInputChange = (field, value) => {
                setEditedPerson(prev => ({...prev, [field]: value}));
            };

            const handleEventChange = (eventType, field, value) => {
                setEditedPerson(prev => {
                    const events = [...(prev.events || [])];
                    const eventIndex = events.findIndex(e => e.type === eventType);
                    if (eventIndex >= 0) {
                        events[eventIndex] = {...events[eventIndex], [field]: value};
                    } else {
                        events.push({ type: eventType, [field]: value, comment: '' });
                    }
                    return {...prev, events};
                });
            };

            const handleSave = () => {
                onUpdate(personId, editedPerson);
            };

            const getEventValue = (eventType, field) => {
                const event = editedPerson.events?.find(e => e.type === eventType);
                return event?.[field] || '';
            };

            return (
                <div className="detail-panel slide-in">
                    <div className="detail-header">
                        <div>
                            <div className={`detail-avatar ${avatarClass}`}>
                                {getInitials(person.name)}
                            </div>
                            <h2 className="detail-title">{person.name}</h2>
                            <p className="detail-subtitle">{person.surname}</p>
                        </div>
                        <button className="btn btn-ghost btn-icon" onClick={onClose}>
                            {Icons.close}
                        </button>
                    </div>
                    
                    <div className="detail-content">
                        {isEditMode ? (
                            <>
                                <div className="detail-section">
                                    <h3 className="section-title">Basic Information</h3>
                                    <div className="form-group">
                                        <label className="form-label">First Name(s)</label>
                                        <input 
                                            type="text"
                                            className="form-input"
                                            value={editedPerson.name || ''}
                                            onChange={(e) => handleInputChange('name', e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Surname</label>
                                        <input 
                                            type="text"
                                            className="form-input"
                                            value={editedPerson.surname || ''}
                                            onChange={(e) => handleInputChange('surname', e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Gender</label>
                                        <select 
                                            className="form-input form-select"
                                            value={editedPerson.gender || ''}
                                            onChange={(e) => handleInputChange('gender', e.target.value)}
                                        >
                                            <option value="">Select...</option>
                                            <option value="MALE">Male</option>
                                            <option value="FEMALE">Female</option>
                                            <option value="OTHER">Other</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="detail-section">
                                    <h3 className="section-title">Life Events</h3>
                                    <div className="form-group">
                                        <label className="form-label">Birth Date</label>
                                        <input 
                                            type="date"
                                            className="form-input"
                                            value={getEventValue('$_BIRTH', 'dateStart')}
                                            onChange={(e) => handleEventChange('$_BIRTH', 'dateStart', e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Death Date</label>
                                        <input 
                                            type="date"
                                            className="form-input"
                                            value={getEventValue('$_DEATH', 'dateStart')}
                                            onChange={(e) => handleEventChange('$_DEATH', 'dateStart', e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="detail-section">
                                    <h3 className="section-title">Notes</h3>
                                    <div className="form-group">
                                        <textarea 
                                            className="form-input form-textarea"
                                            value={editedPerson.information || ''}
                                            onChange={(e) => handleInputChange('information', e.target.value)}
                                            placeholder="Add notes about this person..."
                                        />
                                    </div>
                                </div>

                                <button className="btn btn-primary" onClick={handleSave} style={{width: '100%'}}>
                                    Save Changes
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="detail-section">
                                    <h3 className="section-title">Life Events</h3>
                                    <div className="event-list">
                                        {birthEvent?.dateStart && (
                                            <div className="event-item">
                                                <div className="event-icon event-birth">{Icons.birth}</div>
                                                <div className="event-info">
                                                    <div className="event-type">Born</div>
                                                    <div className="event-date">{formatDate(birthEvent.dateStart)}</div>
                                                </div>
                                            </div>
                                        )}
                                        {deathEvent?.dateStart && (
                                            <div className="event-item">
                                                <div className="event-icon event-death">{Icons.death}</div>
                                                <div className="event-info">
                                                    <div className="event-type">Died</div>
                                                    <div className="event-date">{formatDate(deathEvent.dateStart)}</div>
                                                </div>
                                            </div>
                                        )}
                                        {!birthEvent?.dateStart && !deathEvent?.dateStart && (
                                            <p style={{color: 'var(--text-muted)', fontStyle: 'italic'}}>
                                                No events recorded
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {relationships.spouses.length > 0 && (
                                    <div className="detail-section">
                                        <h3 className="section-title">Spouse(s)</h3>
                                        <div className="relationship-list">
                                            {relationships.spouses.map(({id, person}) => (
                                                <div 
                                                    key={id} 
                                                    className="relationship-item"
                                                    onClick={() => onSelectPerson(id)}
                                                >
                                                    <span className="relationship-type">Spouse</span>
                                                    <span className="relationship-name">{person.name} {person.surname}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {relationships.parents.length > 0 && (
                                    <div className="detail-section">
                                        <h3 className="section-title">Parents</h3>
                                        <div className="relationship-list">
                                            {relationships.parents.map(({id, person}) => (
                                                <div 
                                                    key={id} 
                                                    className="relationship-item"
                                                    onClick={() => onSelectPerson(id)}
                                                >
                                                    <span className="relationship-type">Parent</span>
                                                    <span className="relationship-name">{person.name} {person.surname}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {relationships.children.length > 0 && (
                                    <div className="detail-section">
                                        <h3 className="section-title">Children</h3>
                                        <div className="relationship-list">
                                            {relationships.children.map(({id, person}) => (
                                                <div 
                                                    key={id} 
                                                    className="relationship-item"
                                                    onClick={() => onSelectPerson(id)}
                                                >
                                                    <span className="relationship-type">Child</span>
                                                    <span className="relationship-name">{person.name} {person.surname}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {relationships.siblings.length > 0 && (
                                    <div className="detail-section">
                                        <h3 className="section-title">Siblings</h3>
                                        <div className="relationship-list">
                                            {relationships.siblings.map(({id, person}) => (
                                                <div 
                                                    key={id} 
                                                    className="relationship-item"
                                                    onClick={() => onSelectPerson(id)}
                                                >
                                                    <span className="relationship-type">Sibling</span>
                                                    <span className="relationship-name">{person.name} {person.surname}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {person.information && (
                                    <div className="detail-section">
                                        <h3 className="section-title">Notes</h3>
                                        <p style={{color: 'var(--text-secondary)', lineHeight: 1.7}}>
                                            {person.information}
                                        </p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            );
        };

        // Add Person Modal
        const AddPersonModal = ({ isOpen, onClose, onAdd, treeData }) => {
            const [newPerson, setNewPerson] = useState({
                name: '',
                surname: '',
                gender: '',
                events: [],
                information: '',
                photos: [],
                attachments: []
            });
            const [birthDate, setBirthDate] = useState('');
            const [relationship, setRelationship] = useState({ type: '', personId: '' });

            if (!isOpen) return null;

            const handleSubmit = () => {
                const person = {
                    ...newPerson,
                    events: birthDate ? [{ type: '$_BIRTH', dateStart: birthDate, comment: '' }] : []
                };
                onAdd(person, relationship);
                setNewPerson({ name: '', surname: '', gender: '', events: [], information: '', photos: [], attachments: [] });
                setBirthDate('');
                setRelationship({ type: '', personId: '' });
                onClose();
            };

            return (
                <div className="modal-overlay" onClick={onClose}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Add New Person</h2>
                            <button className="btn btn-ghost btn-icon" onClick={onClose}>
                                {Icons.close}
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">First Name(s) *</label>
                                <input 
                                    type="text"
                                    className="form-input"
                                    value={newPerson.name}
                                    onChange={(e) => setNewPerson(prev => ({...prev, name: e.target.value}))}
                                    placeholder="e.g., John William"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Surname *</label>
                                <input 
                                    type="text"
                                    className="form-input"
                                    value={newPerson.surname}
                                    onChange={(e) => setNewPerson(prev => ({...prev, surname: e.target.value}))}
                                    placeholder="e.g., Smith"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Gender</label>
                                <select 
                                    className="form-input form-select"
                                    value={newPerson.gender}
                                    onChange={(e) => setNewPerson(prev => ({...prev, gender: e.target.value}))}
                                >
                                    <option value="">Select...</option>
                                    <option value="MALE">Male</option>
                                    <option value="FEMALE">Female</option>
                                    <option value="OTHER">Other</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Birth Date</label>
                                <input 
                                    type="date"
                                    className="form-input"
                                    value={birthDate}
                                    onChange={(e) => setBirthDate(e.target.value)}
                                />
                            </div>
                            
                            <div style={{marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border-subtle)'}}>
                                <h4 style={{fontFamily: 'var(--font-display)', marginBottom: '16px'}}>
                                    Relationship (Optional)
                                </h4>
                                <div className="form-group">
                                    <label className="form-label">Relationship Type</label>
                                    <select 
                                        className="form-input form-select"
                                        value={relationship.type}
                                        onChange={(e) => setRelationship(prev => ({...prev, type: e.target.value}))}
                                    >
                                        <option value="">None - Add without relationship</option>
                                        <option value="spouse">Spouse of...</option>
                                        <option value="child">Child of...</option>
                                        <option value="parent">Parent of...</option>
                                    </select>
                                </div>
                                {relationship.type && (
                                    <div className="form-group">
                                        <label className="form-label">Related Person</label>
                                        <select 
                                            className="form-input form-select"
                                            value={relationship.personId}
                                            onChange={(e) => setRelationship(prev => ({...prev, personId: e.target.value}))}
                                        >
                                            <option value="">Select person...</option>
                                            {Object.entries(treeData.people).map(([id, person]) => (
                                                <option key={id} value={id}>
                                                    {person.name} {person.surname}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                            <button 
                                className="btn btn-primary" 
                                onClick={handleSubmit}
                                disabled={!newPerson.name || !newPerson.surname}
                            >
                                Add Person
                            </button>
                        </div>
                    </div>
                </div>
            );
        };

        // Add Marriage Modal
        const AddMarriageModal = ({ isOpen, onClose, onAdd, treeData }) => {
            const [spouse1, setSpouse1] = useState('');
            const [spouse2, setSpouse2] = useState('');

            if (!isOpen) return null;

            const handleSubmit = () => {
                if (spouse1 && spouse2 && spouse1 !== spouse2) {
                    onAdd(spouse1, spouse2);
                    setSpouse1('');
                    setSpouse2('');
                    onClose();
                }
            };

            return (
                <div className="modal-overlay" onClick={onClose}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Add Marriage/Partnership</h2>
                            <button className="btn btn-ghost btn-icon" onClick={onClose}>
                                {Icons.close}
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">First Partner</label>
                                <select 
                                    className="form-input form-select"
                                    value={spouse1}
                                    onChange={(e) => setSpouse1(e.target.value)}
                                >
                                    <option value="">Select person...</option>
                                    {Object.entries(treeData.people).map(([id, person]) => (
                                        <option key={id} value={id}>
                                            {person.name} {person.surname}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Second Partner</label>
                                <select 
                                    className="form-input form-select"
                                    value={spouse2}
                                    onChange={(e) => setSpouse2(e.target.value)}
                                >
                                    <option value="">Select person...</option>
                                    {Object.entries(treeData.people)
                                        .filter(([id]) => id !== spouse1)
                                        .map(([id, person]) => (
                                            <option key={id} value={id}>
                                                {person.name} {person.surname}
                                            </option>
                                        ))}
                                </select>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                            <button 
                                className="btn btn-primary" 
                                onClick={handleSubmit}
                                disabled={!spouse1 || !spouse2}
                            >
                                Add Marriage
                            </button>
                        </div>
                    </div>
                </div>
            );
        };

        const TreeViewport = ({ treeData, viewMode, selectedPerson, onSelectPerson }) => {
            const { positions, marriages, size } = useMemo(() => computeTreeLayout(treeData, viewMode), [treeData, viewMode]);
            const containerRef = useRef(null);
            const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
            const dragging = useRef(null);

            const anchors = useMemo(() => {
                return Object.entries(positions).reduce((acc, [id, pos]) => {
                    acc[id] = {
                        top: { x: pos.x + NODE_WIDTH / 2, y: pos.y },
                        bottom: { x: pos.x + NODE_WIDTH / 2, y: pos.y + NODE_HEIGHT },
                        center: { x: pos.x + NODE_WIDTH / 2, y: pos.y + NODE_HEIGHT / 2 },
                    };
                    return acc;
                }, {});
            }, [positions]);

            const marriageEdges = useMemo(() => {
                return marriages
                    .map(m => {
                        if (m.parents.length < 2) return null;
                        const [p1, p2] = m.parents;
                        const a1 = anchors[p1];
                        const a2 = anchors[p2];
                        if (!a1 || !a2) return null;
                        const mid = {
                            x: (a1.center.x + a2.center.x) / 2,
                            y: Math.min(a1.bottom.y, a2.bottom.y) + 12,
                        };
                        return { ...m, a1, a2, mid };
                    })
                    .filter(Boolean);
            }, [marriages, anchors]);

            const parentChildEdges = useMemo(() => {
                return marriages.flatMap(m => {
                    const parentAnchors = m.parents.map(pid => anchors[pid]).filter(Boolean);
                    if (parentAnchors.length === 0) return [];
                    const midX = parentAnchors.reduce((sum, a) => sum + a.bottom.x, 0) / parentAnchors.length;
                    const midY = Math.max(...parentAnchors.map(a => a.bottom.y)) + 6;

                    return m.children
                        .map(childId => {
                            const childAnchor = anchors[childId];
                            if (!childAnchor) return null;
                            return {
                                id: `${m.id}-${childId}`,
                                from: { x: midX, y: midY },
                                to: { x: childAnchor.top.x, y: childAnchor.top.y },
                            };
                        })
                        .filter(Boolean);
                });
            }, [marriages, anchors]);

            const updateZoom = useCallback((deltaScale, focalPoint = null) => {
                setTransform(prev => {
                    const container = containerRef.current;
                    if (!container) return prev;
                    const rect = container.getBoundingClientRect();
                    const focus = focalPoint || { x: rect.width / 2, y: rect.height / 2 };

                    const nextScale = Math.min(2.5, Math.max(0.4, prev.scale * deltaScale));
                    const scaleRatio = nextScale / prev.scale;

                    const nextX = (prev.x - focus.x) * scaleRatio + focus.x;
                    const nextY = (prev.y - focus.y) * scaleRatio + focus.y;

                    return { x: nextX, y: nextY, scale: nextScale };
                });
            }, []);

            const handleWheel = useCallback((e) => {
                if (!containerRef.current) return;
                if (e.ctrlKey || e.metaKey || e.altKey) {
                    e.preventDefault();
                    const rect = containerRef.current.getBoundingClientRect();
                    updateZoom(e.deltaY < 0 ? 1.1 : 0.9, { x: e.clientX - rect.left, y: e.clientY - rect.top });
                }
            }, [updateZoom]);

            const handlePointerDown = (e) => {
                if (e.button !== 0) return;
                if (e.target.closest('.tree-node')) return;
                if (!containerRef.current) return;
                dragging.current = {
                    startX: e.clientX,
                    startY: e.clientY,
                    origX: transform.x,
                    origY: transform.y,
                };
                containerRef.current.setPointerCapture(e.pointerId);
            };

            const handlePointerMove = (e) => {
                if (!dragging.current) return;
                const dx = e.clientX - dragging.current.startX;
                const dy = e.clientY - dragging.current.startY;
                setTransform(prev => ({ ...prev, x: dragging.current.origX + dx, y: dragging.current.origY + dy }));
            };

            const endDrag = (e) => {
                if (dragging.current && containerRef.current) {
                    containerRef.current.releasePointerCapture(e.pointerId);
                }
                dragging.current = null;
            };

            useEffect(() => {
                const container = containerRef.current;
                if (!container) return;
                const rect = container.getBoundingClientRect();
                const centeredX = (rect.width - size.width) / 2;
                const centeredY = (rect.height - size.height) / 2;
                setTransform(prev => ({ ...prev, x: centeredX, y: centeredY, scale: 1 }));
            }, [size.width, size.height, viewMode]);

            const resetView = () => {
                const container = containerRef.current;
                if (!container) return;
                const rect = container.getBoundingClientRect();
                const centeredX = (rect.width - size.width) / 2;
                const centeredY = (rect.height - size.height) / 2;
                setTransform({ x: centeredX, y: centeredY, scale: 1 });
            };

            return (
                <div className="tree-viewport pannable" ref={containerRef} onWheel={handleWheel}>
                    <div
                        className="tree-stage"
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={endDrag}
                        onPointerLeave={endDrag}
                        onPointerCancel={endDrag}
                        style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}
                    >
                        <div className="tree-content" style={{ width: `${size.width}px`, height: `${size.height}px` }}>
                            <svg className="tree-overlay" width={size.width} height={size.height}>
                                <defs>
                                    <marker id="arrow" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
                                        <path d="M0,0 L0,6 L9,3 z" fill="var(--accent-sage)" />
                                    </marker>
                                    <marker id="marriage-dot" markerWidth="8" markerHeight="8" refX="4" refY="4">
                                        <circle cx="4" cy="4" r="3" fill="var(--accent-warm)" />
                                    </marker>
                                </defs>
                                {marriageEdges.map(edge => (
                                    <line
                                        key={edge.id}
                                        x1={edge.a1.center.x}
                                        y1={edge.a1.center.y}
                                        x2={edge.a2.center.x}
                                        y2={edge.a2.center.y}
                                        className="edge marriage-edge"
                                        markerStart="url(#marriage-dot)"
                                        markerEnd="url(#marriage-dot)"
                                    />
                                ))}
                                {parentChildEdges.map(edge => (
                                    <path
                                        key={edge.id}
                                        d={`M ${edge.from.x} ${edge.from.y} L ${edge.from.x} ${(edge.from.y + edge.to.y) / 2} L ${edge.to.x} ${edge.to.y}`}
                                        className="edge parent-edge"
                                        markerEnd="url(#arrow)"
                                    />
                                ))}
                            </svg>

                            {Object.entries(positions).map(([personId, pos]) => (
                                <PersonCard
                                    key={personId}
                                    person={treeData.people[personId]}
                                    personId={personId}
                                    isSelected={selectedPerson === personId}
                                    onClick={onSelectPerson}
                                    isEditMode={false}
                                    style={{ position: 'absolute', left: pos.x, top: pos.y, width: `${NODE_WIDTH}px` }}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="zoom-controls">
                        <button className="zoom-btn" onClick={() => updateZoom(1.1)}>
                            {Icons.zoomIn}
                        </button>
                        <div className="zoom-divider" />
                        <button className="zoom-btn" onClick={resetView}>
                            {Icons.reset}
                        </button>
                        <div className="zoom-divider" />
                        <button className="zoom-btn" onClick={() => updateZoom(0.9)}>
                            {Icons.zoomOut}
                        </button>
                    </div>
                </div>
            );
        };

        // Fluid Tree View - uses free-form layout with relationship overlay
        const FluidTreeView = ({ treeData, selectedPerson, onSelectPerson }) => (
            <TreeViewport
                treeData={treeData}
                viewMode="fluid"
                selectedPerson={selectedPerson}
                onSelectPerson={onSelectPerson}
            />
        );

        // Strict Tree View - hierarchical layout with connectors
        const StrictTreeView = ({ treeData, selectedPerson, onSelectPerson }) => (
            <TreeViewport
                treeData={treeData}
                viewMode="strict"
                selectedPerson={selectedPerson}
                onSelectPerson={onSelectPerson}
            />
        );

        // Main App Component
        const FamilyTreeApp = () => {
            const [treeData, setTreeData] = useState(null);
            const [isEditMode, setIsEditMode] = useState(true);
            const [viewMode, setViewMode] = useState('fluid'); // 'fluid' or 'strict'
            const [selectedPerson, setSelectedPerson] = useState(null);
            const [searchQuery, setSearchQuery] = useState('');
            const [showAddPersonModal, setShowAddPersonModal] = useState(false);
            const [showAddMarriageModal, setShowAddMarriageModal] = useState(false);
            
            const fileInputRef = useRef(null);

            // Filter people based on search
            const filteredPeople = useMemo(() => {
                if (!treeData) return [];
                return Object.entries(treeData.people).filter(([id, person]) => {
                    const fullName = `${person.name} ${person.surname}`.toLowerCase();
                    return fullName.includes(searchQuery.toLowerCase());
                });
            }, [treeData, searchQuery]);

            // Load sample data on mount
            useEffect(() => {
                // Check if there's data in localStorage
                const saved = localStorage.getItem('familyTreeData');
                if (saved) {
                    try {
                        setTreeData(JSON.parse(saved));
                    } catch (e) {
                        console.error('Failed to parse saved data');
                    }
                }
            }, []);

            // Save to localStorage when data changes
            useEffect(() => {
                if (treeData) {
                    localStorage.setItem('familyTreeData', JSON.stringify(treeData));
                }
            }, [treeData]);

            const handleFileUpload = (event) => {
                const file = event.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        try {
                            const data = JSON.parse(e.target.result);
                            setTreeData(data);
                            setSelectedPerson(null);
                        } catch (error) {
                            alert('Invalid JSON file');
                        }
                    };
                    reader.readAsText(file);
                }
            };

            const handleDownload = () => {
                if (!treeData) return;
                const dataStr = JSON.stringify(treeData, null, 2);
                const blob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${treeData.name || 'family_tree'}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            };

            const handleNewTree = () => {
                const name = prompt('Enter a name for your family tree:', 'My Family');
                if (name) {
                    setTreeData({
                        ...emptyTreeData,
                        id: generateId(),
                        name,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                    setSelectedPerson(null);
                }
            };

            const handleUpdatePerson = (personId, updatedPerson) => {
                setTreeData(prev => ({
                    ...prev,
                    updatedAt: new Date().toISOString(),
                    people: {
                        ...prev.people,
                        [personId]: updatedPerson
                    }
                }));
            };

            const handleAddPerson = (person, relationship) => {
                const newId = String(Math.max(0, ...Object.keys(treeData.people).map(Number)) + 1);
                
                setTreeData(prev => {
                    const newData = {
                        ...prev,
                        updatedAt: new Date().toISOString(),
                        people: {
                            ...prev.people,
                            [newId]: person
                        }
                    };
                    
                    // Handle relationships
                    if (relationship.type && relationship.personId) {
                        const relPersonId = relationship.personId;
                        
                        if (relationship.type === 'spouse') {
                            // Check if person already has a marriage
                            const existingMarriage = prev.mariages.find(m => 
                                m[0] === relPersonId || m[1] === relPersonId
                            );
                            if (existingMarriage) {
                                // Person already married, create new marriage for remarriage
                                newData.mariages = [...prev.mariages, [relPersonId, newId]];
                            } else {
                                newData.mariages = [...prev.mariages, [relPersonId, newId]];
                            }
                        } else if (relationship.type === 'child') {
                            // Find parent's marriage and add child
                            const marriageIndex = prev.mariages.findIndex(m => 
                                m[0] === relPersonId || m[1] === relPersonId
                            );
                            if (marriageIndex >= 0) {
                                const marriages = [...prev.mariages];
                                marriages[marriageIndex] = [...marriages[marriageIndex], newId];
                                newData.mariages = marriages;
                            } else {
                                // Create marriage with unknown spouse
                                const unknownId = String(Math.max(0, ...Object.keys(newData.people).map(Number)) + 1);
                                newData.people[unknownId] = {
                                    name: 'Unknown',
                                    surname: '',
                                    gender: '',
                                    events: [],
                                    photos: [],
                                    attachments: [],
                                    information: ''
                                };
                                newData.mariages = [...prev.mariages, [relPersonId, unknownId, newId]];
                            }
                        } else if (relationship.type === 'parent') {
                            // Find if child is already in a marriage as child
                            const marriageIndex = prev.mariages.findIndex(m => 
                                m.slice(2).includes(relPersonId)
                            );
                            if (marriageIndex >= 0) {
                                // Child already has parents, add as additional parent (step-parent scenario)
                                newData.mariages = [...prev.mariages, [newId, relPersonId]];
                            } else {
                                // Create new family unit
                                newData.mariages = [...prev.mariages, [newId, '', relPersonId].filter(Boolean)];
                            }
                        }
                    }
                    
                    return newData;
                });
                
                setSelectedPerson(newId);
            };

            const handleAddMarriage = (spouse1Id, spouse2Id) => {
                setTreeData(prev => ({
                    ...prev,
                    updatedAt: new Date().toISOString(),
                    mariages: [...prev.mariages, [spouse1Id, spouse2Id]]
                }));
            };

            const handleDeletePerson = (personId) => {
                if (!confirm('Are you sure you want to delete this person?')) return;
                
                setTreeData(prev => {
                    const newPeople = {...prev.people};
                    delete newPeople[personId];
                    
                    // Remove from marriages
                    const newMarriages = prev.mariages
                        .map(m => m.filter(id => id !== personId))
                        .filter(m => m.length >= 2); // Keep only valid marriages
                    
                    return {
                        ...prev,
                        updatedAt: new Date().toISOString(),
                        people: newPeople,
                        mariages: newMarriages
                    };
                });
                
                if (selectedPerson === personId) {
                    setSelectedPerson(null);
                }
            };

            const handleShareLink = () => {
                // Create a view-only link (would need backend in production)
                const viewOnlyUrl = window.location.href + '?view=true';
                navigator.clipboard.writeText(viewOnlyUrl);
                alert('View-only link copied to clipboard!');
            };

            // Welcome screen if no data loaded
            if (!treeData) {
                return (
                    <div className="app-container">
                        <div className="welcome-screen">
                            <div className="logo-icon" style={{width: '80px', height: '80px', fontSize: '40px', marginBottom: '24px'}}>
                                {Icons.tree}
                            </div>
                            <h1 className="welcome-title">Family Roots</h1>
                            <p className="welcome-subtitle">
                                Create beautiful, interactive family trees that capture the complex relationships 
                                of your family including remarriages, half-siblings, and step-families.
                            </p>
                            <div className="welcome-actions">
                                <button className="btn btn-primary" onClick={handleNewTree}>
                                    {Icons.plus} Create New Tree
                                </button>
                                <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
                                    {Icons.upload} Import JSON
                                </button>
                            </div>
                            <input 
                                ref={fileInputRef}
                                type="file" 
                                accept=".json"
                                style={{display: 'none'}}
                                onChange={handleFileUpload}
                            />
                        </div>
                    </div>
                );
            }

            return (
                <div className="app-container">
                    {/* Header */}
                    <header className="header">
                        <div className="logo">
                            <div className="logo-icon">{Icons.tree}</div>
                            <span className="logo-text">Family Roots</span>
                        </div>
                        
                        <div className="tree-name">{treeData.name}</div>
                        
                        <div className="header-actions">
                            {/* View Mode Toggle */}
                            <div className="view-mode-toggle">
                                <button 
                                    className={`view-mode-btn ${viewMode === 'fluid' ? 'active' : ''}`}
                                    onClick={() => setViewMode('fluid')}
                                >
                                    Fluid
                                </button>
                                <button 
                                    className={`view-mode-btn ${viewMode === 'strict' ? 'active' : ''}`}
                                    onClick={() => setViewMode('strict')}
                                >
                                    Strict
                                </button>
                            </div>
                            
                            {/* Edit Mode Toggle */}
                            <div className="toggle-container">
                                <span className="toggle-label">{isEditMode ? 'Edit Mode' : 'View Only'}</span>
                                <div 
                                    className={`toggle-switch ${isEditMode ? 'active' : ''}`}
                                    onClick={() => setIsEditMode(!isEditMode)}
                                />
                            </div>
                            
                            <button className="btn btn-ghost" onClick={handleShareLink}>
                                {Icons.share} Share
                            </button>
                            <button className="btn btn-secondary" onClick={handleDownload}>
                                {Icons.download} Export
                            </button>
                            <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
                                {Icons.upload} Import
                            </button>
                            <input 
                                ref={fileInputRef}
                                type="file" 
                                accept=".json"
                                style={{display: 'none'}}
                                onChange={handleFileUpload}
                            />
                        </div>
                    </header>

                    {/* Main Content */}
                    <div className="main-content">
                        {/* Sidebar - People List */}
                        <aside className="sidebar">
                            <div className="sidebar-header">
                                <h2 className="sidebar-title">Family Members</h2>
                                <div className="search-box">
                                    <span className="search-icon">{Icons.search}</span>
                                    <input 
                                        type="text"
                                        className="search-input"
                                        placeholder="Search people..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>
                            
                            <div className="people-list">
                                {filteredPeople.map(([personId, person]) => (
                                    <PersonListItem 
                                        key={personId}
                                        person={person}
                                        personId={personId}
                                        isSelected={selectedPerson === personId}
                                        onClick={setSelectedPerson}
                                    />
                                ))}
                                
                                {filteredPeople.length === 0 && (
                                    <div className="empty-state" style={{padding: '40px 20px'}}>
                                        <div className="empty-icon">{Icons.person}</div>
                                        <p className="empty-text">
                                            {searchQuery ? 'No people match your search' : 'No family members yet'}
                                        </p>
                                    </div>
                                )}
                            </div>
                            
                            {isEditMode && (
                                <div style={{padding: '16px', borderTop: '1px solid var(--border-subtle)'}}>
                                    <button 
                                        className="btn btn-primary" 
                                        style={{width: '100%', marginBottom: '8px'}}
                                        onClick={() => setShowAddPersonModal(true)}
                                    >
                                        {Icons.plus} Add Person
                                    </button>
                                    <button 
                                        className="btn btn-secondary" 
                                        style={{width: '100%'}}
                                        onClick={() => setShowAddMarriageModal(true)}
                                    >
                                        {Icons.marriage} Add Marriage
                                    </button>
                                </div>
                            )}
                        </aside>

                        {/* Tree Canvas */}
                        <main className="tree-canvas">
                            {Object.keys(treeData.people).length === 0 ? (
                                <div className="empty-state">
                                    <div className="empty-icon">{Icons.tree}</div>
                                    <h3 className="empty-title">Start Your Family Tree</h3>
                                    <p className="empty-text">
                                        Add your first family member to begin building your tree.
                                    </p>
                                    {isEditMode && (
                                        <button
                                            className="btn btn-primary"
                                            style={{marginTop: '24px'}}
                                            onClick={() => setShowAddPersonModal(true)}
                                        >
                                            {Icons.plus} Add First Person
                                        </button>
                                    )}
                                </div>
                            ) : viewMode === 'fluid' ? (
                                <FluidTreeView
                                    treeData={treeData}
                                    selectedPerson={selectedPerson}
                                    onSelectPerson={setSelectedPerson}
                                />
                            ) : (
                                <StrictTreeView
                                    treeData={treeData}
                                    selectedPerson={selectedPerson}
                                    onSelectPerson={setSelectedPerson}
                                />
                            )}
                        </main>

                        {/* Detail Panel */}
                        {selectedPerson && treeData.people[selectedPerson] && (
                            <DetailPanel 
                                person={treeData.people[selectedPerson]}
                                personId={selectedPerson}
                                treeData={treeData}
                                isEditMode={isEditMode}
                                onUpdate={handleUpdatePerson}
                                onClose={() => setSelectedPerson(null)}
                                onSelectPerson={setSelectedPerson}
                            />
                        )}
                    </div>

                    {/* Modals */}
                    <AddPersonModal 
                        isOpen={showAddPersonModal}
                        onClose={() => setShowAddPersonModal(false)}
                        onAdd={handleAddPerson}
                        treeData={treeData}
                    />
                    <AddMarriageModal 
                        isOpen={showAddMarriageModal}
                        onClose={() => setShowAddMarriageModal(false)}
                        onAdd={handleAddMarriage}
                        treeData={treeData}
                    />
                </div>
            );
        };

        // Render the app
        ReactDOM.render(<FamilyTreeApp />, document.getElementById('root'));
        window.__FAMILY_TREE_APP_READY__?.();
