'use client';

import { useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type Slide = { key: string; title: string; content: ReactNode };

export default function HomeCarousel({ slides }: { slides: Slide[] }) {
    const [index, setIndex] = useState(0);
    const touchStartX = useRef<number | null>(null);
    const SWIPE_THRESHOLD = 50;

    const go = (next: number) => {
        if (next < 0 || next >= slides.length) return;
        setIndex(next);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
    };
    const handleTouchEnd = (e: React.TouchEvent) => {
        if (touchStartX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(dx) > SWIPE_THRESHOLD) {
            go(index + (dx < 0 ? 1 : -1));
        }
        touchStartX.current = null;
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => go(index - 1)}
                    disabled={index === 0}
                    aria-label="Previous"
                >
                    <ChevronLeft className="h-5 w-5" />
                </Button>
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-slate-700">{slides[index].title}</h2>
                    <div className="flex gap-1.5">
                        {slides.map((s, i) => (
                            <button
                                key={s.key}
                                aria-label={`Go to ${s.title}`}
                                onClick={() => go(i)}
                                className={cn(
                                    "h-2 rounded-full transition-all",
                                    i === index ? "w-6 bg-primary" : "w-2 bg-slate-300 hover:bg-slate-400"
                                )}
                            />
                        ))}
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => go(index + 1)}
                    disabled={index === slides.length - 1}
                    aria-label="Next"
                >
                    <ChevronRight className="h-5 w-5" />
                </Button>
            </div>

            <div
                className="overflow-hidden"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                <div
                    className="flex transition-transform duration-300 ease-out"
                    style={{ transform: `translateX(-${index * 100}%)` }}
                >
                    {slides.map(slide => (
                        <div key={slide.key} className="w-full flex-shrink-0">
                            {slide.content}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
