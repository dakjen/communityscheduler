import { getStaffHours } from '../actions';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RequestAppointmentForm } from '@/components/RequestAppointmentForm';
import { NavBar } from '@/components/NavBar';
import { Fragment } from 'react';

export const dynamic = 'force-dynamic';

// Helper to group slots into ranges
function formatSchedule(schedule: Record<string, string[]>) {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const formatted: { day: string; ranges: string[] }[] = [];

    days.forEach(day => {
        const slots = schedule[day]?.sort() || [];
        if (slots.length === 0) return;

        const ranges: string[] = [];
        let start = slots[0];
        let end = slots[0];

        for (let i = 1; i < slots.length; i++) {
            const current = slots[i];
            const prev = slots[i - 1];
            
            // Check if current slot is immediately after previous (30 mins diff)
            const [h1, m1] = prev.split(':').map(Number);
            const [h2, m2] = current.split(':').map(Number);
            
            const d1 = new Date(); 
            d1.setHours(h1, m1, 0, 0); // Zero seconds/ms
            
            const d2 = new Date(); 
            d2.setHours(h2, m2, 0, 0); // Zero seconds/ms
            
            // 30 mins in ms = 30 * 60 * 1000
            if (d2.getTime() - d1.getTime() === 1800000) {
                end = current;
            } else {
                // Push range
                ranges.push(formatRange(start, end));
                start = current;
                end = current;
            }
        }
        ranges.push(formatRange(start, end));
        formatted.push({ day, ranges });
    });

    return formatted;
}

function formatRange(start: string, end: string) {
    const [h1, m1] = start.split(':').map(Number);
    const d1 = new Date(); 
    d1.setHours(h1, m1, 0, 0);
    
    // For end time, we need to add 30 mins to the *start* of the last slot
    const [h2, m2] = end.split(':').map(Number);
    const d2 = new Date(); 
    d2.setHours(h2, m2, 0, 0);
    const d3 = new Date(d2.getTime() + 1800000); // Add 30 mins

    return `${format(d1, 'h:mm a')} - ${format(d3, 'h:mm a')}`;
}

export default async function ServicesPage() {
  const staffMembers = await getStaffHours();

  const services = [
    {
      title: "Public Computer Access",
      description: "Free access to computers with internet and basic software.",
      hours: "Mon-Fri: 9am - 5pm"
    },
    {
      title: "Printing & Copying",
      description: "Black & white printing available for small fees.",
      hours: "Mon-Fri: 9am - 5pm"
    },
    {
      title: "Entrepreneurship & Small Business Support",
      description: "Meet with our HTH Business Support Staff to Heighten Your Hustle",
      hours: "By Appointment"
    }
  ];

  return (
    <main className="min-h-screen bg-white p-4 md:p-8 flex flex-col">
      <div className="max-w-6xl mx-auto space-y-8 flex-grow w-full">
        <NavBar 
            title="Community Services" 
            description="Explore what we offer at the PCC Building" 
        />

        <Tabs defaultValue="amenities" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8 max-w-xl">
                <TabsTrigger value="amenities">Amenities</TabsTrigger>
                <TabsTrigger value="entrepreneurship">Entrepreneurship</TabsTrigger>
            </TabsList>

            <TabsContent value="amenities">
                <section>
                    <h2 className="text-2xl font-semibold mb-4">Building Amenities</h2>
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {services.map((service, index) => (
                        <Card key={index}>
                        <CardHeader>
                            <CardTitle>{service.title}</CardTitle>
                            <CardDescription>{service.hours}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p>{service.description}</p>
                        </CardContent>
                        </Card>
                    ))}
                    </div>
                </section>
            </TabsContent>

            <TabsContent value="entrepreneurship">
                <div className="space-y-8">
                    <section>
                        <h2 className="text-2xl font-semibold mb-4">Staff Office Hours</h2>
                        <div className="grid gap-6 grid-cols-1">
                            {staffMembers.length === 0 ? (
                                <div className="col-span-full">
                                    <Card>
                                        <CardContent className="p-8 text-center text-muted-foreground">
                                            No staff office hours posted yet.
                                        </CardContent>
                                    </Card>
                                </div>
                            ) : (
                                staffMembers.map((staff) => {
                                    let schedule: Record<string, string[]> = {};
                                    try {
                                        if (staff.officeHours && staff.officeHours.startsWith('{')) {
                                            schedule = JSON.parse(staff.officeHours);
                                        }
                                    } catch (e) {}

                                    const formattedSchedule = formatSchedule(schedule);

                                    if (formattedSchedule.length === 0) return null;

                                    return (
                                        <Fragment key={staff.username}>
                                            <Card className="h-full">
                                                <CardHeader>
                                                    <CardTitle>{staff.fullName || staff.username}</CardTitle>
                                                    {staff.bio && (
                                                        <p className="text-sm text-muted-foreground font-medium pt-1 italic">
                                                            Ask me about: <span className="text-foreground">{staff.bio}</span>
                                                        </p>
                                                    )}
                                                </CardHeader>
                                                <CardContent>
                                                    <div className="space-y-4">
                                                        {formattedSchedule.map(({ day, ranges }) => (
                                                            <div key={day}>
                                                                <h4 className="font-semibold text-sm text-primary mb-1">{day}</h4>
                                                                <ul className="text-sm text-gray-600 space-y-1">
                                                                    {ranges.map((range, i) => (
                                                                        <li key={i}>{range}</li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </Fragment>
                                    );
                                })
                            )}
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4">Request Appointment</h2>
                        <div className="w-full">
                            <RequestAppointmentForm staffMembers={staffMembers} />
                        </div>
                    </section>
                </div>
            </TabsContent>
        </Tabs>
      </div>
      
      <footer className="mt-12 py-6 border-t border-secondary text-center">
        <Link href="/admin">
            <Button variant="ghost" size="sm" className="text-muted-foreground">Admin Login</Button>
        </Link>
      </footer>
    </main>
  );
}