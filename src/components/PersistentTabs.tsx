'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { Tabs } from '@/components/ui/tabs';

// Tabs whose active value is mirrored to the URL hash (e.g. #programming),
// so the selection survives a page refresh and can be linked/bookmarked.
export function PersistentTabs({
    defaultValue,
    values,
    className,
    children,
}: {
    defaultValue: string;
    values: string[];
    className?: string;
    children: ReactNode;
}) {
    const [active, setActive] = useState(defaultValue);

    useEffect(() => {
        const read = () => {
            const h = window.location.hash.replace('#', '');
            if (values.includes(h)) setActive(h);
        };
        read();
        window.addEventListener('hashchange', read);
        return () => window.removeEventListener('hashchange', read);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onChange = (value: string) => {
        setActive(value);
        history.replaceState(null, '', `#${value}`);
    };

    return (
        <Tabs value={active} onValueChange={onChange} className={className}>
            {children}
        </Tabs>
    );
}
