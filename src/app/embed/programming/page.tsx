import { getPrograms } from '@/app/actions';
import MonthlyProgrammingCalendar from '@/components/MonthlyProgrammingCalendar';
import ProgrammingList from '@/components/ProgrammingList';
import HomeCarousel from '@/components/HomeCarousel';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Programming Calendar',
    robots: { index: false, follow: false },
};

export default async function EmbedProgrammingPage() {
    const programs = await getPrograms();

    return (
        <main className="bg-white p-3">
            <HomeCarousel
                autoAdvanceMs={7000}
                slides={[
                    {
                        key: 'calendar',
                        title: 'Calendar',
                        content: <MonthlyProgrammingCalendar programs={programs} />,
                    },
                    {
                        key: 'list',
                        title: 'Upcoming',
                        content: <ProgrammingList programs={programs} />,
                    },
                ]}
            />
        </main>
    );
}
