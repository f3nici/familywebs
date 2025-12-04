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
            list: '☰',
            grid: '⊞',
            eye: '👁',
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

            if (!isOpen) return null;

            const handleSubmit = () => {
                const person = {
                    ...newPerson,
                    events: birthDate ? [{ type: '$_BIRTH', dateStart: birthDate, comment: '' }] : []
                };
                onAdd(person, { type: '', personId: '' });
                setNewPerson({ name: '', surname: '', gender: '', events: [], information: '', photos: [], attachments: [] });
                setBirthDate('');
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
            const [selectedChildren, setSelectedChildren] = useState([]);
            const [spouse1Search, setSpouse1Search] = useState('');
            const [spouse2Search, setSpouse2Search] = useState('');
            const [childrenSearch, setChildrenSearch] = useState('');

            // Filter people based on search
            const filteredSpouse1Options = useMemo(() => {
                return Object.entries(treeData.people).filter(([id, person]) => {
                    const fullName = `${person.name} ${person.surname}`.toLowerCase();
                    return fullName.includes(spouse1Search.toLowerCase());
                });
            }, [treeData.people, spouse1Search]);

            const filteredSpouse2Options = useMemo(() => {
                return Object.entries(treeData.people)
                    .filter(([id]) => id !== spouse1)
                    .filter(([id, person]) => {
                        const fullName = `${person.name} ${person.surname}`.toLowerCase();
                        return fullName.includes(spouse2Search.toLowerCase());
                    });
            }, [treeData.people, spouse1, spouse2Search]);

            const filteredChildrenOptions = useMemo(() => {
                return Object.entries(treeData.people)
                    .filter(([id]) => id !== spouse1 && id !== spouse2)
                    .filter(([id, person]) => {
                        const fullName = `${person.name} ${person.surname}`.toLowerCase();
                        return fullName.includes(childrenSearch.toLowerCase());
                    });
            }, [treeData.people, spouse1, spouse2, childrenSearch]);

            if (!isOpen) return null;

            const handleSubmit = () => {
                if (spouse1 && spouse2 && spouse1 !== spouse2) {
                    onAdd(spouse1, spouse2, selectedChildren);
                    setSpouse1('');
                    setSpouse2('');
                    setSelectedChildren([]);
                    setSpouse1Search('');
                    setSpouse2Search('');
                    setChildrenSearch('');
                    onClose();
                }
            };

            const toggleChild = (childId) => {
                setSelectedChildren(prev =>
                    prev.includes(childId)
                        ? prev.filter(id => id !== childId)
                        : [...prev, childId]
                );
            };

            return (
                <div className="modal-overlay" onClick={onClose}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Add Relationship</h2>
                            <button className="btn btn-ghost btn-icon" onClick={onClose}>
                                {Icons.close}
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">First Partner</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Search first partner..."
                                    value={spouse1Search}
                                    onChange={(e) => setSpouse1Search(e.target.value)}
                                    style={{marginBottom: '8px'}}
                                />
                                <select
                                    className="form-input form-select"
                                    value={spouse1}
                                    onChange={(e) => setSpouse1(e.target.value)}
                                    size="5"
                                >
                                    <option value="">Select person...</option>
                                    {filteredSpouse1Options.map(([id, person]) => (
                                        <option key={id} value={id}>
                                            {person.name} {person.surname}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Second Partner</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Search second partner..."
                                    value={spouse2Search}
                                    onChange={(e) => setSpouse2Search(e.target.value)}
                                    style={{marginBottom: '8px'}}
                                />
                                <select
                                    className="form-input form-select"
                                    value={spouse2}
                                    onChange={(e) => setSpouse2(e.target.value)}
                                    size="5"
                                >
                                    <option value="">Select person...</option>
                                    {filteredSpouse2Options.map(([id, person]) => (
                                        <option key={id} value={id}>
                                            {person.name} {person.surname}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div style={{marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border-subtle)'}}>
                                <h4 style={{fontFamily: 'var(--font-display)', marginBottom: '16px'}}>
                                    Children (Optional)
                                </h4>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Search children..."
                                    value={childrenSearch}
                                    onChange={(e) => setChildrenSearch(e.target.value)}
                                    style={{marginBottom: '8px'}}
                                />
                                <div style={{maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '8px'}}>
                                    {filteredChildrenOptions.map(([id, person]) => (
                                        <label key={id} style={{display: 'flex', alignItems: 'center', padding: '8px', cursor: 'pointer', borderRadius: '4px', marginBottom: '4px', backgroundColor: selectedChildren.includes(id) ? 'var(--bg-selected)' : 'transparent'}}>
                                            <input
                                                type="checkbox"
                                                checked={selectedChildren.includes(id)}
                                                onChange={() => toggleChild(id)}
                                                style={{marginRight: '8px'}}
                                            />
                                            <span>{person.name} {person.surname}</span>
                                        </label>
                                    ))}
                                    {filteredChildrenOptions.length === 0 && (
                                        <p style={{color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px'}}>
                                            {childrenSearch ? 'No people match your search' : 'No other people available to select as children'}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                            <button
                                className="btn btn-primary"
                                onClick={handleSubmit}
                                disabled={!spouse1 || !spouse2}
                            >
                                Add Relationship
                            </button>
                        </div>
                    </div>
                </div>
            );
        };

        // Delete Person Modal
        const DeletePersonModal = ({ isOpen, onClose, onDelete, treeData }) => {
            const [searchQuery, setSearchQuery] = useState('');
            const [selectedPerson, setSelectedPerson] = useState('');

            const filteredPeople = useMemo(() => {
                return Object.entries(treeData.people).filter(([id, person]) => {
                    const fullName = `${person.name} ${person.surname}`.toLowerCase();
                    return fullName.includes(searchQuery.toLowerCase());
                });
            }, [treeData.people, searchQuery]);

            if (!isOpen) return null;

            const handleSubmit = () => {
                if (selectedPerson) {
                    onDelete(selectedPerson);
                    setSelectedPerson('');
                    setSearchQuery('');
                    onClose();
                }
            };

            return (
                <div className="modal-overlay" onClick={onClose}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Delete Person</h2>
                            <button className="btn btn-ghost btn-icon" onClick={onClose}>
                                {Icons.close}
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Search Person</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Search person to delete..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{marginBottom: '8px'}}
                                />
                                <select
                                    className="form-input form-select"
                                    value={selectedPerson}
                                    onChange={(e) => setSelectedPerson(e.target.value)}
                                    size="10"
                                    style={{minHeight: '200px'}}
                                >
                                    <option value="">Select person to delete...</option>
                                    {filteredPeople.map(([id, person]) => (
                                        <option key={id} value={id}>
                                            {person.name} {person.surname}
                                        </option>
                                    ))}
                                </select>
                                {filteredPeople.length === 0 && searchQuery && (
                                    <p style={{color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '8px'}}>
                                        No people match your search
                                    </p>
                                )}
                            </div>
                            {selectedPerson && (
                                <div style={{padding: '12px', backgroundColor: 'var(--bg-warning)', borderRadius: '8px', marginTop: '16px'}}>
                                    <p style={{color: 'var(--text-warning)', fontWeight: '500'}}>
                                        ⚠️ Warning: This will permanently delete this person and remove them from all relationships.
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                            <button
                                className="btn btn-danger"
                                onClick={handleSubmit}
                                disabled={!selectedPerson}
                                style={{backgroundColor: '#dc2626', color: 'white'}}
                            >
                                {Icons.trash} Delete Person
                            </button>
                        </div>
                    </div>
                </div>
            );
        };

        // Delete Relationship Modal
        const DeleteRelationshipModal = ({ isOpen, onClose, onDelete, treeData }) => {
            const [searchQuery, setSearchQuery] = useState('');
            const [selectedRelationship, setSelectedRelationship] = useState(-1);

            const relationshipsList = useMemo(() => {
                return treeData.mariages.map((marriage, index) => {
                    if (marriage.length < 2) return null;

                    const parents = marriage.slice(0, 2);
                    const children = marriage.slice(2);

                    const parent1 = treeData.people[parents[0]];
                    const parent2 = treeData.people[parents[1]];

                    const parent1Name = parent1 ? `${parent1.name} ${parent1.surname}` : 'Unknown';
                    const parent2Name = parent2 ? `${parent2.name} ${parent2.surname}` : 'Unknown';

                    const childrenNames = children
                        .map(childId => {
                            const child = treeData.people[childId];
                            return child ? `${child.name} ${child.surname}` : 'Unknown';
                        })
                        .join(', ');

                    const displayText = `${parent1Name} & ${parent2Name}${childrenNames ? ` (Children: ${childrenNames})` : ''}`;

                    return {
                        index,
                        displayText,
                        searchText: displayText.toLowerCase()
                    };
                }).filter(Boolean);
            }, [treeData]);

            const filteredRelationships = useMemo(() => {
                return relationshipsList.filter(rel =>
                    rel.searchText.includes(searchQuery.toLowerCase())
                );
            }, [relationshipsList, searchQuery]);

            if (!isOpen) return null;

            const handleSubmit = () => {
                if (selectedRelationship >= 0) {
                    onDelete(selectedRelationship);
                    setSelectedRelationship(-1);
                    setSearchQuery('');
                    onClose();
                }
            };

            return (
                <div className="modal-overlay" onClick={onClose}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Delete Relationship</h2>
                            <button className="btn btn-ghost btn-icon" onClick={onClose}>
                                {Icons.close}
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Search Relationship</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Search relationship to delete..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{marginBottom: '8px'}}
                                />
                                <select
                                    className="form-input form-select"
                                    value={selectedRelationship}
                                    onChange={(e) => setSelectedRelationship(Number(e.target.value))}
                                    size="10"
                                    style={{minHeight: '200px'}}
                                >
                                    <option value="-1">Select relationship to delete...</option>
                                    {filteredRelationships.map(rel => (
                                        <option key={rel.index} value={rel.index}>
                                            {rel.displayText}
                                        </option>
                                    ))}
                                </select>
                                {filteredRelationships.length === 0 && searchQuery && (
                                    <p style={{color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '8px'}}>
                                        No relationships match your search
                                    </p>
                                )}
                                {relationshipsList.length === 0 && (
                                    <p style={{color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '8px'}}>
                                        No relationships to delete
                                    </p>
                                )}
                            </div>
                            {selectedRelationship >= 0 && (
                                <div style={{padding: '12px', backgroundColor: 'var(--bg-warning)', borderRadius: '8px', marginTop: '16px'}}>
                                    <p style={{color: 'var(--text-warning)', fontWeight: '500'}}>
                                        ⚠️ Warning: This will permanently delete this relationship. People will not be deleted.
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                            <button
                                className="btn btn-danger"
                                onClick={handleSubmit}
                                disabled={selectedRelationship < 0}
                                style={{backgroundColor: '#dc2626', color: 'white'}}
                            >
                                {Icons.trash} Delete Relationship
                            </button>
                        </div>
                    </div>
                </div>
            );
        };

        // OLD Fluid Tree View - Simple grid layout (replaced with FluidTreeWithReactFlow)
        // Kept here for reference, but no longer used in the main app
        /*
        const FluidTreeView = ({ treeData, selectedPerson, onSelectPerson, isEditMode }) => {
            const sortedPeople = useMemo(() => {
                return Object.entries(treeData.people).sort((a, b) => {
                    const birthA = a[1].events?.find(e => e.type === '$_BIRTH')?.dateStart || '9999';
                    const birthB = b[1].events?.find(e => e.type === '$_BIRTH')?.dateStart || '9999';
                    return birthA.localeCompare(birthB);
                });
            }, [treeData.people]);

            return (
                <div className="fluid-tree">
                    {sortedPeople.map(([personId, person]) => (
                        <PersonCard
                            key={personId}
                            person={person}
                            personId={personId}
                            isSelected={selectedPerson === personId}
                            onClick={onSelectPerson}
                            isEditMode={isEditMode}
                            compact={true}
                        />
                    ))}
                </div>
            );
        };
        */

        // NOTE: Now using FluidTreeWithReactFlow component from FluidTreeWithReactFlow.js
        // which provides relationship lines, marriage nodes, and Web Mode functionality
        const FluidTreeWithReactFlow = window.FluidTreeWithReactFlow;
        const GenerationalView = window.GenerationalView;

        // Main App Component
        const FamilyTreeApp = () => {
            const [treeData, setTreeData] = useState(null);
            const [isEditMode, setIsEditMode] = useState(true);
            const [selectedPerson, setSelectedPerson] = useState(null);
            const [searchQuery, setSearchQuery] = useState('');
            const [showAddPersonModal, setShowAddPersonModal] = useState(false);
            const [showAddMarriageModal, setShowAddMarriageModal] = useState(false);
            const [showDeletePersonModal, setShowDeletePersonModal] = useState(false);
            const [showDeleteRelationshipModal, setShowDeleteRelationshipModal] = useState(false);
            const [viewMode, setViewMode] = useState('web'); // 'web' or 'generational'

            const fileInputRef = useRef(null);
            const getNodePositionsRef = useRef(null); // Callback to get current node positions from FluidTree

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

                // Get current node positions from FluidTreeWithReactFlow
                let dataToExport = { ...treeData };
                if (getNodePositionsRef.current) {
                    const nodePositions = getNodePositionsRef.current();
                    if (nodePositions && nodePositions.length > 0) {
                        // Save node positions to viewState
                        dataToExport.viewState = {
                            nodes: nodePositions.map(node => ({
                                id: node.id,
                                x: node.position.x,
                                y: node.position.y
                            }))
                        };
                    }
                }

                const dataStr = JSON.stringify(dataToExport, null, 2);
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

            const handleAddMarriage = (spouse1Id, spouse2Id, children = []) => {
                setTreeData(prev => ({
                    ...prev,
                    updatedAt: new Date().toISOString(),
                    mariages: [...prev.mariages, [spouse1Id, spouse2Id, ...children]]
                }));
            };

            const handleDeletePerson = (personId) => {
                if (!confirm('Are you sure you want to delete this person?')) return;

                setTreeData(prev => {
                    const newPeople = {...prev.people};
                    delete newPeople[personId];

                    // Remove from marriages
                    // Marriage structure: [parent1, parent2, child1, child2, ...]
                    // If person is a parent (first two positions), remove entire relationship
                    // If person is a child, just remove them from the relationship
                    const newMarriages = prev.mariages
                        .filter(m => {
                            // If person is one of the parents (first two positions), remove entire relationship
                            if (m[0] === personId || m[1] === personId) {
                                return false;
                            }
                            return true;
                        })
                        .map(m => m.filter(id => id !== personId)); // Remove person if they're a child

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

            const handleDeleteRelationship = (relationshipIndex) => {
                if (!confirm('Are you sure you want to delete this relationship?')) return;

                setTreeData(prev => {
                    const newMarriages = [...prev.mariages];
                    newMarriages.splice(relationshipIndex, 1);

                    return {
                        ...prev,
                        updatedAt: new Date().toISOString(),
                        mariages: newMarriages
                    };
                });
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
                            <div className="view-mode-tabs">
                                <button
                                    className={`view-tab ${viewMode === 'web' ? 'active' : ''}`}
                                    onClick={() => setViewMode('web')}
                                >
                                    🕸️ Web View
                                </button>
                                <button
                                    className={`view-tab ${viewMode === 'generational' ? 'active' : ''}`}
                                    onClick={() => setViewMode('generational')}
                                >
                                    👥 Generational View
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
                                        style={{width: '100%', marginBottom: '8px'}}
                                        onClick={() => setShowAddMarriageModal(true)}
                                    >
                                        {Icons.marriage} Add Relationship
                                    </button>
                                    <button
                                        className="btn btn-secondary"
                                        style={{width: '100%', marginBottom: '8px'}}
                                        onClick={() => setShowDeletePersonModal(true)}
                                    >
                                        {Icons.trash} Delete Person
                                    </button>
                                    <button
                                        className="btn btn-secondary"
                                        style={{width: '100%'}}
                                        onClick={() => setShowDeleteRelationshipModal(true)}
                                    >
                                        {Icons.trash} Delete Relationship
                                    </button>
                                </div>
                            )}
                        </aside>

                        {/* Tree Canvas */}
                        <main className="tree-canvas">
                            {Object.keys(treeData.people).length > 0 ? (
                                viewMode === 'web' ? (
                                    <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
                                        <FluidTreeWithReactFlow
                                            treeData={treeData}
                                            selectedPerson={selectedPerson}
                                            onSelectPerson={setSelectedPerson}
                                            getNodePositionsRef={getNodePositionsRef}
                                        />
                                    </div>
                                ) : (
                                    <div style={{ width: '100%', height: '100%', overflow: 'auto' }}>
                                        <GenerationalView
                                            treeData={treeData}
                                            selectedPerson={selectedPerson}
                                            onSelectPerson={setSelectedPerson}
                                        />
                                    </div>
                                )
                            ) : (
                                <div className="tree-viewport">
                                    <div className="tree-content">
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
                                    </div>
                                </div>
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
                    <DeletePersonModal
                        isOpen={showDeletePersonModal}
                        onClose={() => setShowDeletePersonModal(false)}
                        onDelete={handleDeletePerson}
                        treeData={treeData}
                    />
                    <DeleteRelationshipModal
                        isOpen={showDeleteRelationshipModal}
                        onClose={() => setShowDeleteRelationshipModal(false)}
                        onDelete={handleDeleteRelationship}
                        treeData={treeData}
                    />
                </div>
            );
        };

        // Render the app
        ReactDOM.render(<FamilyTreeApp />, document.getElementById('root'));
        window.__FAMILY_TREE_APP_READY__?.();
