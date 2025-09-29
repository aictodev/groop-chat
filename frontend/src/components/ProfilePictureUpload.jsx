import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '../AuthContext';

const ProfilePictureUpload = ({ user, onAvatarUpdate, className = '' }) => {
    const [uploading, setUploading] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url);
    const fileInputRef = useRef(null);
    const { session } = useAuth();

    const handleFileSelect = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            alert('File size must be less than 5MB');
            return;
        }

        setUploading(true);

        try {
            const formData = new FormData();
            formData.append('avatar', file);

            const response = await fetch('http://localhost:7001/api/profile/avatar', {
                method: 'POST',
                body: formData,
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to upload image');
            }

            const result = await response.json();
            const fullUrl = `http://localhost:7001${result.avatarUrl}`;
            setAvatarUrl(fullUrl);

            if (onAvatarUpdate) {
                onAvatarUpdate(result.avatarUrl);
            }

        } catch (error) {
            console.error('Error uploading profile picture:', error);
            alert('Failed to upload profile picture. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className={`flex flex-col items-center gap-3 ${className}`}>
            <div className="relative cursor-pointer" onClick={handleAvatarClick}>
                <Avatar className="h-24 w-24 border-4 border-whatsapp-accent shadow-panel">
                    {avatarUrl ? (
                        <AvatarImage src={avatarUrl} alt="Profile" className="object-cover" />
                    ) : (
                        <AvatarFallback className="bg-whatsapp-accent text-white text-lg font-semibold">
                            {user?.email?.charAt(0).toUpperCase() || 'U'}
                        </AvatarFallback>
                    )}
                </Avatar>

                <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 transition-opacity duration-150 hover:opacity-100 flex items-center justify-center">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-7 w-7 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                        />
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                    </svg>
                </div>

                {uploading && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/70">
                        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-white" />
                    </div>
                )}
            </div>

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
            />

            <Button
                onClick={handleAvatarClick}
                variant="whatsapp-secondary"
                size="sm"
                disabled={uploading}
                className="px-4"
            >
                {uploading ? 'Uploading…' : 'Change photo'}
            </Button>
        </div>
    );
};

export default ProfilePictureUpload;
