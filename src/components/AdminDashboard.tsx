'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { deleteBooking, createRoom, deleteRoom, updateRoom, createAdmin, deleteAdmin, updateAdmin } from '@/app/actions';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Trash2, Plus, UserPlus, Shield, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

type Booking = {
    id: number;
    roomName: string | null;
    customerName: string;
    startTime: Date;
    endTime: Date;
    purpose: string;
};

type Room = {
    id: number;
    name: string;
    description: string | null;
    capacity: number;
    imageUrl: string | null;
    openTime: string;
    closeTime: string;
};

type Admin = {
    id: number;
    username: string;
    fullName: string | null;
    email: string | null;
    role: 'admin' | 'staff';
};

export default function AdminDashboard({ bookings, rooms, admins }: { bookings: Booking[], rooms: Room[], admins: Admin[] }) {
    const [newRoom, setNewRoom] = useState({ name: '', capacity: '', description: '', openTime: '09:00', closeTime: '17:00' });
    const [editingRoom, setEditingRoom] = useState<Room | null>(null);
    const [isEditRoomOpen, setIsEditRoomOpen] = useState(false);
    
    const [newAdmin, setNewAdmin] = useState({ username: '', password: '', fullName: '', email: '', role: 'admin' });
    const [editingAdmin, setEditingAdmin] = useState<Admin & { password?: string } | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    
    // --- Booking Handlers ---
    const handleDeleteBooking = async (id: number) => {
        if (!confirm('Are you sure you want to cancel this booking?')) return;
        try {
            await deleteBooking(id);
            toast.success('Booking cancelled');
        } catch (e) {
            toast.error('Failed to cancel');
        }
    };

    // --- Room Handlers ---
    const handleCreateRoom = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const formData = new FormData();
            formData.append('name', newRoom.name);
            formData.append('capacity', newRoom.capacity);
            formData.append('description', newRoom.description);
            formData.append('openTime', newRoom.openTime);
            formData.append('closeTime', newRoom.closeTime);
            
            // Get file input
            const fileInput = document.getElementById('room-image') as HTMLInputElement;
            if (fileInput && fileInput.files && fileInput.files[0]) {
                formData.append('image', fileInput.files[0]);
            }

            await createRoom(formData);
            setNewRoom({ name: '', capacity: '', description: '', openTime: '09:00', closeTime: '17:00' });
            if (fileInput) fileInput.value = ''; // Reset file input
            toast.success('Room created');
        } catch (e) {
            toast.error('Failed to create room');
        }
    };

    const handleUpdateRoom = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingRoom) return;
        try {
            const formData = new FormData();
            formData.append('id', editingRoom.id.toString());
            formData.append('name', editingRoom.name);
            formData.append('capacity', editingRoom.capacity.toString());
            formData.append('description', editingRoom.description || '');
            formData.append('openTime', editingRoom.openTime);
            formData.append('closeTime', editingRoom.closeTime);
            
            // Get file input
            const fileInput = document.getElementById('edit-room-image') as HTMLInputElement;
            if (fileInput && fileInput.files && fileInput.files[0]) {
                formData.append('image', fileInput.files[0]);
            }

            await updateRoom(formData);
            setIsEditRoomOpen(false);
            setEditingRoom(null);
            toast.success('Room updated');
        } catch (e) {
            toast.error('Failed to update room');
        }
    };

    const handleDeleteRoom = async (id: number) => {
        if (!confirm('Are you sure? This will not delete past bookings but will remove the room from future selections.')) return;
        try {
            await deleteRoom(id);
            toast.success('Room deleted');
        } catch (e) {
            toast.error('Failed to delete room');
        }
    };

    // --- Admin Handlers ---
    const handleCreateAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createAdmin(newAdmin as any);
            setNewAdmin({ username: '', password: '', fullName: '', email: '', role: 'admin' });
            toast.success('User created');
        } catch (e: any) {
            toast.error(e.message || 'Failed to create user');
        }
    };

    const handleUpdateAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingAdmin) return;
        try {
            await updateAdmin({
                id: editingAdmin.id,
                fullName: editingAdmin.fullName || '',
                email: editingAdmin.email || '',
                password: editingAdmin.password
            });
            setIsEditDialogOpen(false);
            setEditingAdmin(null);
            toast.success('User updated');
        } catch (e: any) {
            toast.error(e.message || 'Failed to update user');
        }
    };

    const handleDeleteAdmin = async (id: number) => {
        if (!confirm('Are you sure you want to delete this user?')) return;
        try {
            await deleteAdmin(id);
            toast.success('User deleted');
        } catch (e) {
            toast.error('Failed to delete user');
        }
    };

    return (
        <Tabs defaultValue="bookings" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8">
                <TabsTrigger value="bookings">Bookings</TabsTrigger>
                <TabsTrigger value="rooms">Rooms</TabsTrigger>
                <TabsTrigger value="admins">Users</TabsTrigger>
            </TabsList>

            {/* --- BOOKINGS TAB --- */}
            <TabsContent value="bookings">
                <Card>
                    <CardHeader>
                        <CardTitle>Upcoming Bookings</CardTitle>
                        <CardDescription>Manage all community center reservations</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {bookings.length === 0 ? (
                            <p className="text-muted-foreground text-center py-8">No bookings found.</p>
                        ) : (
                            <div className="space-y-4">
                                {bookings.map((booking) => (
                                    <div key={booking.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50">
                                        <div>
                                            <h4 className="font-medium">{booking.purpose}</h4>
                                            <p className="text-sm text-muted-foreground">
                                                {booking.customerName} • {booking.roomName}
                                            </p>
                                            <p className="text-sm font-semibold text-slate-700">
                                                {format(booking.startTime, 'MMM d, h:mm a')} - {format(booking.endTime, 'h:mm a')}
                                            </p>
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={() => handleDeleteBooking(booking.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>

            {/* --- ROOMS TAB --- */}
            <TabsContent value="rooms">
                <div className="grid gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Add New Room</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleCreateRoom} className="space-y-4">
                                <div className="flex gap-4">
                                    <div className="space-y-2 flex-1">
                                        <Label>Name</Label>
                                        <Input 
                                            value={newRoom.name} 
                                            onChange={e => setNewRoom({...newRoom, name: e.target.value})}
                                            placeholder="e.g. Hall A" 
                                            required 
                                        />
                                    </div>
                                    <div className="space-y-2 w-32">
                                        <Label>Capacity</Label>
                                        <Input 
                                            type="number"
                                            value={newRoom.capacity} 
                                            onChange={e => setNewRoom({...newRoom, capacity: e.target.value})}
                                            placeholder="50" 
                                            required 
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="space-y-2 flex-1">
                                        <Label>Open Time</Label>
                                        <Input 
                                            type="time"
                                            value={newRoom.openTime} 
                                            onChange={e => setNewRoom({...newRoom, openTime: e.target.value})}
                                            required 
                                        />
                                    </div>
                                    <div className="space-y-2 flex-1">
                                        <Label>Close Time</Label>
                                        <Input 
                                            type="time"
                                            value={newRoom.closeTime} 
                                            onChange={e => setNewRoom({...newRoom, closeTime: e.target.value})}
                                            required 
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="space-y-2 flex-1">
                                        <Label>Description</Label>
                                        <Input 
                                            value={newRoom.description} 
                                            onChange={e => setNewRoom({...newRoom, description: e.target.value})}
                                            placeholder="Optional details..." 
                                        />
                                    </div>
                                    <div className="space-y-2 flex-1">
                                        <Label>Image (Optional)</Label>
                                        <Input id="room-image" type="file" accept="image/*" />
                                    </div>
                                </div>
                                <Button type="submit"><Plus className="h-4 w-4 mr-2"/> Add Room</Button>
                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Existing Rooms</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {rooms.map((room) => (
                                    <div key={room.id} className="flex items-center justify-between p-4 border rounded-lg">
                                        <div className="flex items-center gap-4">
                                            {room.imageUrl ? (
                                                <img src={room.imageUrl} alt={room.name} className="w-16 h-16 object-cover rounded-md bg-slate-100" />
                                            ) : (
                                                <div className="w-16 h-16 rounded-md bg-slate-100 flex items-center justify-center text-slate-400 text-xs">No Img</div>
                                            )}
                                            <div>
                                                <h4 className="font-medium">{room.name}</h4>
                                                <p className="text-sm text-muted-foreground">
                                                    Capacity: {room.capacity} • {room.description}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    Hours: {room.openTime} - {room.closeTime}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Dialog open={isEditRoomOpen && editingRoom?.id === room.id} onOpenChange={(open) => {
                                                if (open) setEditingRoom(room);
                                                else {
                                                    setEditingRoom(null);
                                                    setIsEditRoomOpen(false);
                                                }
                                            }}>
                                                <DialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" onClick={() => {
                                                        setEditingRoom(room);
                                                        setIsEditRoomOpen(true);
                                                    }}>
                                                        <Pencil className="h-4 w-4 text-slate-500" />
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent>
                                                    <DialogHeader>
                                                        <DialogTitle>Edit Room</DialogTitle>
                                                    </DialogHeader>
                                                    {editingRoom && (
                                                        <form onSubmit={handleUpdateRoom} className="space-y-4">
                                                            <div className="flex gap-4">
                                                                <div className="space-y-2 flex-1">
                                                                    <Label>Name</Label>
                                                                    <Input 
                                                                        value={editingRoom.name} 
                                                                        onChange={e => setEditingRoom({...editingRoom, name: e.target.value})}
                                                                        required 
                                                                    />
                                                                </div>
                                                                <div className="space-y-2 w-32">
                                                                    <Label>Capacity</Label>
                                                                    <Input 
                                                                        type="number"
                                                                        value={editingRoom.capacity} 
                                                                        onChange={e => setEditingRoom({...editingRoom, capacity: parseInt(e.target.value) || 0})}
                                                                        required 
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-4">
                                                                <div className="space-y-2 flex-1">
                                                                    <Label>Open Time</Label>
                                                                    <Input 
                                                                        type="time"
                                                                        value={editingRoom.openTime} 
                                                                        onChange={e => setEditingRoom({...editingRoom, openTime: e.target.value})}
                                                                        required 
                                                                    />
                                                                </div>
                                                                <div className="space-y-2 flex-1">
                                                                    <Label>Close Time</Label>
                                                                    <Input 
                                                                        type="time"
                                                                        value={editingRoom.closeTime} 
                                                                        onChange={e => setEditingRoom({...editingRoom, closeTime: e.target.value})}
                                                                        required 
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>Description</Label>
                                                                <Input 
                                                                    value={editingRoom.description || ''} 
                                                                    onChange={e => setEditingRoom({...editingRoom, description: e.target.value})}
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>New Image (Optional)</Label>
                                                                <Input id="edit-room-image" type="file" accept="image/*" />
                                                            </div>
                                                            <Button type="submit" className="w-full">Save Changes</Button>
                                                        </form>
                                                    )}
                                                </DialogContent>
                                            </Dialog>

                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteRoom(room.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </TabsContent>

            {/* --- ADMINS TAB --- */}
            <TabsContent value="admins">
                <div className="grid gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Create New User</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleCreateAdmin} className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Username</Label>
                                    <Input 
                                        value={newAdmin.username} 
                                        onChange={e => setNewAdmin({...newAdmin, username: e.target.value})}
                                        required 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Password</Label>
                                    <Input 
                                        type="password"
                                        value={newAdmin.password} 
                                        onChange={e => setNewAdmin({...newAdmin, password: e.target.value})}
                                        required 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Full Name</Label>
                                    <Input 
                                        value={newAdmin.fullName} 
                                        onChange={e => setNewAdmin({...newAdmin, fullName: e.target.value})}
                                        required 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Email</Label>
                                    <Input 
                                        type="email"
                                        value={newAdmin.email} 
                                        onChange={e => setNewAdmin({...newAdmin, email: e.target.value})}
                                        required 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Role</Label>
                                    <Select value={newAdmin.role} onValueChange={(val: any) => setNewAdmin({...newAdmin, role: val})}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="admin">Admin</SelectItem>
                                            <SelectItem value="staff">Staff</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="col-span-2 pt-2">
                                    <Button type="submit" className="w-full"><UserPlus className="h-4 w-4 mr-2"/> Create User</Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>System Users</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {admins.map((admin) => (
                                    <div key={admin.id} className="flex items-center justify-between p-4 border rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-slate-100 p-2 rounded-full">
                                                <Shield className="h-5 w-5 text-slate-600" />
                                            </div>
                                            <div>
                                                <h4 className="font-medium">{admin.fullName} <span className="text-slate-400 text-sm">(@{admin.username})</span></h4>
                                                <p className="text-xs text-muted-foreground">{admin.email} • <span className="uppercase font-bold text-primary">{admin.role}</span></p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Dialog open={isEditDialogOpen && editingAdmin?.id === admin.id} onOpenChange={(open) => {
                                                if (open) setEditingAdmin(admin);
                                                else {
                                                    setEditingAdmin(null);
                                                    setIsEditDialogOpen(false);
                                                }
                                            }}>
                                                <DialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" onClick={() => {
                                                        setEditingAdmin(admin);
                                                        setIsEditDialogOpen(true);
                                                    }}>
                                                        <Pencil className="h-4 w-4 text-slate-500" />
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent>
                                                    <DialogHeader>
                                                        <DialogTitle>Edit User</DialogTitle>
                                                    </DialogHeader>
                                                    {editingAdmin && (
                                                        <form onSubmit={handleUpdateAdmin} className="space-y-4">
                                                            <div className="space-y-2">
                                                                <Label>Full Name</Label>
                                                                <Input 
                                                                    value={editingAdmin.fullName || ''} 
                                                                    onChange={e => setEditingAdmin({...editingAdmin, fullName: e.target.value})}
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>Email</Label>
                                                                <Input 
                                                                    value={editingAdmin.email || ''} 
                                                                    onChange={e => setEditingAdmin({...editingAdmin, email: e.target.value})}
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>New Password (Optional)</Label>
                                                                <Input 
                                                                    type="password"
                                                                    placeholder="Leave blank to keep current"
                                                                    value={editingAdmin.password || ''} 
                                                                    onChange={e => setEditingAdmin({...editingAdmin, password: e.target.value})}
                                                                />
                                                            </div>
                                                            <Button type="submit" className="w-full">Save Changes</Button>
                                                        </form>
                                                    )}
                                                </DialogContent>
                                            </Dialog>

                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteAdmin(admin.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </TabsContent>
        </Tabs>
    );
}
