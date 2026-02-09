'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateProfile } from '@/app/actions';
import { toast } from 'sonner';
import { Loader2, Plus, X } from 'lucide-react';

export default function ProfileForm({ user }: { user: any }) {
    const [fullName, setFullName] = useState(user.fullName || '');
    const [email, setEmail] = useState(user.email || '');
    // Parse initial bio into array of strings
    const [specialties, setSpecialties] = useState<string[]>(
        user.bio ? user.bio.split(',').map((s: string) => s.trim()).filter(Boolean) : []
    );
    const [newSpecialty, setNewSpecialty] = useState('');
    
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const addSpecialty = () => {
        if (newSpecialty.trim()) {
            if (!specialties.includes(newSpecialty.trim())) {
                setSpecialties([...specialties, newSpecialty.trim()]);
            }
            setNewSpecialty('');
        }
    };

    const removeSpecialty = (index: number) => {
        setSpecialties(specialties.filter((_, i) => i !== index));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addSpecialty();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (password !== confirmPassword) {
            toast.error("Passwords don't match");
            return;
        }

        // Include any pending specialty in the input field
        const finalSpecialties = [...specialties];
        if (newSpecialty.trim() && !specialties.includes(newSpecialty.trim())) {
            finalSpecialties.push(newSpecialty.trim());
        }

        setIsSaving(true);
        try {
            await updateProfile({
                fullName,
                email,
                bio: finalSpecialties.join(', '),
                password: password || undefined
            });
            toast.success('Profile updated successfully');
            setPassword('');
            setConfirmPassword('');
            setNewSpecialty('');
            setSpecialties(finalSpecialties);
        } catch (e: any) {
            toast.error(e.message || 'Failed to update profile');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card className="max-w-xl mx-auto">
            <CardHeader>
                <CardTitle>My Profile</CardTitle>
                <CardDescription>Update your account information</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input id="username" value={user.username} disabled className="bg-slate-100" />
                        <p className="text-xs text-muted-foreground">Username cannot be changed.</p>
                    </div>
                    
                    <div className="space-y-2">
                        <Label htmlFor="fullName">Full Name</Label>
                        <Input 
                            id="fullName" 
                            value={fullName} 
                            onChange={(e) => setFullName(e.target.value)} 
                            required 
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input 
                            id="email" 
                            type="email" 
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)} 
                            required 
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Specialties / Topics</Label>
                        <div className="flex gap-2">
                            <Input 
                                value={newSpecialty} 
                                onChange={(e) => setNewSpecialty(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Add a specialty (e.g. Finance, Marketing)"
                            />
                            <Button type="button" onClick={addSpecialty} size="icon" variant="secondary">
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {specialties.map((specialty, index) => (
                                <div key={index} className="flex items-center gap-1 bg-secondary px-3 py-1 rounded-full text-sm">
                                    <span>{specialty}</span>
                                    <button 
                                        type="button" 
                                        onClick={() => removeSpecialty(index)}
                                        className="text-muted-foreground hover:text-foreground"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            ))}
                            {specialties.length === 0 && (
                                <p className="text-xs text-muted-foreground italic">No specialties added yet.</p>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2 pt-4 border-t">
                        <Label htmlFor="password">New Password</Label>
                        <Input 
                            id="password" 
                            type="password" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            placeholder="Leave blank to keep current"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirm New Password</Label>
                        <Input 
                            id="confirmPassword" 
                            type="password" 
                            value={confirmPassword} 
                            onChange={(e) => setConfirmPassword(e.target.value)} 
                            placeholder="Confirm new password"
                        />
                    </div>

                    <Button type="submit" className="w-full" disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Save Changes
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
