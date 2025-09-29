import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '../AuthContext';

const ConversationImageManager = ({ conversationId, currentImageUrl, onImageUpdate, className = '' }) => {
    const [uploading, setUploading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const fileInputRef = useRef(null);
    const { session } = useAuth();

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        // Validate file size (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
            alert('File size must be less than 5MB');
            return;
        }

        setUploading(true);

        try {
            const formData = new FormData();
            formData.append('avatar', file);

            const response = await fetch(`http://localhost:7001/api/conversations/${conversationId}/avatar`, {
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

            if (onImageUpdate) {
                onImageUpdate(fullUrl);
            }

        } catch (error) {
            console.error('Error uploading conversation image:', error);
            alert('Failed to upload conversation image. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    const handleGenerateAIImage = async () => {
        if (!conversationId) {
            alert('No conversation selected');
            return;
        }

        setGenerating(true);

        try {
            const response = await fetch(`http://localhost:7001/api/conversations/${conversationId}/generate-avatar`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to generate AI image');
            }

            const result = await response.json();
            const fullUrl = `http://localhost:7001${result.avatarUrl}`;

            if (onImageUpdate) {
                onImageUpdate(fullUrl);
            }

            // Show the AI prompt that was used
            if (result.prompt) {
                console.log('AI Image Prompt:', result.prompt);
            }

        } catch (error) {
            console.error('Error generating AI image:', error);
            alert('Failed to generate AI image. Please try again.');
        } finally {
            setGenerating(false);
        }
    };

    const handleRemoveImage = async () => {
        if (!conversationId) return;

        try {
            // Update conversation to remove avatar
            await fetch(`http://localhost:7001/api/conversations/${conversationId}/avatar`, {
                method: 'POST',
                body: JSON.stringify({ remove: true }),
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (onImageUpdate) {
                onImageUpdate(null);
            }

        } catch (error) {
            console.error('Error removing conversation image:', error);
            alert('Failed to remove conversation image. Please try again.');
        }
    };

    return (
        <div className={className}>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-white hover:bg-white/10"
                        disabled={uploading || generating}
                    >
                        {uploading || generating ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4"
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
                        )}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem
                        onClick={() => fileInputRef.current?.click()}
                        className="cursor-pointer"
                    >
                        📁 Upload Image
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={handleGenerateAIImage}
                        className="cursor-pointer"
                        disabled={generating}
                    >
                        🎨 Generate AI Image
                    </DropdownMenuItem>
                    {currentImageUrl && (
                        <DropdownMenuItem
                            onClick={handleRemoveImage}
                            className="cursor-pointer text-red-600"
                        >
                            🗑️ Remove Image
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
            />
        </div>
    );
};

export default ConversationImageManager;
