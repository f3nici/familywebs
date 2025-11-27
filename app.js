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

        // Person Card Component
        const PersonCard = ({ person, personId, isSelected, onClick, isEditMode, compact = false }) => {
            const birthEvent = person.events?.find(e => e.type === '$_BIRTH');
            const deathEvent = person.events?.find(e => e.type === '$_DEATH');
            const isDeceased = !!deathEvent;
            
            const avatarClass = person.gender === 'MALE' ? 'avatar-male' : 
                              person.gender === 'FEMALE' ? 'avatar-female' : 'avatar-other';

            return (
                <div 
                    className={`tree-node ${isSelected ? 'selected' : ''} ${isDeceased ? 'deceased' : ''}`}
                    onClick={() => onClick(personId)}
                    style={compact ? { minWidth: '140px', padding: '16px 20px' } : {}}
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

        const computeGenerations = (treeData) => {
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

            Object.keys(people).forEach(id => {
                if (!visited.has(id)) {
                    personGenerations[id] = 0;
                }
            });

            return personGenerations;
        };

        const RelationshipGraph = ({ treeData, selectedPerson, onSelectPerson, viewMode, onRegisterZoom }) => {
            const svgRef = useRef(null);
            const containerRef = useRef(null);
            const zoomRef = useRef(null);
            const simulationRef = useRef(null);

            useEffect(() => {
                if (!treeData || !containerRef.current || !svgRef.current || !window.d3) return;

                const d3Ref = window.d3;
                const width = containerRef.current.clientWidth;
                const height = containerRef.current.clientHeight;

                const generations = computeGenerations(treeData);
                const nodes = [];
                const links = [];

                Object.entries(treeData.people).forEach(([id, person]) => {
                    nodes.push({ id, type: 'person', person, level: generations[id] || 0 });
                });

                treeData.mariages.forEach((marriage, index) => {
                    if (marriage.length < 2) return;
                    const marriageId = `marriage-${index}`;
                    const parentA = marriage[0];
                    const parentB = marriage[1];
                    const children = marriage.slice(2);
                    const level = Math.min(generations[parentA] || 0, generations[parentB] || 0);

                    nodes.push({ id: marriageId, type: 'marriage', level });

                    links.push({ source: parentA, target: marriageId, type: 'partner' });
                    links.push({ source: parentB, target: marriageId, type: 'partner' });

                    children.forEach(childId => {
                        links.push({ source: marriageId, target: childId, type: 'child' });
                    });
                });

                const svg = d3Ref.select(svgRef.current);
                svg.selectAll('*').remove();

                const g = svg.append('g').attr('class', 'graph-layer');

                zoomRef.current = d3Ref.zoom()
                    .scaleExtent([0.4, 2.5])
                    .on('zoom', (event) => {
                        g.attr('transform', event.transform);
                    });

                svg.call(zoomRef.current);

                if (onRegisterZoom) {
                    onRegisterZoom({
                        zoomIn: () => svg.transition().duration(200).call(zoomRef.current.scaleBy, 1.15),
                        zoomOut: () => svg.transition().duration(200).call(zoomRef.current.scaleBy, 0.85),
                        reset: () => svg.transition().duration(250).call(
                            zoomRef.current.transform,
                            d3Ref.zoomIdentity.translate(width / 2, height / 2).scale(viewMode === 'strict' ? 0.9 : 0.8)
                        ),
                    });
                }

                simulationRef.current?.stop();
                simulationRef.current = d3Ref.forceSimulation(nodes)
                    .force('link', d3Ref.forceLink(links).id(d => d.id).distance(link => {
                        if (link.type === 'partner') return 90;
                        return viewMode === 'strict' ? 140 : 180;
                    }).strength(link => link.type === 'partner' ? 1 : 0.8))
                    .force('charge', d3Ref.forceManyBody().strength(-500))
                    .force('collide', d3Ref.forceCollide().radius(d => d.type === 'person' ? 70 : 24).strength(0.8))
                    .force('center', d3Ref.forceCenter(width / 2, height / 2));

                if (viewMode === 'strict') {
                    simulationRef.current
                        .force('y', d3Ref.forceY(d => (d.level || 0) * 180 + 60).strength(1))
                        .force('x', d3Ref.forceX(width / 2).strength(0.04));
                } else {
                    simulationRef.current
                        .force('y', d3Ref.forceY(height / 2).strength(0.05))
                        .force('x', d3Ref.forceX(width / 2).strength(0.05));
                }

                const link = g.append('g')
                    .attr('stroke-linecap', 'round')
                    .selectAll('line')
                    .data(links)
                    .enter()
                    .append('line')
                    .attr('class', d => `connection-line ${d.type === 'partner' ? 'partner' : d.type === 'child' ? 'parent-child' : ''}`)
                    .attr('stroke-opacity', 0.9);

                const drag = simulation => {
                    function dragstarted(event, d) {
                        if (!event.active) simulation.alphaTarget(0.3).restart();
                        d.fx = d.x;
                        d.fy = d.y;
                    }

                    function dragged(event, d) {
                        d.fx = event.x;
                        d.fy = event.y;
                    }

                    function dragended(event, d) {
                        if (!event.active) simulation.alphaTarget(0);
                        d.fx = null;
                        d.fy = null;
                    }

                    return d3Ref.drag()
                        .on('start', dragstarted)
                        .on('drag', dragged)
                        .on('end', dragended);
                };

                const node = g.append('g')
                    .selectAll('g')
                    .data(nodes)
                    .enter()
                    .append('g')
                    .attr('class', 'graph-node')
                    .call(drag(simulationRef.current));

                node.filter(d => d.type === 'marriage')
                    .append('circle')
                    .attr('r', 10)
                    .attr('class', 'marriage-node');

                const personNodes = node.filter(d => d.type === 'person');
                personNodes
                    .append('foreignObject')
                    .attr('x', -90)
                    .attr('y', -70)
                    .attr('width', 180)
                    .attr('height', 140)
                    .html(d => {
                        const person = d.person;
                        const birthEvent = person.events?.find(e => e.type === '$_BIRTH');
                        const deathEvent = person.events?.find(e => e.type === '$_DEATH');
                        const avatarClass = person.gender === 'MALE' ? 'avatar-male' :
                            person.gender === 'FEMALE' ? 'avatar-female' : 'avatar-other';
                        const isDeceased = !!deathEvent;
                        const selectedClass = selectedPerson === d.id ? 'selected' : '';

                        return `
                            <div class="tree-node ${selectedClass} ${isDeceased ? 'deceased' : ''}" data-person-id="${d.id}">
                                <div class="node-avatar ${avatarClass}">${getInitials(person.name)}</div>
                                <div class="node-name">${person.name}</div>
                                <div class="node-surname">${person.surname || ''}</div>
                                <div class="node-dates">
                                    ${birthEvent?.dateStart ? formatDate(birthEvent.dateStart) : ''}
                                    ${birthEvent?.dateStart && deathEvent?.dateStart ? ' — ' : ''}
                                    ${deathEvent?.dateStart ? formatDate(deathEvent.dateStart) : ''}
                                </div>
                            </div>
                        `;
                    })
                    .on('click', (_, d) => {
                        onSelectPerson?.(d.id);
                    });

                if (viewMode === 'strict') {
                    const maxLevel = Math.max(...nodes.filter(n => n.type === 'person').map(n => n.level || 0), 0);
                    const labels = Array.from({ length: maxLevel + 1 }, (_, i) => i);
                    g.append('g')
                        .selectAll('text')
                        .data(labels)
                        .enter()
                        .append('text')
                        .attr('class', 'graph-label')
                        .attr('x', 24 - width / 2)
                        .attr('y', level => (level * 180) + 12)
                        .text(level => `Generation ${level + 1}`)
                        .attr('transform', `translate(${width / 2}, 0)`);
                }

                simulationRef.current.on('tick', () => {
                    link
                        .attr('x1', d => d.source.x)
                        .attr('y1', d => d.source.y)
                        .attr('x2', d => d.target.x)
                        .attr('y2', d => d.target.y);

                    node.attr('transform', d => `translate(${d.x},${d.y})`);
                });

                svg.call(zoomRef.current.transform, d3Ref.zoomIdentity.translate(width / 2, height / 2).scale(viewMode === 'strict' ? 0.9 : 0.8));

                return () => {
                    simulationRef.current?.stop();
                };
            }, [treeData, viewMode, selectedPerson, onSelectPerson, onRegisterZoom]);

            return (
                <div className="graph-container" ref={containerRef}>
                    <svg ref={svgRef} className="graph-svg" />
                </div>
            );
        };

        // Main App Component
        const FamilyTreeApp = () => {
            const [treeData, setTreeData] = useState(null);
            const [isEditMode, setIsEditMode] = useState(true);
            const [viewMode, setViewMode] = useState('fluid'); // 'fluid' or 'strict'
            const [selectedPerson, setSelectedPerson] = useState(null);
            const [searchQuery, setSearchQuery] = useState('');
            const [showAddPersonModal, setShowAddPersonModal] = useState(false);
            const [showAddMarriageModal, setShowAddMarriageModal] = useState(false);
            const zoomApiRef = useRef({});
            
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
                            <div className="tree-viewport">
                                <div className="tree-content">
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
                                    ) : (
                                        <RelationshipGraph
                                            treeData={treeData}
                                            selectedPerson={selectedPerson}
                                            onSelectPerson={setSelectedPerson}
                                            viewMode={viewMode}
                                            onRegisterZoom={(api) => { zoomApiRef.current = api; }}
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Zoom Controls */}
                            <div className="zoom-controls">
                                <button className="zoom-btn" onClick={() => zoomApiRef.current?.zoomIn?.()}>
                                    {Icons.zoomIn}
                                </button>
                                <div className="zoom-divider" />
                                <button className="zoom-btn" onClick={() => zoomApiRef.current?.reset?.()}>
                                    {Icons.reset}
                                </button>
                                <div className="zoom-divider" />
                                <button className="zoom-btn" onClick={() => zoomApiRef.current?.zoomOut?.()}>
                                    {Icons.zoomOut}
                                </button>
                            </div>
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
