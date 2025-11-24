import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '../AuthContext';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:7001';

const EditableDisplayName = ({ displayName, onDisplayNameUpdate, className = '' }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempDisplayName, setTempDisplayName] = useState(displayName || '');
    const [saving, setSaving] = useState(false);
    const { session } = useAuth();

    const handleSave = async () => {
        if (!tempDisplayName.trim()) {
            alert('Display name cannot be empty');
            return;
        }

        if (tempDisplayName.length > 100) {
            alert('Display name must be less than 100 characters');
            return;
        }

        setSaving(true);

        try {
            const response = await fetch(`${BACKEND_URL}/api/profile/display-name`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ displayName: tempDisplayName.trim() })
            });

            if (!response.ok) {
                throw new Error('Failed to update display name');
            }

            const result = await response.json();

            if (onDisplayNameUpdate) {
                onDisplayNameUpdate(result.displayName);
            }

            setIsEditing(false);
        } catch (error) {
            console.error('Error updating display name:', error);
            alert('Failed to update display name. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setTempDisplayName(displayName || '');
        setIsEditing(false);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            handleCancel();
        }
    };

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            {isEditing ? (
                <>
                    <input
                        type="text"
                        value={tempDisplayName}
                        onChange={(e) => setTempDisplayName(e.target.value)}
                        onKeyDown={handleKeyPress}
                        className="w-full max-w-xs rounded-lg border border-whatsapp-divider bg-whatsapp-surface px-3 py-2 text-sm text-whatsapp-ink shadow-sm focus:border-whatsapp-accent focus:outline-none disabled:opacity-50"
                        placeholder="Enter display name"
                        disabled={saving}
                        autoFocus
                        maxLength={100}
                    />
                    <Button
                        onClick={handleSave}
                        size="sm"
                        variant="whatsapp"
                        disabled={saving}
                        className="px-3"
                    >
                        {saving ? 'Saving…' : 'Save'}
                    </Button>
                    <Button
                        onClick={handleCancel}
                        size="sm"
                        variant="whatsapp-secondary"
                        disabled={saving}
                        className="px-3"
                    >
                        Cancel
                    </Button>
                </>
            ) : (
                <>
                    <span className="text-sm text-whatsapp-ink">
                        {displayName || 'Not set'}
                    </span>
                    <Button
                        onClick={() => setIsEditing(true)}
                        size="sm"
                        variant="whatsapp-secondary"
                        className="px-3"
                    >
                        Edit
                    </Button>
                </>
            )}
        </div>
    );
};

export default EditableDisplayName;
