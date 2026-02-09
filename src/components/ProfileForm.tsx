'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { updateProfile } from '@/app/actions';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function ProfileForm({ user }: { user: any }) {
    const [fullName, setFullName] = useState(user.fullName || '');
    const [email, setEmail] = useState(user.email || '');
    const [bio, setBio] = useState(user.bio || '');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (password && password !== confirmPassword) {
            toast.error("Passwords don't match");
            return;
        }

        setIsSaving(true);
        try {
            await updateProfile({
                fullName,
                email,
                bio,
                password: password || undefined
            });
            toast.success('Profile updated successfully');
            setPassword('');
            setConfirmPassword('');
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
                        <Label htmlFor="bio">Specialties / Bio</Label>
                        <Textarea 
                            id="bio" 
                            value={bio} 
                            onChange={(e) => setBio(e.target.value)} 
                            placeholder="Tell us about your specialties or what you can teach..."
                            rows={4}
                        />
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
